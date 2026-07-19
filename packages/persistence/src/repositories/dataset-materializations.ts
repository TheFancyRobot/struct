import {
  DatasetId,
  DatasetSnapshotId,
  JobQueueId,
  ProjectId,
  Sha256Digest,
  WorkspaceId,
} from '@struct/domain'
import { Effect, Option, Schema } from 'effect'
import { SqlClient } from '../sql-client.js'

const ArtifactRef = Schema.String.pipe(
  Schema.pattern(/^artifact:\/\/sha256\/[a-f0-9]{64}$/),
)
const PositiveInteger = Schema.Union(
  Schema.Number,
  Schema.NumberFromString,
).pipe(Schema.int(), Schema.positive())
const QueryAlias = Schema.String.pipe(
  Schema.pattern(/^[a-z][a-z0-9_]{0,62}$/),
)
const ParquetDigest = Schema.String.pipe(Schema.pattern(/^[a-f0-9]{64}$/))

export const DatasetMaterializationJob = Schema.Struct({
  jobId: JobQueueId,
  workspaceId: WorkspaceId,
  projectId: ProjectId,
  datasetId: DatasetId,
  snapshotId: DatasetSnapshotId,
  attempt: PositiveInteger,
  maxAttempts: PositiveInteger,
  leaseToken: Schema.UUID,
  sourceFormats: Schema.Array(Schema.Literal('json', 'jsonl', 'csv')),
})
export type DatasetMaterializationJob =
  Schema.Schema.Type<typeof DatasetMaterializationJob>

export const DatasetMaterialization = Schema.Struct({
  snapshotId: DatasetSnapshotId,
  workspaceId: WorkspaceId,
  projectId: ProjectId,
  datasetId: DatasetId,
  parquetRef: ArtifactRef,
  parquetHash: Sha256Digest,
  parquetByteLength: PositiveInteger,
  profileRef: ArtifactRef,
  profileHash: Sha256Digest,
  profile: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
})
export type DatasetMaterialization =
  Schema.Schema.Type<typeof DatasetMaterialization>

export const DatasetMaterializationEnqueueInput = Schema.Struct({
  jobId: JobQueueId,
  workspaceId: WorkspaceId,
  snapshotId: DatasetSnapshotId,
  sourceFormats: Schema.Array(
    Schema.Literal('json', 'jsonl', 'csv'),
  ).pipe(Schema.minItems(1)),
  maxAttempts: PositiveInteger,
})
export type DatasetMaterializationEnqueueInput =
  Schema.Schema.Type<typeof DatasetMaterializationEnqueueInput>

export const DatasetQuerySnapshotRequest = Schema.Struct({
  alias: QueryAlias,
  datasetId: DatasetId,
  snapshotId: DatasetSnapshotId,
})
export type DatasetQuerySnapshotRequest =
  Schema.Schema.Type<typeof DatasetQuerySnapshotRequest>

export const ResolvedDatasetQuerySnapshot = Schema.Struct({
  alias: QueryAlias,
  datasetId: DatasetId,
  snapshotId: DatasetSnapshotId,
  schemaHash: Sha256Digest,
  parquetDigest: ParquetDigest,
})
export type ResolvedDatasetQuerySnapshot =
  Schema.Schema.Type<typeof ResolvedDatasetQuerySnapshot>

export class DatasetMaterializationPersistenceError
  extends Schema.TaggedError<DatasetMaterializationPersistenceError>()(
    'DatasetMaterializationPersistenceError',
    {
      operation: Schema.String,
      message: Schema.String,
    },
  ) {}

export class DatasetMaterializationOwnershipLostError
  extends Schema.TaggedError<DatasetMaterializationOwnershipLostError>()(
    'DatasetMaterializationOwnershipLostError',
    {
      jobId: JobQueueId,
      attempt: PositiveInteger,
      message: Schema.String,
    },
  ) {}

export class DatasetMaterializationScopeError
  extends Schema.TaggedError<DatasetMaterializationScopeError>()(
    'DatasetMaterializationScopeError',
    {
      snapshotId: DatasetSnapshotId,
      message: Schema.String,
    },
  ) {}

export class DatasetMaterializationConflictError
  extends Schema.TaggedError<DatasetMaterializationConflictError>()(
    'DatasetMaterializationConflictError',
    {
      snapshotId: DatasetSnapshotId,
      message: Schema.String,
    },
  ) {}

function failure(operation: string) {
  return new DatasetMaterializationPersistenceError({
    operation,
    message: `Dataset materialization ${operation} failed`,
  })
}

function decodeJob(row: Record<string, unknown>) {
  const payload = typeof row['payload'] === 'string'
    ? JSON.parse(row['payload']) as unknown
    : row['payload']
  const sourceFormats =
    typeof payload === 'object'
    && payload !== null
    && !Array.isArray(payload)
    ? (payload as Record<string, unknown>)['sourceFormats']
    : undefined
  return Schema.decodeUnknown(DatasetMaterializationJob)({
    jobId: row['job_id'],
    workspaceId: row['workspace_id'],
    projectId: row['project_id'],
    datasetId: row['dataset_id'],
    snapshotId: row['snapshot_id'],
    attempt: row['attempts'],
    maxAttempts: row['max_attempts'],
    leaseToken: row['lease_token'],
    sourceFormats,
  }).pipe(Effect.mapError(() => failure('job decode')))
}

export class DatasetMaterializationRepo
  extends Effect.Service<DatasetMaterializationRepo>()(
    'DatasetMaterializationRepo',
    {
      accessors: true,
      effect: Effect.gen(function* () {
        const sql = yield* SqlClient

        const enqueue = Effect.fn('DatasetMaterializationRepo.enqueue')(
          function* (input: DatasetMaterializationEnqueueInput) {
            const decoded = yield* Schema.decodeUnknown(
              DatasetMaterializationEnqueueInput,
            )(input).pipe(Effect.mapError(() => failure('enqueue validation')))
            return yield* Effect.tryPromise({
              try: () => sql.transaction(async (transaction) => {
                const snapshots = await transaction.unsafe(
                  `SELECT snapshot.id,
                          (
                            SELECT count(*)
                            FROM dataset_snapshot_sources source
                            WHERE source.snapshot_id = snapshot.id
                          ) AS source_count
                   FROM dataset_snapshots snapshot
                   WHERE snapshot.id = $1 AND snapshot.workspace_id = $2
                   FOR SHARE`,
                  [decoded.snapshotId, decoded.workspaceId],
                )
                if (snapshots.length !== 1) {
                  throw new DatasetMaterializationScopeError({
                    snapshotId: decoded.snapshotId,
                    message: 'Dataset snapshot was not found in this workspace',
                  })
                }
                if (
                  Number(snapshots[0]?.['source_count'])
                  !== decoded.sourceFormats.length
                ) {
                  throw new DatasetMaterializationScopeError({
                    snapshotId: decoded.snapshotId,
                    message: 'Source formats do not match the dataset snapshot sources',
                  })
                }
                const existing = await transaction.unsafe(
                  `SELECT (
                     job.id = $2
                     AND job.workspace_id = $3
                     AND job.max_attempts = $4
                     AND job.payload =
                       jsonb_build_object(
                         'sourceFormats',
                         to_jsonb($5::text[])
                       )
                   ) AS exact
                   FROM dataset_materialization_jobs materialization
                   JOIN job_queue job ON job.id = materialization.job_id
                   WHERE materialization.snapshot_id = $1`,
                  [
                    decoded.snapshotId,
                    decoded.jobId,
                    decoded.workspaceId,
                    decoded.maxAttempts,
                    decoded.sourceFormats,
                  ],
                )
                if (existing.length === 1) {
                  if (existing[0]?.['exact'] !== true) {
                    throw new DatasetMaterializationConflictError({
                      snapshotId: decoded.snapshotId,
                      message: 'Dataset snapshot already has a different materialization job',
                    })
                  }
                  return { replayed: true as const }
                }
                await transaction.unsafe(
                  `INSERT INTO job_queue (
                     id, workspace_id, entity_type, entity_id, payload, max_attempts
                   ) VALUES (
                     $1, $2, 'dataset-materialization', $3,
                     jsonb_build_object(
                       'sourceFormats',
                       to_jsonb($4::text[])
                     ), $5
                   )`,
                  [
                    decoded.jobId,
                    decoded.workspaceId,
                    decoded.snapshotId,
                    decoded.sourceFormats,
                    decoded.maxAttempts,
                  ],
                )
                await transaction.unsafe(
                  `INSERT INTO dataset_materialization_jobs (job_id, snapshot_id)
                   VALUES ($1, $2)`,
                  [decoded.jobId, decoded.snapshotId],
                )
                return { replayed: false as const }
              }),
              catch: (cause) => {
                if (
                  cause instanceof DatasetMaterializationScopeError
                  || cause instanceof DatasetMaterializationConflictError
                ) {
                  return cause
                }
                return failure('enqueue')
              },
            })
          },
        )

        const claimNext = Effect.fn('DatasetMaterializationRepo.claimNext')(
          function* (leaseMs: number) {
            if (!Number.isSafeInteger(leaseMs) || leaseMs < 1) {
              return yield* failure('claim validation')
            }
            const rows = yield* Effect.tryPromise({
              try: () => sql.transaction(async (transaction) =>
                transaction.unsafe(
                  `WITH candidate AS (
                     SELECT job.id
                     FROM job_queue job
                     JOIN dataset_materialization_jobs materialization
                       ON materialization.job_id = job.id
                     WHERE job.entity_type = 'dataset-materialization'
                       AND job.status = 'pending'
                       AND (
                         job.attempts = 0
                         OR job.updated_at <=
                           clock_timestamp()
                           - (
                             LEAST(60, 5 * power(2, job.attempts - 1))
                             * interval '1 second'
                           )
                       )
                     ORDER BY job.created_at, job.id
                     FOR UPDATE OF job SKIP LOCKED
                     LIMIT 1
                   ),
                   claimed AS (
                     UPDATE job_queue job
                     SET status = 'in-progress',
                         attempts = attempts + 1,
                         updated_at = clock_timestamp()
                     FROM candidate
                     WHERE job.id = candidate.id
                     RETURNING job.*
                   ),
                   leased AS (
                     UPDATE dataset_materialization_jobs materialization
                     SET lease_token = gen_random_uuid(),
                         lease_expires_at =
                           clock_timestamp() + ($1::bigint * interval '1 millisecond')
                     FROM claimed
                     WHERE materialization.job_id = claimed.id
                     RETURNING materialization.*
                   )
                   SELECT claimed.id AS job_id, claimed.workspace_id,
                          claimed.attempts, claimed.max_attempts, claimed.payload,
                          leased.snapshot_id, leased.lease_token,
                          snapshot.project_id, snapshot.dataset_id
                   FROM claimed
                   JOIN leased ON leased.job_id = claimed.id
                   JOIN dataset_snapshots snapshot
                     ON snapshot.id = leased.snapshot_id`,
                  [leaseMs],
                )),
              catch: () => failure('claim'),
            })
            if (rows.length === 0) return Option.none()
            return Option.some(yield* decodeJob(rows[0]!))
          },
        )

        const recoverExpired = Effect.fn(
          'DatasetMaterializationRepo.recoverExpired',
        )(function* () {
          return yield* Effect.tryPromise({
            try: () => sql.transaction(async (transaction) => {
              const rows = await transaction.unsafe(
                `UPDATE job_queue job
                 SET status = CASE
                       WHEN job.attempts < job.max_attempts
                       THEN 'pending' ELSE 'failed'
                     END,
                     updated_at = clock_timestamp()
                 FROM dataset_materialization_jobs materialization
                 WHERE materialization.job_id = job.id
                   AND job.entity_type = 'dataset-materialization'
                   AND job.status = 'in-progress'
                   AND materialization.lease_expires_at < clock_timestamp()
                 RETURNING job.id, job.workspace_id, job.attempts,
                           job.status, materialization.snapshot_id`,
              )
              await transaction.unsafe(
                `UPDATE dataset_materialization_jobs materialization
                 SET lease_token = NULL, lease_expires_at = NULL
                 FROM job_queue job
                 WHERE materialization.job_id = job.id
                   AND job.entity_type = 'dataset-materialization'
                   AND job.status IN ('pending', 'failed')
                   AND materialization.lease_token IS NOT NULL`,
              )
              for (const row of rows) {
                if (row['status'] !== 'failed') continue
                await transaction.unsafe(
                  `INSERT INTO event_journal (
                     id, workspace_id, entity_type, entity_id,
                     event_type, payload, cursor, created_at
                   ) VALUES (
                     gen_random_uuid(), $1, 'dataset-materialization', $2::uuid,
                     'dataset-materialization-failed',
                     jsonb_build_object(
                       'jobId', $3::text,
                       'attempt', $4::integer,
                       'errorCode', 'lease-expired',
                       'retryable', true,
                       'willRetry', false
                     ),
                     0, clock_timestamp()
                   )`,
                  [
                    row['workspace_id'],
                    row['snapshot_id'],
                    row['id'],
                    row['attempts'],
                  ],
                )
              }
              return rows.length
            }),
            catch: () => failure('recovery'),
          })
        })

        const renewLease = Effect.fn('DatasetMaterializationRepo.renewLease')(
          function* (job: DatasetMaterializationJob, leaseMs: number) {
            const rows = yield* Effect.tryPromise({
              try: () => sql.unsafe(
                `UPDATE dataset_materialization_jobs materialization
                 SET lease_expires_at =
                       clock_timestamp() + ($5::bigint * interval '1 millisecond')
                 FROM job_queue job
                 WHERE materialization.job_id = $1
                   AND materialization.lease_token = $2
                   AND job.id = materialization.job_id
                   AND job.workspace_id = $3
                   AND job.attempts = $4
                   AND job.status = 'in-progress'
                   AND materialization.lease_expires_at >= clock_timestamp()
                 RETURNING materialization.job_id`,
                [
                  job.jobId,
                  job.leaseToken,
                  job.workspaceId,
                  job.attempt,
                  leaseMs,
                ],
              ),
              catch: () => failure('lease renewal'),
            })
            if (rows.length !== 1) {
              return yield* new DatasetMaterializationOwnershipLostError({
                jobId: job.jobId,
                attempt: job.attempt,
                message: 'Dataset materialization lease ownership was lost',
              })
            }
          },
        )

        const complete = Effect.fn('DatasetMaterializationRepo.complete')(
          function* (
            job: DatasetMaterializationJob,
            materialization: DatasetMaterialization,
          ) {
            if (
              materialization.snapshotId !== job.snapshotId
              || materialization.workspaceId !== job.workspaceId
              || materialization.projectId !== job.projectId
              || materialization.datasetId !== job.datasetId
            ) {
              return yield* new DatasetMaterializationScopeError({
                snapshotId: materialization.snapshotId,
                message: 'Materialization result does not match its claimed job scope',
              })
            }
            const completed = yield* Effect.tryPromise({
              try: () => sql.transaction(async (transaction) => {
                const ownership = await transaction.unsafe(
                  `SELECT job.id
                   FROM job_queue job
                   JOIN dataset_materialization_jobs materialization
                     ON materialization.job_id = job.id
                   WHERE job.id = $1
                     AND job.workspace_id = $2
                     AND job.attempts = $3
                     AND job.status = 'in-progress'
                     AND materialization.lease_token = $4
                     AND materialization.lease_expires_at >= clock_timestamp()
                     AND materialization.snapshot_id = $5
                   FOR UPDATE OF job`,
                  [
                    job.jobId,
                    job.workspaceId,
                    job.attempt,
                    job.leaseToken,
                    job.snapshotId,
                  ],
                )
                if (ownership.length !== 1) return false
                await transaction.unsafe(
                  `INSERT INTO dataset_materializations (
                     snapshot_id, workspace_id, project_id, dataset_id,
                     parquet_ref, parquet_hash, parquet_byte_length,
                     profile_ref, profile_hash, profile
                   ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)
                   ON CONFLICT (snapshot_id) DO NOTHING`,
                  [
                    materialization.snapshotId,
                    materialization.workspaceId,
                    materialization.projectId,
                    materialization.datasetId,
                    materialization.parquetRef,
                    materialization.parquetHash,
                    materialization.parquetByteLength,
                    materialization.profileRef,
                    materialization.profileHash,
                    JSON.stringify(materialization.profile),
                  ],
                )
                const matching = await transaction.unsafe(
                  `SELECT snapshot_id
                   FROM dataset_materializations
                   WHERE snapshot_id = $1
                     AND workspace_id = $2
                     AND project_id = $3
                     AND dataset_id = $4
                     AND parquet_ref = $5
                     AND parquet_hash = $6
                     AND parquet_byte_length = $7
                     AND profile_ref = $8
                     AND profile_hash = $9
                     AND profile = $10::jsonb`,
                  [
                    materialization.snapshotId,
                    materialization.workspaceId,
                    materialization.projectId,
                    materialization.datasetId,
                    materialization.parquetRef,
                    materialization.parquetHash,
                    materialization.parquetByteLength,
                    materialization.profileRef,
                    materialization.profileHash,
                    JSON.stringify(materialization.profile),
                  ],
                )
                if (matching.length !== 1) throw failure('immutable replay')
                await transaction.unsafe(
                  `UPDATE job_queue
                   SET status = 'completed', updated_at = clock_timestamp()
                   WHERE id = $1`,
                  [job.jobId],
                )
                await transaction.unsafe(
                  `INSERT INTO event_journal (
                     id, workspace_id, entity_type, entity_id,
                     event_type, payload, cursor, created_at
                   ) VALUES (
                     gen_random_uuid(), $1, 'dataset-materialization', $2::uuid,
                     'dataset-materialized',
                     jsonb_build_object(
                       'jobId', $3::text,
                       'attempt', $4::integer,
                       'snapshotId', $2::uuid::text,
                       'parquetRef', $5::text,
                       'profileRef', $6::text
                     ),
                     0, clock_timestamp()
                   )`,
                  [
                    job.workspaceId,
                    job.snapshotId,
                    job.jobId,
                    job.attempt,
                    materialization.parquetRef,
                    materialization.profileRef,
                  ],
                )
                return true
              }),
              catch: () => failure('completion'),
            })
            if (!completed) {
              return yield* new DatasetMaterializationOwnershipLostError({
                jobId: job.jobId,
                attempt: job.attempt,
                message: 'Dataset materialization completion lost ownership',
              })
            }
          },
        )

        const recordFailure = Effect.fn(
          'DatasetMaterializationRepo.recordFailure',
        )(function* (
          job: DatasetMaterializationJob,
          retryable: boolean,
          errorCode: string,
        ) {
          const safeCode = /^[a-z][a-z0-9-]{0,99}$/.test(errorCode)
            ? errorCode
            : 'materialization-failed'
          const updated = yield* Effect.tryPromise({
            try: () => sql.transaction(async (transaction) => {
              const rows = await transaction.unsafe(
                `UPDATE job_queue job
                 SET status = CASE
                       WHEN $5::boolean AND attempts < max_attempts
                       THEN 'pending' ELSE 'failed'
                     END,
                     updated_at = clock_timestamp()
                 FROM dataset_materialization_jobs materialization
                 WHERE job.id = $1
                   AND job.workspace_id = $2
                   AND job.attempts = $3
                   AND job.status = 'in-progress'
                   AND materialization.job_id = job.id
                   AND materialization.lease_token = $4
                   AND materialization.lease_expires_at >= clock_timestamp()
                 RETURNING job.status`,
                [
                  job.jobId,
                  job.workspaceId,
                  job.attempt,
                  job.leaseToken,
                  retryable,
                ],
              )
              if (rows.length !== 1) return false
              await transaction.unsafe(
                `UPDATE dataset_materialization_jobs
                 SET lease_token = NULL, lease_expires_at = NULL
                 WHERE job_id = $1`,
                [job.jobId],
              )
              await transaction.unsafe(
                `INSERT INTO event_journal (
                   id, workspace_id, entity_type, entity_id,
                   event_type, payload, cursor, created_at
                 ) VALUES (
                   gen_random_uuid(), $1, 'dataset-materialization', $2::uuid,
                   'dataset-materialization-failed',
                   jsonb_build_object(
                     'jobId', $3::text,
                     'attempt', $4::integer,
                     'errorCode', $5::text,
                     'retryable', $6::boolean,
                     'willRetry', $7::boolean
                   ),
                   0, clock_timestamp()
                 )`,
                [
                  job.workspaceId,
                  job.snapshotId,
                  job.jobId,
                  job.attempt,
                  safeCode,
                  retryable,
                  rows[0]?.['status'] === 'pending',
                ],
              )
              return true
            }),
            catch: () => failure('failure transition'),
          })
          if (!updated) {
            return yield* new DatasetMaterializationOwnershipLostError({
              jobId: job.jobId,
              attempt: job.attempt,
              message: 'Dataset materialization failure transition lost ownership',
            })
          }
        })

        const resolveQuerySnapshots = Effect.fn(
          'DatasetMaterializationRepo.resolveQuerySnapshots',
        )(function* (
          workspaceId: typeof WorkspaceId.Type,
          projectId: typeof ProjectId.Type,
          requests: ReadonlyArray<DatasetQuerySnapshotRequest>,
        ) {
          const decoded = yield* Schema.decodeUnknown(
            Schema.Array(DatasetQuerySnapshotRequest).pipe(
              Schema.minItems(1),
              Schema.maxItems(8),
              Schema.filter((items) => {
                const aliases = new Set(items.map((item) => item.alias))
                const snapshots = new Set(
                  items.map((item) => item.snapshotId),
                )
                return aliases.size === items.length
                  && snapshots.size === items.length
              }),
            ),
          )(requests).pipe(
            Effect.mapError(() => failure('query snapshot validation')),
          )
          return yield* Effect.forEach(decoded, (request) =>
            Effect.gen(function* () {
              const rows = yield* Effect.tryPromise({
                try: () => sql.unsafe(
                  `SELECT snapshot.dataset_id, snapshot.id AS snapshot_id,
                          family.schema_hash, materialization.parquet_hash
                   FROM dataset_snapshots snapshot
                   JOIN dataset_schema_families family
                     ON family.id = snapshot.schema_family_id
                    AND family.dataset_id = snapshot.dataset_id
                    AND family.workspace_id = snapshot.workspace_id
                    AND family.project_id = snapshot.project_id
                   JOIN dataset_materializations materialization
                     ON materialization.snapshot_id = snapshot.id
                    AND materialization.dataset_id = snapshot.dataset_id
                    AND materialization.workspace_id = snapshot.workspace_id
                    AND materialization.project_id = snapshot.project_id
                   WHERE snapshot.id = $1
                     AND snapshot.dataset_id = $2
                     AND snapshot.workspace_id = $3
                     AND snapshot.project_id = $4`,
                  [
                    request.snapshotId,
                    request.datasetId,
                    workspaceId,
                    projectId,
                  ],
                ),
                catch: () => failure('query snapshot resolution'),
              })
              if (rows.length !== 1) {
                return yield* new DatasetMaterializationScopeError({
                  snapshotId: request.snapshotId,
                  message:
                    'Materialized dataset snapshot was not found in this workspace and project',
                })
              }
              const row = rows[0]!
              const parquetHash = row['parquet_hash']
              return yield* Schema.decodeUnknown(ResolvedDatasetQuerySnapshot)({
                alias: request.alias,
                datasetId: row['dataset_id'],
                snapshotId: row['snapshot_id'],
                schemaHash: row['schema_hash'],
                parquetDigest: typeof parquetHash === 'string'
                  ? parquetHash.slice('sha256:'.length)
                  : parquetHash,
              }).pipe(
                Effect.mapError(() => failure('query snapshot decode')),
              )
            }))
        })

        return {
          enqueue,
          claimNext,
          recoverExpired,
          renewLease,
          complete,
          recordFailure,
          resolveQuerySnapshots,
        }
      }),
    },
  ) {}
