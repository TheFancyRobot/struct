import { Effect, ParseResult, Schema } from 'effect'
import {
  JobStatus,
  SourceActivityEvent,
  SourceCatalog,
  SourceKind,
} from '@struct/domain'
import type * as type from '@struct/domain'
import { SqlClient } from '../sql-client.js'

const DateToNumber = Schema.transformOrFail(Schema.DateFromSelf, Schema.Number, {
  decode: (date) => ParseResult.succeed(date.getTime()),
  encode: (milliseconds) => ParseResult.succeed(new Date(milliseconds)),
})
const Integer = Schema.Union(Schema.Number, Schema.NumberFromString)

const CatalogRow = Schema.Struct({
  source_id: Schema.UUID,
  name: Schema.String,
  kind: SourceKind,
  media_type: Schema.NullOr(Schema.String),
  latest_version_id: Schema.NullOr(Schema.UUID),
  latest_version: Schema.NullOr(Integer),
  updated_at: DateToNumber,
  job_id: Schema.NullOr(Schema.UUID),
  job_status: Schema.NullOr(JobStatus),
  job_attempts: Schema.NullOr(Integer),
  job_max_attempts: Schema.NullOr(Integer),
  job_updated_at: Schema.NullOr(DateToNumber),
})

const ActivityRow = Schema.Struct({
  id: Schema.UUID,
  cursor: Schema.String,
  source_id: Schema.UUID,
  event_type: Schema.String,
  created_at: DateToNumber,
})

export class SourceCatalogPersistenceError
  extends Schema.TaggedError<SourceCatalogPersistenceError>()(
    'SourceCatalogPersistenceError',
    {
      operation: Schema.String,
      message: Schema.String,
    },
  ) {}

function failure(operation: string): SourceCatalogPersistenceError {
  return new SourceCatalogPersistenceError({
    operation,
    message: `Source catalog ${operation} failed`,
  })
}

export class SourceCatalogRepo extends Effect.Service<SourceCatalogRepo>()(
  'SourceCatalogRepo',
  {
    accessors: true,
    effect: Effect.gen(function* () {
      const sql = yield* SqlClient

      const list = Effect.fn('SourceCatalogRepo.list')(function* (
        workspaceId: type.WorkspaceId,
        projectId: type.ProjectId,
      ) {
        const [cursorRows, rows] = yield* Effect.tryPromise({
          try: async () => {
            const cursor = await sql.unsafe(
              `SELECT COALESCE(MAX(event.cursor), 0)::text AS cursor
               FROM event_journal event
               JOIN sources source ON source.id = event.entity_id
               JOIN projects project ON project.id = source.project_id
               WHERE event.workspace_id = $1
                 AND project.id = $2
                 AND project.workspace_id = $1
                 AND event.entity_type = 'ingestion'`,
              [workspaceId, projectId],
            )
            const catalog = await sql.unsafe(
              `SELECT source.id AS source_id,
                      source.name,
                      source.kind,
                      NULLIF(job.payload->>'mediaType', '') AS media_type,
                      version.id AS latest_version_id,
                      version.version AS latest_version,
                      GREATEST(
                        source.updated_at,
                        COALESCE(job.updated_at, source.updated_at),
                        COALESCE(version.created_at, source.updated_at)
                      ) AS updated_at,
                      job.id AS job_id,
                      job.status AS job_status,
                      job.attempts AS job_attempts,
                      job.max_attempts AS job_max_attempts,
                      job.updated_at AS job_updated_at
               FROM sources source
               JOIN projects project ON project.id = source.project_id
               LEFT JOIN LATERAL (
                 SELECT candidate.*
                 FROM source_versions candidate
                 WHERE candidate.source_id = source.id
                 ORDER BY candidate.version DESC
                 LIMIT 1
               ) version ON TRUE
               LEFT JOIN LATERAL (
                 SELECT candidate.*
                 FROM job_queue candidate
                 WHERE candidate.entity_type = 'ingestion'
                   AND candidate.entity_id = source.id
                   AND candidate.workspace_id = project.workspace_id
                 ORDER BY candidate.updated_at DESC, candidate.id DESC
                 LIMIT 1
               ) job ON TRUE
               WHERE project.workspace_id = $1
                 AND project.id = $2
                 AND source.kind <> 'directory'
               ORDER BY source.updated_at DESC, source.id`,
              [workspaceId, projectId],
            )
            return [cursor, catalog] as const
          },
          catch: () => failure('list'),
        })
        const cursor = String(cursorRows[0]?.['cursor'] ?? '0')
        const decoded = yield* Effect.forEach(rows, (row) =>
          Schema.decodeUnknown(CatalogRow)(row).pipe(
            Effect.mapError(() => failure('decode')),
          ))
        return yield* Schema.decodeUnknown(SourceCatalog)({
          cursor,
          items: decoded.map((row) => {
            const job = row.job_id === null
              || row.job_status === null
              || row.job_attempts === null
              || row.job_max_attempts === null
              || row.job_updated_at === null
              ? null
              : {
                  id: row.job_id,
                  status: row.job_status,
                  attempts: row.job_attempts,
                  maxAttempts: row.job_max_attempts,
                  updatedAt: row.job_updated_at,
                }
            const readiness = row.latest_version_id !== null
              ? 'ready'
              : row.job_status === 'failed'
                ? 'failed'
                : row.job_status === 'cancelled'
                  ? 'cancelled'
                  : row.job_status === 'in-progress'
                    ? 'processing'
                    : 'pending'
            return {
              sourceId: row.source_id,
              name: row.name,
              kind: row.kind,
              mediaType: row.media_type,
              latestVersionId: row.latest_version_id,
              latestVersion: row.latest_version,
              readiness,
              updatedAt: row.updated_at,
              job,
            }
          }),
        }).pipe(Effect.mapError(() => failure('decode')))
      })

      const listEventsAfter = Effect.fn('SourceCatalogRepo.listEventsAfter')(
        function* (
          workspaceId: type.WorkspaceId,
          projectId: type.ProjectId,
          cursor: bigint,
          limit: number,
        ) {
          const rows = yield* Effect.tryPromise({
            try: () => sql.unsafe(
              `SELECT event.id,
                      event.cursor::text AS cursor,
                      source.id AS source_id,
                      event.event_type,
                      event.created_at
               FROM event_journal event
               JOIN sources source ON source.id = event.entity_id
               JOIN projects project ON project.id = source.project_id
               WHERE event.workspace_id = $1
                 AND project.id = $2
                 AND project.workspace_id = $1
                 AND event.entity_type = 'ingestion'
                 AND event.cursor > $3
               ORDER BY event.cursor
               LIMIT $4`,
              [workspaceId, projectId, cursor.toString(), limit],
            ),
            catch: () => failure('activity'),
          })
          return yield* Effect.forEach(rows, (row) =>
            Schema.decodeUnknown(ActivityRow)(row).pipe(
              Effect.flatMap((decoded) =>
                Schema.decodeUnknown(SourceActivityEvent)({
                  id: decoded.id,
                  cursor: decoded.cursor,
                  sourceId: decoded.source_id,
                  type: decoded.event_type,
                  createdAt: decoded.created_at,
                })),
              Effect.mapError(() => failure('activity decode')),
            ))
        },
      )

      const controlJob = Effect.fn('SourceCatalogRepo.controlJob')(function* (
        workspaceId: type.WorkspaceId,
        projectId: type.ProjectId,
        jobId: type.JobQueueId,
        command: 'cancel' | 'retry',
        eventId: type.EventJournalId,
        now: bigint,
      ) {
        return yield* Effect.tryPromise({
          try: () => sql.transaction(async (transaction) => {
            const rows = await transaction.unsafe(
              `UPDATE job_queue job
               SET status = CASE WHEN $4 = 'retry' THEN 'pending' ELSE 'cancelled' END,
                   updated_at = to_timestamp($5::bigint / 1000.0)
               FROM sources source
               JOIN projects project ON project.id = source.project_id
               WHERE job.id = $3
                 AND job.workspace_id = $1
                 AND job.entity_type = 'ingestion'
                 AND job.entity_id = source.id
                 AND project.id = $2
                 AND project.workspace_id = $1
                 AND (
                   ($4 = 'cancel' AND job.status IN ('pending', 'in-progress'))
                   OR
                   ($4 = 'retry' AND job.status IN ('failed', 'cancelled')
                     AND job.attempts < job.max_attempts)
                 )
               RETURNING job.entity_id`,
              [workspaceId, projectId, jobId, command, Number(now)],
            )
            const sourceId = rows[0]?.['entity_id']
            if (typeof sourceId !== 'string') return false
            await transaction.unsafe(
              `INSERT INTO event_journal (
                 id, workspace_id, entity_type, entity_id, event_type, payload, created_at
               ) VALUES (
                 $1, $2, 'ingestion', $3, $4,
                 jsonb_build_object('jobId', $5::text),
                 to_timestamp($6::bigint / 1000.0)
               )`,
              [
                eventId,
                workspaceId,
                sourceId,
                command === 'retry' ? 'ingestion-retried' : 'ingestion-cancelled',
                jobId,
                Number(now),
              ],
            )
            return true
          }),
          catch: () => failure(`job ${command}`),
        })
      })

      return { list, listEventsAfter, controlJob }
    }),
  },
) {}
