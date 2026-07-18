import { Effect, Option, Schema } from 'effect'
import {
  ProjectId,
  SourceVersionId,
  WorkspaceId,
} from '@struct/domain'
import { QueryError } from '../errors.js'
import { SqlClient } from '../sql-client.js'

export const SourceTextReindexStatus = Schema.Union(
  Schema.Literal('pending'),
  Schema.Literal('in-progress'),
  Schema.Literal('completed'),
  Schema.Literal('failed'),
)

export interface SourceTextReindexJob {
  readonly sourceVersionId: typeof SourceVersionId.Type
  readonly workspaceId: typeof WorkspaceId.Type
  readonly projectId: typeof ProjectId.Type
  readonly artifactRef: string
  readonly contentHash: string
  readonly status: Schema.Schema.Type<typeof SourceTextReindexStatus>
  readonly attempts: number
  readonly maxAttempts: number
}

const SourceTextReindexRow = Schema.Struct({
  source_version_id: SourceVersionId,
  workspace_id: WorkspaceId,
  project_id: ProjectId,
  artifact_ref: Schema.String,
  content_hash: Schema.String,
  status: SourceTextReindexStatus,
  attempts: Schema.Union(Schema.Number, Schema.NumberFromString),
  max_attempts: Schema.Union(Schema.Number, Schema.NumberFromString),
})

function decodeJob(row: unknown): Effect.Effect<SourceTextReindexJob, QueryError, never> {
  return Schema.decodeUnknown(SourceTextReindexRow)(row).pipe(
    Effect.map((decoded) => ({
      sourceVersionId: decoded.source_version_id,
      workspaceId: decoded.workspace_id,
      projectId: decoded.project_id,
      artifactRef: decoded.artifact_ref,
      contentHash: decoded.content_hash,
      status: decoded.status,
      attempts: decoded.attempts,
      maxAttempts: decoded.max_attempts,
    })),
    Effect.mapError(() =>
      new QueryError({
        operation: 'decodeSourceTextReindexJob',
        entity: 'SourceTextReindexJob',
        message: 'Source text reindex job could not be decoded',
      }),
    ),
  )
}

export class SourceTextReindexRepo extends Effect.Service<SourceTextReindexRepo>()(
  'SourceTextReindexRepo',
  {
    accessors: true,
    effect: Effect.gen(function* () {
      const sql = yield* SqlClient

      const claimNext = Effect.fn('SourceTextReindexRepo.claimNext')(function* () {
        const rows = yield* Effect.tryPromise({
          try: () =>
            sql.transaction((transaction) =>
              transaction.unsafe(
                `WITH next_job AS (
                   SELECT source_version_id
                   FROM source_text_reindex_jobs
                   WHERE status = 'pending' AND attempts < max_attempts
                   ORDER BY created_at ASC, source_version_id ASC
                   FOR UPDATE SKIP LOCKED
                   LIMIT 1
                 )
                 UPDATE source_text_reindex_jobs
                 SET status = 'in-progress',
                     attempts = attempts + 1,
                     last_error_code = NULL,
                     updated_at = NOW()
                 WHERE source_version_id IN (SELECT source_version_id FROM next_job)
                 RETURNING *`,
              ),
            ),
          catch: () =>
            new QueryError({
              operation: 'claimNext',
              entity: 'SourceTextReindexJob',
              message: 'Source text reindex claim failed',
            }),
        })
        if (rows.length === 0) return Option.none<SourceTextReindexJob>()
        return Option.some(yield* decodeJob(rows[0]))
      })

      const recoverStale = Effect.fn('SourceTextReindexRepo.recoverStale')(
        function* (staleBeforeMs: number) {
          yield* Effect.tryPromise({
            try: () =>
              sql.transaction(async (transaction) => {
                await transaction.unsafe(
                  `UPDATE source_text_reindex_jobs
                   SET status = 'pending',
                       last_error_code = 'stale-lease',
                       updated_at = NOW()
                   WHERE status = 'in-progress'
                     AND updated_at < to_timestamp($1 / 1000.0)
                     AND attempts < max_attempts`,
                  [staleBeforeMs],
                )
                await transaction.unsafe(
                  `UPDATE source_text_reindex_jobs
                   SET status = 'failed',
                       last_error_code = 'stale-lease-exhausted',
                       updated_at = NOW()
                   WHERE status = 'in-progress'
                     AND updated_at < to_timestamp($1 / 1000.0)
                     AND attempts >= max_attempts`,
                  [staleBeforeMs],
                )
              }),
            catch: () =>
              new QueryError({
                operation: 'recoverStale',
                entity: 'SourceTextReindexJob',
                message: 'Stale source text reindex recovery failed',
              }),
          })
        },
      )

      const recordFailure = Effect.fn('SourceTextReindexRepo.recordFailure')(
        function* (job: SourceTextReindexJob, errorCode: string) {
          const rows = yield* Effect.tryPromise({
            try: () =>
              sql.unsafe(
                `UPDATE source_text_reindex_jobs
                 SET status = CASE
                       WHEN attempts >= max_attempts THEN 'failed'
                       ELSE 'pending'
                     END,
                     last_error_code = $2,
                     updated_at = NOW()
                 WHERE source_version_id = $1
                   AND status = 'in-progress'
                   AND attempts = $3
                 RETURNING source_version_id`,
                [job.sourceVersionId, errorCode, job.attempts],
              ),
            catch: () =>
              new QueryError({
                operation: 'recordFailure',
                entity: 'SourceTextReindexJob',
                message: 'Source text reindex failure state could not be recorded',
              }),
          })
          if (rows.length !== 1) {
            return yield* new QueryError({
              operation: 'recordFailure.transition',
              entity: 'SourceTextReindexJob',
              message: 'Source text reindex job was no longer in progress',
            })
          }
        },
      )

      return { claimNext, recoverStale, recordFailure }
    }),
  },
) {}
