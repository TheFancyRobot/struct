import { Effect, Option, Schema } from 'effect'
import {
  DirectoryControlCommand,
  DirectoryIngestionJobStatus,
  DirectoryProgressEventType,
  DirectoryRelativePath,
  DirectoryRootId,
  DirectorySnapshotId,
  DirectoryStatusProjection,
  EventJournalId,
  InvalidDirectoryIngestionTransitionError,
  JobQueueId,
  ManifestEntryId,
  ProjectId,
  SourceId,
  WorkspaceId,
  nextDirectoryIngestionJobStatus,
} from '@struct/domain'
import { QueryError } from '../errors.js'
import { SqlClient } from '../sql-client.js'

const IdempotencyKey = Schema.String.pipe(Schema.minLength(1), Schema.maxLength(512))
const NonNegativeInteger = Schema.Union(
  Schema.Number,
  Schema.NumberFromString,
).pipe(Schema.int(), Schema.nonNegative())
const PositiveInteger = Schema.Union(
  Schema.Number,
  Schema.NumberFromString,
).pipe(Schema.int(), Schema.positive())

const ProjectionRow = Schema.Struct({
  job_id: JobQueueId,
  workspace_id: WorkspaceId,
  project_id: ProjectId,
  source_id: SourceId,
  directory_root_id: DirectoryRootId,
  snapshot_id: DirectorySnapshotId,
  name: Schema.String,
  status: DirectoryIngestionJobStatus,
  attempts: NonNegativeInteger,
  max_attempts: PositiveInteger,
  total: NonNegativeInteger,
  succeeded: NonNegativeInteger,
  failed: NonNegativeInteger,
  unsupported: NonNegativeInteger,
  pending: NonNegativeInteger,
  failures: Schema.Unknown,
  updated_at_ms: NonNegativeInteger,
})

const FailureRow = Schema.Struct({
  entryId: ManifestEntryId,
  relativePath: DirectoryRelativePath,
  errorTag: Schema.String.pipe(Schema.minLength(1)),
})
const FailureRows = Schema.Array(FailureRow)

const EventRow = Schema.Struct({
  id: EventJournalId,
  cursor: Schema.Union(Schema.BigInt, Schema.BigIntFromNumber),
  event_type: DirectoryProgressEventType,
  created_at_ms: NonNegativeInteger,
})

export interface RegisterDirectoryInput {
  readonly workspaceId: typeof WorkspaceId.Type
  readonly projectId: typeof ProjectId.Type
  readonly name: string
  readonly sourceId: typeof SourceId.Type
  readonly directoryRootId: typeof DirectoryRootId.Type
  readonly snapshotId: typeof DirectorySnapshotId.Type
  readonly jobId: typeof JobQueueId.Type
  readonly eventId: typeof EventJournalId.Type
  readonly maxAttempts: number
}

export interface ControlDirectoryIngestionInput {
  readonly workspaceId: typeof WorkspaceId.Type
  readonly projectId: typeof ProjectId.Type
  readonly jobId: typeof JobQueueId.Type
  readonly command: typeof DirectoryControlCommand.Type
  readonly idempotencyKey: string
  readonly eventId: typeof EventJournalId.Type
}

export interface DirectoryControlResult {
  readonly status: DirectoryStatusProjection
  readonly replayed: boolean
}

export interface DirectoryJournalEvent {
  readonly id: typeof EventJournalId.Type
  readonly cursor: bigint
  readonly type: typeof DirectoryProgressEventType.Type
  readonly createdAt: number
}

export class DirectoryControlConflictError
  extends Schema.TaggedError<DirectoryControlConflictError>()(
    'DirectoryControlConflictError',
    {
      reason: Schema.String,
      message: Schema.String,
    },
  ) {}

export type DirectoryControlRepositoryError =
  | QueryError
  | DirectoryControlConflictError
  | InvalidDirectoryIngestionTransitionError

function queryError(operation: string, cause?: unknown): QueryError {
  return new QueryError({
    operation,
    entity: 'DirectoryControl',
    message: `Directory control ${operation} failed`,
    ...(cause === undefined ? {} : { cause: String(cause) }),
  })
}

function commandEventType(
  command: typeof DirectoryControlCommand.Type,
): typeof DirectoryProgressEventType.Type {
  switch (command) {
    case 'pause': return 'directory-paused'
    case 'resume': return 'directory-resumed'
    case 'retry': return 'directory-retried'
    case 'cancel': return 'directory-cancelled'
  }
}

function decodeProjection(
  row: Record<string, unknown>,
): Effect.Effect<DirectoryStatusProjection, QueryError> {
  return Effect.gen(function* () {
    const decoded = yield* Schema.decodeUnknown(ProjectionRow)(row).pipe(
      Effect.mapError((cause) => queryError('projection decode', cause)),
    )
    const encodedFailures = decoded.failures
    const rawFailures = typeof encodedFailures === 'string'
      ? yield* Effect.try({
          try: () => JSON.parse(encodedFailures) as unknown,
          catch: (cause) => queryError('failure projection parse', cause),
        })
      : encodedFailures
    const failures = yield* Schema.decodeUnknown(FailureRows)(rawFailures).pipe(
      Effect.mapError((cause) => queryError('failure projection decode', cause)),
    )
    return yield* Schema.decodeUnknown(DirectoryStatusProjection)({
      jobId: decoded.job_id,
      workspaceId: decoded.workspace_id,
      projectId: decoded.project_id,
      sourceId: decoded.source_id,
      directoryRootId: decoded.directory_root_id,
      snapshotId: decoded.snapshot_id,
      name: decoded.name,
      status: decoded.status,
      attempts: decoded.attempts,
      maxAttempts: decoded.max_attempts,
      counts: {
        total: decoded.total,
        processed: decoded.succeeded + decoded.failed,
        succeeded: decoded.succeeded,
        failed: decoded.failed,
        unsupported: decoded.unsupported,
        pending: decoded.pending,
      },
      failures,
      updatedAt: decoded.updated_at_ms,
    }).pipe(Effect.mapError((cause) => queryError('projection validation', cause)))
  })
}

const projectionSql = `
  WITH latest AS (
    SELECT DISTINCT ON (checkpoint.entry_id)
      checkpoint.entry_id,
      checkpoint.outcome,
      work.result
    FROM directory_ingestion_checkpoints checkpoint
    JOIN directory_ingestion_work_records work
      ON work.job_id = checkpoint.job_id
     AND work.idempotency_key = checkpoint.idempotency_key
    WHERE checkpoint.job_id = $3
    ORDER BY checkpoint.entry_id, checkpoint.sequence DESC
  ),
  counts AS (
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (
        WHERE entry.status = 'included' AND latest.outcome = 'completed'
      )::int AS succeeded,
      COUNT(*) FILTER (
        WHERE entry.status = 'included' AND latest.outcome = 'unresolved'
      )::int AS failed,
      COUNT(*) FILTER (WHERE entry.status = 'unsupported')::int AS unsupported,
      COUNT(*) FILTER (
        WHERE entry.status = 'included' AND latest.entry_id IS NULL
      )::int AS pending
    FROM directory_manifest_entries entry
    LEFT JOIN latest ON latest.entry_id = entry.id
    WHERE entry.snapshot_id = (
      SELECT snapshot_id FROM directory_ingestion_jobs WHERE job_id = $3
    )
  )
  SELECT
    job.id AS job_id,
    job.workspace_id,
    root.project_id,
    root.source_id,
    root.id AS directory_root_id,
    directory.snapshot_id,
    source.name,
    directory.status,
    job.attempts,
    job.max_attempts,
    counts.total,
    counts.succeeded,
    counts.failed,
    counts.unsupported,
    counts.pending,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'entryId', entry.id::text,
        'relativePath', entry.relative_path,
        'errorTag', COALESCE(
          CASE jsonb_typeof(latest.result)
            WHEN 'string' THEN
              ((latest.result #>> '{}')::jsonb)->>'errorTag'
            ELSE latest.result->>'errorTag'
          END,
          'DirectoryEntryError'
        )
      ) ORDER BY entry.relative_path)
      FROM directory_manifest_entries entry
      JOIN latest ON latest.entry_id = entry.id
      WHERE entry.snapshot_id = directory.snapshot_id
        AND latest.outcome = 'unresolved'
    ), '[]'::jsonb) AS failures,
    FLOOR(EXTRACT(EPOCH FROM GREATEST(
      directory.updated_at,
      job.updated_at
    )) * 1000) AS updated_at_ms
  FROM job_queue job
  JOIN directory_ingestion_jobs directory ON directory.job_id = job.id
  JOIN directory_roots root
    ON root.id = directory.directory_root_id
   AND root.workspace_id = job.workspace_id
  JOIN sources source ON source.id = root.source_id
  CROSS JOIN counts
  WHERE job.id = $3
    AND job.workspace_id = $1
    AND root.project_id = $2`

export class DirectoryControlRepo extends Effect.Service<DirectoryControlRepo>()(
  'DirectoryControlRepo',
  {
    accessors: true,
    effect: Effect.gen(function* () {
      const sql = yield* SqlClient

      const findStatus = Effect.fn('DirectoryControlRepo.findStatus')(
        function* (
          workspaceId: typeof WorkspaceId.Type,
          projectId: typeof ProjectId.Type,
          jobId: typeof JobQueueId.Type,
        ) {
          const rows = yield* Effect.tryPromise({
            try: () => sql.unsafe(projectionSql, [workspaceId, projectId, jobId]),
            catch: (cause) => queryError('status query', cause),
          })
          if (rows.length === 0) return Option.none<DirectoryStatusProjection>()
          return Option.some(yield* decodeProjection(rows[0]!))
        },
      )

      const register = Effect.fn('DirectoryControlRepo.register')(
        function* (input: RegisterDirectoryInput) {
          const name = input.name.trim()
          const maxAttempts = yield* Schema.decodeUnknown(PositiveInteger)(
            input.maxAttempts,
          ).pipe(Effect.mapError((cause) =>
            new DirectoryControlConflictError({
              reason: 'invalid-max-attempts',
              message: String(cause),
            })))
          if (name.length === 0 || name.length > 255 || /[/\\\0]/.test(name)) {
            return yield* new DirectoryControlConflictError({
              reason: 'invalid-name',
              message: 'Directory name must be a simple name of at most 255 characters',
            })
          }
          yield* Effect.tryPromise({
            try: () => sql.transaction(async (transaction) => {
              const project = await transaction.unsafe(
                'SELECT 1 FROM projects WHERE id = $1 AND workspace_id = $2',
                [input.projectId, input.workspaceId],
              )
              if (project.length !== 1) {
                throw new DirectoryControlConflictError({
                  reason: 'scope-not-found',
                  message: 'Project was not found in this workspace',
                })
              }
              await transaction.unsafe(
                `INSERT INTO sources (id, project_id, name, kind)
                 VALUES ($1, $2, $3, 'directory')`,
                [input.sourceId, input.projectId, name],
              )
              await transaction.unsafe(
                `INSERT INTO directory_roots (
                   id, workspace_id, project_id, source_id
                 ) VALUES ($1, $2, $3, $4)`,
                [
                  input.directoryRootId,
                  input.workspaceId,
                  input.projectId,
                  input.sourceId,
                ],
              )
              await transaction.unsafe(
                `INSERT INTO job_queue (
                   id, workspace_id, entity_type, entity_id, status, payload,
                   attempts, max_attempts
                 ) VALUES (
                   $1::uuid, $2::uuid, 'directory-ingestion', $3::uuid, 'pending',
                   jsonb_build_object(
                     'snapshotId', $3::uuid::text,
                     'directoryRootId', $4::uuid::text,
                     'projectId', $5::uuid::text
                   ),
                   0, $6
                 )`,
                [
                  input.jobId,
                  input.workspaceId,
                  input.snapshotId,
                  input.directoryRootId,
                  input.projectId,
                  maxAttempts,
                ],
              )
              await transaction.unsafe(
                `INSERT INTO directory_ingestion_jobs (
                   job_id, snapshot_id, directory_root_id
                 ) VALUES ($1, $2, $3)`,
                [input.jobId, input.snapshotId, input.directoryRootId],
              )
              await transaction.unsafe(
                `INSERT INTO event_journal (
                   id, workspace_id, entity_type, entity_id, event_type, payload
                 ) VALUES (
                   $1::uuid, $2::uuid, 'directory-ingestion', $3::uuid,
                   'directory-registered',
                   jsonb_build_object(
                     'jobId', $3::uuid::text,
                     'directoryRootId', $4::uuid::text,
                     'snapshotId', $5::uuid::text
                   )
                 )`,
                [
                  input.eventId,
                  input.workspaceId,
                  input.jobId,
                  input.directoryRootId,
                  input.snapshotId,
                ],
              )
            }),
            catch: (cause) =>
              cause instanceof DirectoryControlConflictError
                ? cause
                : queryError('registration', cause),
          })
          const status = yield* findStatus(
            input.workspaceId,
            input.projectId,
            input.jobId,
          )
          if (Option.isNone(status)) return yield* queryError('registered status')
          return status.value
        },
      )

      const command = Effect.fn('DirectoryControlRepo.command')(
        function* (input: ControlDirectoryIngestionInput) {
          const idempotencyKey = yield* Schema.decodeUnknown(IdempotencyKey)(
            input.idempotencyKey,
          ).pipe(Effect.mapError(() =>
            new DirectoryControlConflictError({
              reason: 'invalid-idempotency-key',
              message: 'Idempotency key must contain between 1 and 512 characters',
            })))
          const command = yield* Schema.decodeUnknown(DirectoryControlCommand)(
            input.command,
          ).pipe(Effect.mapError(() =>
            new DirectoryControlConflictError({
              reason: 'invalid-command',
              message: 'Directory control command is invalid',
            })))
          const replayed = yield* Effect.tryPromise({
            try: () => sql.transaction(async (transaction) => {
              const states = await transaction.unsafe(
                `SELECT directory.status, job.attempts, job.max_attempts
                 FROM job_queue job
                 JOIN directory_ingestion_jobs directory
                   ON directory.job_id = job.id
                 JOIN directory_roots root
                   ON root.id = directory.directory_root_id
                 WHERE job.id = $1
                   AND job.workspace_id = $2
                   AND root.project_id = $3
                 FOR UPDATE OF job`,
                [input.jobId, input.workspaceId, input.projectId],
              )
              if (states.length !== 1) throw new DirectoryControlConflictError({
                reason: 'scope-not-found',
                message: 'Directory ingestion job was not found in this scope',
              })
              const previous = await transaction.unsafe(
                `SELECT command FROM directory_ingestion_commands
                 WHERE job_id = $1 AND idempotency_key = $2`,
                [input.jobId, idempotencyKey],
              )
              if (previous.length === 1) {
                if (previous[0]?.['command'] !== command) {
                  throw new DirectoryControlConflictError({
                    reason: 'idempotency-conflict',
                    message: 'Idempotency key was already used for a different command',
                  })
                }
                return true
              }
              const current = Schema.decodeUnknownSync(
                DirectoryIngestionJobStatus,
              )(states[0]?.['status'])
              if (
                command === 'retry'
                && Number(states[0]?.['attempts']) >= Number(states[0]?.['max_attempts'])
              ) {
                throw new InvalidDirectoryIngestionTransitionError({
                  current,
                  transition: command,
                  message: 'Cannot retry a directory ingestion job with an exhausted attempt budget',
                })
              }
              const next = nextDirectoryIngestionJobStatus(current, command)
              if (next === undefined) {
                throw new InvalidDirectoryIngestionTransitionError({
                  current,
                  transition: command,
                  message: `Cannot ${command} a directory ingestion job in ${current}`,
                })
              }
              const queueStatus = next === 'ready'
                ? 'pending'
                : next === 'paused'
                  ? 'pending'
                  : next === 'cancelled'
                    ? 'cancelled'
                    : 'in-progress'
              await transaction.unsafe(
                `UPDATE directory_ingestion_jobs
                 SET status = $2, updated_at = NOW()
                 WHERE job_id = $1`,
                [input.jobId, next],
              )
              await transaction.unsafe(
                `UPDATE job_queue
                 SET status = $2, lease_token = NULL, lease_expires_at = NULL,
                     updated_at = NOW()
                 WHERE id = $1`,
                [input.jobId, queueStatus],
              )
              await transaction.unsafe(
                `INSERT INTO event_journal (
                   id, workspace_id, entity_type, entity_id, event_type, payload
                 ) VALUES (
                   $1::uuid, $2::uuid, 'directory-ingestion', $3::uuid, $4,
                   jsonb_build_object(
                     'jobId', $3::uuid::text,
                     'command', $5::text,
                     'status', $6::text
                   )
                 )`,
                [
                  input.eventId,
                  input.workspaceId,
                  input.jobId,
                  commandEventType(command),
                  command,
                  next,
                ],
              )
              await transaction.unsafe(
                `INSERT INTO directory_ingestion_commands (
                   job_id, idempotency_key, command, resulting_status, event_id
                 ) VALUES ($1, $2, $3, $4, $5)`,
                [input.jobId, idempotencyKey, command, next, input.eventId],
              )
              return false
            }),
            catch: (cause) =>
              cause instanceof DirectoryControlConflictError
                || cause instanceof InvalidDirectoryIngestionTransitionError
                ? cause
                : queryError('command', cause),
          })
          const status = yield* findStatus(
            input.workspaceId,
            input.projectId,
            input.jobId,
          )
          if (Option.isNone(status)) {
            return yield* new DirectoryControlConflictError({
              reason: 'scope-not-found',
              message: 'Directory ingestion job was not found in this scope',
            })
          }
          return { status: status.value, replayed }
        },
      )

      const listEventsAfter = Effect.fn('DirectoryControlRepo.listEventsAfter')(
        function* (
          workspaceId: typeof WorkspaceId.Type,
          projectId: typeof ProjectId.Type,
          jobId: typeof JobQueueId.Type,
          cursor: bigint,
          limit: number,
        ) {
          const rows = yield* Effect.tryPromise({
            try: () => sql.unsafe(
              `SELECT
                 event.id,
                 event.cursor,
                 event.event_type,
                 FLOOR(EXTRACT(EPOCH FROM event.created_at) * 1000)
                   AS created_at_ms
               FROM event_journal event
               JOIN directory_ingestion_jobs directory
                 ON directory.job_id = event.entity_id
               JOIN directory_roots root
                 ON root.id = directory.directory_root_id
               WHERE event.workspace_id = $1
                 AND root.project_id = $2
                 AND event.entity_type = 'directory-ingestion'
                 AND event.entity_id = $3
                 AND event.cursor > $4
                 AND event.event_type IN (
                   'directory-registered',
                   'directory-entry-checkpointed',
                   'directory-paused',
                   'directory-resumed',
                   'directory-retried',
                   'directory-cancelled',
                   'directory-completed'
                 )
               ORDER BY event.cursor
               LIMIT $5`,
              [workspaceId, projectId, jobId, cursor.toString(), limit],
            ),
            catch: (cause) => queryError('events query', cause),
          })
          return yield* Effect.forEach(rows, (row) =>
            Schema.decodeUnknown(EventRow)(row).pipe(
              Effect.map((event): DirectoryJournalEvent => ({
                id: event.id,
                cursor: event.cursor,
                type: event.event_type,
                createdAt: event.created_at_ms,
              })),
              Effect.mapError((cause) => queryError('event decode', cause)),
            ))
        },
      )

      return { register, findStatus, command, listEventsAfter }
    }),
  },
) {}
