import { Effect, Option, Schema } from 'effect'
import {
  DirectoryIngestionJob,
  DirectoryIngestionEntryCommit,
  DirectoryIngestionJobStatus,
  DirectoryIngestionJobTransition,
  DirectoryIngestionLeaseToken,
  DirectoryIngestionResult,
  DirectorySnapshotId,
  InvalidDirectoryIngestionTransitionError,
  JobQueueId,
  nextDirectoryIngestionJobStatus,
  WorkspaceId,
} from '@struct/domain'
import { QueryError } from '../errors.js'
import { SqlClient } from '../sql-client.js'

interface TransactionExecutor {
  readonly unsafe: (
    query: string,
    params?: readonly unknown[],
  ) => Promise<readonly Record<string, unknown>[]>
}

const PositiveInteger = Schema.Union(Schema.Number, Schema.NumberFromString).pipe(
  Schema.int(),
  Schema.positive(),
)

const ClaimedJobRow = Schema.Struct({
  job_id: JobQueueId,
  workspace_id: WorkspaceId,
  snapshot_id: DirectorySnapshotId,
  status: Schema.String,
  attempt: PositiveInteger,
  max_attempts: PositiveInteger,
  lease_token: DirectoryIngestionLeaseToken,
  lease_expires_at_ms: Schema.Union(Schema.Number, Schema.NumberFromString),
  next_checkpoint_sequence: PositiveInteger,
})

export interface CreateDirectoryIngestionJobInput {
  readonly jobId: typeof JobQueueId.Type
  readonly workspaceId: typeof WorkspaceId.Type
  readonly snapshotId: typeof DirectorySnapshotId.Type
  readonly maxAttempts: number
}

export interface OwnedDirectoryIngestionAttempt {
  readonly job: DirectoryIngestionJob
}

export type DirectoryIngestionCommitResult =
  | {
      readonly _tag: 'Committed'
      readonly checkpointSequence: number
      readonly result: typeof DirectoryIngestionResult.Type
      readonly acknowledged: true
    }
  | {
      readonly _tag: 'Replayed'
      readonly checkpointSequence: number
      readonly result: typeof DirectoryIngestionResult.Type
      readonly acknowledged: true
    }
  | {
      readonly _tag: 'StaleWorkerNoOp'
      readonly reason: 'lease-token-or-attempt-mismatch'
      readonly acknowledged: false
    }

export type DirectoryIngestionLeaseResult =
  | { readonly _tag: 'Renewed' }
  | {
      readonly _tag: 'StaleWorkerNoOp'
      readonly reason: 'lease-token-or-attempt-mismatch'
    }

export interface DirectoryIngestionRecovery {
  readonly requeued: number
  readonly exhausted: number
}

export type DirectoryIngestionRepositoryError =
  | QueryError
  | InvalidDirectoryIngestionTransitionError

function queryError(operation: string, cause?: unknown): QueryError {
  return new QueryError({
    operation,
    entity: 'DirectoryIngestionJob',
    message: `Directory ingestion ${operation} could not be persisted`,
    ...(cause === undefined ? {} : { cause: String(cause) }),
  })
}

function decodeStoredResult(value: unknown): typeof DirectoryIngestionResult.Type {
  const decoded = typeof value === 'string' ? JSON.parse(value) as unknown : value
  return Schema.decodeUnknownSync(DirectoryIngestionResult)(decoded)
}

function decodeClaimedJob(
  row: Record<string, unknown>,
): Effect.Effect<DirectoryIngestionJob, QueryError> {
  return Schema.decodeUnknown(ClaimedJobRow)(row).pipe(
    Effect.flatMap((decoded) =>
      Schema.decodeUnknown(DirectoryIngestionJob)({
        jobId: decoded.job_id,
        workspaceId: decoded.workspace_id,
        snapshotId: decoded.snapshot_id,
        status: decoded.status,
        attempt: decoded.attempt,
        maxAttempts: decoded.max_attempts,
        leaseToken: decoded.lease_token,
        leaseExpiresAt: decoded.lease_expires_at_ms,
        nextCheckpointSequence: decoded.next_checkpoint_sequence,
      })),
    Effect.mapError((cause) => queryError('decode', cause)),
  )
}

async function readStateForUpdate(
  transaction: TransactionExecutor,
  jobId: typeof JobQueueId.Type,
  workspaceId: typeof WorkspaceId.Type,
): Promise<readonly Record<string, unknown>[]> {
  return transaction.unsafe(
    `SELECT directory.status, job.attempts, job.max_attempts
     FROM job_queue job
     JOIN directory_ingestion_jobs directory ON directory.job_id = job.id
     WHERE job.id = $1 AND job.workspace_id = $2
     FOR UPDATE OF job`,
    [jobId, workspaceId],
  )
}

export class DirectoryIngestionJobRepo
  extends Effect.Service<DirectoryIngestionJobRepo>()(
    'DirectoryIngestionJobRepo',
    {
      accessors: true,
      effect: Effect.gen(function* () {
        const sql = yield* SqlClient

        const create = Effect.fn('DirectoryIngestionJobRepo.create')(
          function* (input: CreateDirectoryIngestionJobInput) {
            const maxAttempts = yield* Schema.decodeUnknown(PositiveInteger)(
              input.maxAttempts,
            ).pipe(Effect.mapError((cause) =>
              queryError('create validation', cause)))
            yield* Effect.tryPromise({
              try: () =>
                sql.transaction(async (transaction) => {
                  const jobs = await transaction.unsafe(
                    `INSERT INTO job_queue (
                       id, workspace_id, entity_type, entity_id, status, payload,
                       attempts, max_attempts
                     )
                     VALUES (
                       $1::uuid, $2::uuid, 'directory-ingestion', $3::uuid, 'pending',
                       jsonb_build_object('snapshotId', $3::text), 0, $4
                     )
                     ON CONFLICT (id) DO UPDATE
                     SET id = job_queue.id
                     WHERE job_queue.workspace_id = EXCLUDED.workspace_id
                       AND job_queue.entity_type = EXCLUDED.entity_type
                       AND job_queue.entity_id = EXCLUDED.entity_id
                       AND job_queue.max_attempts = EXCLUDED.max_attempts
                     RETURNING id`,
                    [
                      input.jobId,
                      input.workspaceId,
                      input.snapshotId,
                      maxAttempts,
                    ],
                  )
                  if (jobs.length !== 1) {
                    throw new Error('directory-ingestion-job-conflict')
                  }
                  const directoryJobs = await transaction.unsafe(
                    `INSERT INTO directory_ingestion_jobs (job_id, snapshot_id)
                     VALUES ($1, $2)
                     ON CONFLICT (job_id) DO UPDATE
                     SET job_id = directory_ingestion_jobs.job_id
                     WHERE directory_ingestion_jobs.snapshot_id = EXCLUDED.snapshot_id
                     RETURNING job_id`,
                    [input.jobId, input.snapshotId],
                  )
                  if (directoryJobs.length !== 1) {
                    throw new Error('directory-ingestion-snapshot-conflict')
                  }
                }),
              catch: (cause) => queryError('create', cause),
            })
          },
        )

        const claimNext = Effect.fn('DirectoryIngestionJobRepo.claimNext')(
          function* (leaseDurationMs: number) {
            leaseDurationMs = yield* Schema.decodeUnknown(PositiveInteger)(
              leaseDurationMs,
            ).pipe(Effect.mapError((cause) => queryError('claim validation', cause)))
            const leaseToken = DirectoryIngestionLeaseToken.make(crypto.randomUUID())
            const rows = yield* Effect.tryPromise({
              try: () =>
                sql.transaction(async (transaction) => {
                  const claimed = await transaction.unsafe(
                    `WITH candidate AS (
                       SELECT job.id
                       FROM job_queue job
                       JOIN directory_ingestion_jobs directory
                         ON directory.job_id = job.id
                       WHERE job.entity_type = 'directory-ingestion'
                         AND job.status = 'pending'
                         AND directory.status = 'ready'
                         AND job.attempts < job.max_attempts
                       ORDER BY job.created_at, job.id
                       FOR UPDATE OF job SKIP LOCKED
                       LIMIT 1
                     )
                     UPDATE job_queue job
                     SET status = 'in-progress',
                         attempts = attempts + 1,
                         lease_token = $1,
                         lease_expires_at =
                           NOW() + ($2::bigint * INTERVAL '1 millisecond'),
                         updated_at = NOW()
                     FROM candidate
                     WHERE job.id = candidate.id
                     RETURNING job.id`,
                    [leaseToken, leaseDurationMs],
                  )
                  if (claimed.length === 0) return []
                  const jobId = claimed[0]?.['id']
                  await transaction.unsafe(
                    `UPDATE directory_ingestion_jobs
                     SET status = 'running', updated_at = NOW()
                     WHERE job_id = $1`,
                    [jobId],
                  )
                  return transaction.unsafe(
                    `SELECT
                       job.id AS job_id,
                       job.workspace_id,
                       directory.snapshot_id,
                       directory.status,
                       job.attempts AS attempt,
                       job.max_attempts,
                       job.lease_token,
                       FLOOR(EXTRACT(EPOCH FROM job.lease_expires_at) * 1000)
                         AS lease_expires_at_ms,
                       directory.next_checkpoint_sequence
                     FROM job_queue job
                     JOIN directory_ingestion_jobs directory
                       ON directory.job_id = job.id
                     WHERE job.id = $1`,
                    [jobId],
                  )
                }),
              catch: () => queryError('claim'),
            })
            if (rows.length === 0) return Option.none<DirectoryIngestionJob>()
            return Option.some(yield* decodeClaimedJob(rows[0]!))
          },
        )

        const renewLease = Effect.fn('DirectoryIngestionJobRepo.renewLease')(
          function* (job: DirectoryIngestionJob, leaseDurationMs: number) {
            leaseDurationMs = yield* Schema.decodeUnknown(PositiveInteger)(
              leaseDurationMs,
            ).pipe(Effect.mapError((cause) =>
              queryError('renew lease validation', cause)))
            const rows = yield* Effect.tryPromise({
              try: () =>
                sql.unsafe(
                  `UPDATE job_queue
                   SET lease_expires_at =
                         NOW() + ($5::bigint * INTERVAL '1 millisecond'),
                       updated_at = NOW()
                   WHERE id = $1
                     AND workspace_id = $2
                     AND status = 'in-progress'
                     AND attempts = $3
                     AND lease_token = $4
                     AND lease_expires_at > NOW()
                   RETURNING id`,
                  [
                    job.jobId,
                    job.workspaceId,
                    job.attempt,
                    job.leaseToken,
                    leaseDurationMs,
                  ],
                ),
              catch: () => queryError('renew lease'),
            })
            return rows.length === 1
              ? { _tag: 'Renewed' } as const
              : {
                  _tag: 'StaleWorkerNoOp',
                  reason: 'lease-token-or-attempt-mismatch',
                } as const
          },
        )

        const commitEntry = Effect.fn('DirectoryIngestionJobRepo.commitEntry')(
          function* (
            input: typeof DirectoryIngestionEntryCommit.Type,
          ) {
            input = yield* Schema.decodeUnknown(DirectoryIngestionEntryCommit)(
              input,
            ).pipe(Effect.mapError((cause) =>
              queryError('entry commit validation', cause)))
            const result = yield* Effect.tryPromise({
              try: () =>
                sql.transaction(async (transaction) => {
                  const ownership = await transaction.unsafe(
                    `SELECT
                       job.lease_token,
                       job.attempts,
                       job.status,
                       job.lease_expires_at > NOW() AS lease_is_current
                     FROM job_queue job
                     WHERE job.id = $1 AND job.workspace_id = $2
                     FOR UPDATE`,
                    [input.jobId, input.workspaceId],
                  )
                  const row = ownership[0]
                  if (
                    row === undefined
                    || row['status'] !== 'in-progress'
                    || row['lease_is_current'] !== true
                    || String(row['lease_token']) !== input.leaseToken
                    || Number(row['attempts']) !== input.attempt
                  ) {
                    return {
                      _tag: 'StaleWorkerNoOp',
                      reason: 'lease-token-or-attempt-mismatch',
                      acknowledged: false,
                    } as const
                  }

                  const replay = await transaction.unsafe(
                    `SELECT checkpoint.sequence, idempotency.result
                     FROM directory_ingestion_checkpoints checkpoint
                     JOIN directory_ingestion_idempotency_results idempotency
                       ON idempotency.job_id = checkpoint.job_id
                      AND idempotency.idempotency_key =
                        checkpoint.idempotency_key
                     WHERE checkpoint.job_id = $1
                       AND checkpoint.idempotency_key = $2`,
                    [input.jobId, input.idempotencyKey],
                  )
                  if (replay.length === 1) {
                    return {
                      _tag: 'Replayed',
                      checkpointSequence: Number(replay[0]?.['sequence']),
                      result: decodeStoredResult(replay[0]?.['result']),
                      acknowledged: true,
                    } as const
                  }

                  const sequenceRows = await transaction.unsafe(
                    `UPDATE directory_ingestion_jobs
                     SET next_checkpoint_sequence = next_checkpoint_sequence + 1,
                         updated_at = NOW()
                     WHERE job_id = $1 AND status = 'running'
                     RETURNING next_checkpoint_sequence - 1 AS sequence`,
                    [input.jobId],
                  )
                  if (sequenceRows.length !== 1) {
                    return {
                      _tag: 'StaleWorkerNoOp',
                      reason: 'lease-token-or-attempt-mismatch',
                      acknowledged: false,
                    } as const
                  }
                  const checkpointSequence = Number(sequenceRows[0]?.['sequence'])
                  const serializedResult = JSON.stringify(input.result)

                  await transaction.unsafe(
                    `INSERT INTO directory_ingestion_idempotency_results (
                       job_id, idempotency_key, attempt, result
                     )
                     VALUES ($1, $2, $3, $4::jsonb)`,
                    [
                      input.jobId,
                      input.idempotencyKey,
                      input.attempt,
                      serializedResult,
                    ],
                  )
                  await transaction.unsafe(
                    `INSERT INTO directory_ingestion_work_records (
                       job_id, entry_id, idempotency_key, outcome, content_key, result
                     )
                     VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
                    [
                      input.jobId,
                      input.entryId,
                      input.idempotencyKey,
                      input.outcome,
                      input.contentKey,
                      serializedResult,
                    ],
                  )
                  await transaction.unsafe(
                    `INSERT INTO directory_ingestion_checkpoints (
                       job_id, sequence, entry_id, idempotency_key, outcome
                     )
                     VALUES ($1, $2, $3, $4, $5)`,
                    [
                      input.jobId,
                      checkpointSequence,
                      input.entryId,
                      input.idempotencyKey,
                      input.outcome,
                    ],
                  )
                  await transaction.unsafe(
                    `INSERT INTO event_journal (
                       id, workspace_id, entity_type, entity_id, event_type, payload
                     )
                     VALUES (
                       md5($1::uuid::text || ':' || $2::text)::uuid,
                       $3::uuid, 'directory-ingestion', $1::uuid,
                       'directory-entry-checkpointed',
                       jsonb_build_object(
                         'jobId', $1::text,
                         'entryId', $4::text,
                         'checkpointSequence', $5::bigint,
                         'outcome', $6::text
                       )
                     )`,
                    [
                      input.jobId,
                      input.idempotencyKey,
                      input.workspaceId,
                      input.entryId,
                      checkpointSequence,
                      input.outcome,
                    ],
                  )
                  return {
                    _tag: 'Committed',
                    checkpointSequence,
                    result: input.result,
                    acknowledged: true,
                  } as const
                }),
              catch: (cause) => queryError('entry commit', cause),
            })
            return result
          },
        )

        const transition = Effect.fn('DirectoryIngestionJobRepo.transition')(
          function* (
            jobId: typeof JobQueueId.Type,
            workspaceId: typeof WorkspaceId.Type,
            transition: typeof DirectoryIngestionJobTransition.Type,
          ) {
            transition = yield* Schema.decodeUnknown(
              DirectoryIngestionJobTransition,
            )(transition).pipe(Effect.mapError((cause) =>
              queryError('transition validation', cause)))
            const currentRows = yield* Effect.tryPromise({
              try: () =>
                sql.transaction(async (transaction) => {
                  const rows = await readStateForUpdate(
                    transaction,
                    jobId,
                    workspaceId,
                  )
                  if (rows.length !== 1) return []
                  const current = Schema.decodeUnknownSync(
                    DirectoryIngestionJobStatus,
                  )(rows[0]?.['status'])
                  if (transition === 'claim') {
                    throw new InvalidDirectoryIngestionTransitionError({
                      current,
                      transition,
                      message: 'Directory ingestion jobs must be claimed through claimNext',
                    })
                  }
                  if (
                    transition === 'retry'
                    && Number(rows[0]?.['attempts']) >= Number(rows[0]?.['max_attempts'])
                  ) {
                    throw new InvalidDirectoryIngestionTransitionError({
                      current,
                      transition,
                      message: 'Cannot retry a directory ingestion job with an exhausted attempt budget',
                    })
                  }
                  const next = nextDirectoryIngestionJobStatus(current, transition)
                  if (next === undefined) {
                    throw new InvalidDirectoryIngestionTransitionError({
                      current,
                      transition,
                      message: `Cannot ${transition} a directory ingestion job in ${current}`,
                    })
                  }
                  if (transition === 'complete') {
                    const unresolved = await transaction.unsafe(
                      `SELECT 1
                       FROM directory_ingestion_checkpoints checkpoint
                       WHERE checkpoint.job_id = $1
                         AND checkpoint.outcome = 'unresolved'
                         AND NOT EXISTS (
                           SELECT 1
                           FROM directory_ingestion_checkpoints newer
                           WHERE newer.job_id = checkpoint.job_id
                             AND newer.entry_id = checkpoint.entry_id
                             AND newer.sequence > checkpoint.sequence
                         )
                       LIMIT 1`,
                      [jobId],
                    )
                    if (unresolved.length > 0) {
                      throw new InvalidDirectoryIngestionTransitionError({
                        current,
                        transition,
                        message: 'Cannot complete a directory ingestion job with unresolved entry outcomes',
                      })
                    }
                  }
                  const queueStatus =
                    next === 'ready'
                      ? 'pending'
                      : next === 'running'
                        ? 'in-progress'
                        : next === 'completed'
                          ? 'completed'
                          : next === 'cancelled'
                            ? 'cancelled'
                            : next === 'exhausted'
                              ? 'failed'
                              : 'pending'
                  await transaction.unsafe(
                    `UPDATE directory_ingestion_jobs
                     SET status = $2, updated_at = NOW()
                     WHERE job_id = $1`,
                    [jobId, next],
                  )
                  await transaction.unsafe(
                    `UPDATE job_queue
                     SET status = $2,
                         lease_token = CASE WHEN $2 = 'in-progress' THEN lease_token ELSE NULL END,
                         lease_expires_at = CASE WHEN $2 = 'in-progress' THEN lease_expires_at ELSE NULL END,
                         updated_at = NOW()
                     WHERE id = $1`,
                    [jobId, queueStatus],
                  )
                  if (transition === 'complete') {
                    await transaction.unsafe(
                      `INSERT INTO event_journal (
                         id, workspace_id, entity_type, entity_id,
                         event_type, payload
                       )
                       VALUES (
                         md5($1::uuid::text || ':directory-completed')::uuid,
                         $2, 'directory-ingestion', $1,
                         'directory-completed',
                         jsonb_build_object(
                           'jobId', $1::uuid::text,
                           'status', 'completed'
                         )
                       )
                       ON CONFLICT (id) DO NOTHING`,
                      [jobId, workspaceId],
                    )
                  }
                  return [{ status: next }]
                }),
              catch: (error) =>
                error instanceof InvalidDirectoryIngestionTransitionError
                  ? error
                  : queryError('transition'),
            })
            if (currentRows.length !== 1) {
              return yield* queryError('transition missing job')
            }
            return yield* Schema.decodeUnknown(
              DirectoryIngestionJobStatus,
            )(currentRows[0]?.['status']).pipe(
              Effect.mapError(() => queryError('transition decode')),
            )
          },
        )

        const recoverExpired = Effect.fn(
          'DirectoryIngestionJobRepo.recoverExpired',
        )(function* () {
          return yield* Effect.tryPromise({
            try: () =>
              sql.transaction(async (transaction) => {
                const expired = await transaction.unsafe(
                  `SELECT job.id, job.attempts, job.max_attempts
                   FROM job_queue job
                   JOIN directory_ingestion_jobs directory
                     ON directory.job_id = job.id
                   WHERE job.entity_type = 'directory-ingestion'
                     AND job.status = 'in-progress'
                     AND directory.status = 'running'
                     AND job.lease_expires_at <= NOW()
                   FOR UPDATE OF job`,
                )
                let requeued = 0
                let exhausted = 0
                for (const row of expired) {
                  const isExhausted =
                    Number(row['attempts']) >= Number(row['max_attempts'])
                  const directoryStatus = isExhausted ? 'exhausted' : 'ready'
                  const queueStatus = isExhausted ? 'failed' : 'pending'
                  await transaction.unsafe(
                    `UPDATE directory_ingestion_jobs
                     SET status = $2, updated_at = NOW()
                     WHERE job_id = $1`,
                    [row['id'], directoryStatus],
                  )
                  await transaction.unsafe(
                    `UPDATE job_queue
                     SET status = $2, lease_token = NULL, lease_expires_at = NULL,
                         updated_at = NOW()
                     WHERE id = $1`,
                    [row['id'], queueStatus],
                  )
                  if (isExhausted) exhausted += 1
                  else requeued += 1
                }
                return { requeued, exhausted }
              }),
            catch: () => queryError('expired lease recovery'),
          })
        })

        return {
          create,
          claimNext,
          renewLease,
          commitEntry,
          transition,
          recoverExpired,
        }
      }),
    },
  ) {}
