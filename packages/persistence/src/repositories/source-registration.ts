import { Effect } from 'effect'
import type {
  EventJournal,
  JobQueue,
  Source,
  SourceUploadMediaType,
} from '@struct/domain'
import {
  AuthorizationError,
  isCanonicalStagedArtifactRef,
  isSupportedSourceUpload,
  ValidationError,
} from '@struct/domain'
import { QueryError, type PersistenceError } from '../errors.js'
import { SqlClient } from '../sql-client.js'
import {
  decodeEventJournalRow,
  decodeJobQueueRow,
  decodeSourceRow,
  type EventJournalRow,
  type JobQueueRow,
  type SourceRow,
} from './decode.js'

export interface SourceRegistrationInput {
  readonly source: typeof Source.Type
  readonly job: typeof JobQueue.Type
  readonly event: typeof EventJournal.Type
}

export type SourceRegistrationMediaType = SourceUploadMediaType

export interface SourceRegistrationJobPayload {
  readonly stagedRef: `staged://${string}/${string}`
  readonly name: string
  readonly mediaType: SourceRegistrationMediaType
  readonly byteLength: number
  readonly sourceId: typeof Source.Type['id']
  readonly projectId: typeof Source.Type['projectId']
}

export interface SourceRegistrationEventPayload {
  readonly sourceId: typeof Source.Type['id']
  readonly jobId: typeof JobQueue.Type['id']
  readonly stagedRef: `staged://${string}/${string}`
  readonly mediaType: SourceRegistrationMediaType
  readonly byteLength: number
}

export interface SourceRegistrationResult {
  readonly source: typeof Source.Type
  readonly job: typeof JobQueue.Type
  readonly event: typeof EventJournal.Type
}

export interface SourceRegistrationRepository {
  readonly create: (
    input: SourceRegistrationInput,
  ) => Effect.Effect<SourceRegistrationResult, SourceRegistrationError, never>
}

class SourceRegistrationScopeMismatchError extends Error {}
class SourceRegistrationAggregateMismatchError extends Error {
  constructor(readonly field: string) {
    super(`source-registration-aggregate-mismatch:${field}`)
  }
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const inputKeys = ['event', 'job', 'source'] as const
const sourceKeys = [
  'createdAt',
  'id',
  'kind',
  'name',
  'projectId',
  'updatedAt',
] as const
const jobKeys = [
  'attempts',
  'createdAt',
  'entityId',
  'entityType',
  'id',
  'maxAttempts',
  'payload',
  'status',
  'updatedAt',
  'workspaceId',
] as const
const eventKeys = [
  'createdAt',
  'cursor',
  'entityId',
  'entityType',
  'eventType',
  'id',
  'payload',
  'workspaceId',
] as const
const jobPayloadKeys = [
  'byteLength',
  'mediaType',
  'name',
  'projectId',
  'sourceId',
  'stagedRef',
] as const
const eventPayloadKeys = [
  'byteLength',
  'jobId',
  'mediaType',
  'sourceId',
  'stagedRef',
] as const
const MAX_SOURCE_NAME_LENGTH = 255
const MAX_SOURCE_REGISTRATION_BYTES = 1_073_741_824
const MAX_SOURCE_REGISTRATION_ATTEMPTS = 100

interface ValidatedRegistrationAggregate {
  readonly jobPayload: SourceRegistrationJobPayload
  readonly eventPayload: SourceRegistrationEventPayload
}

function hasExactKeys(
  value: unknown,
  expected: ReadonlyArray<string>,
): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }
  const actual = Object.keys(value).sort()
  const sortedExpected = [...expected].sort()
  return actual.length === sortedExpected.length
    && actual.every((key, index) => key === sortedExpected[index])
}

function isSafeTimestamp(value: unknown): value is bigint {
  return typeof value === 'bigint'
    && value >= 0n
    && value <= BigInt(Number.MAX_SAFE_INTEGER)
}

function isSafeSourceName(value: unknown): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= MAX_SOURCE_NAME_LENGTH
    && !Array.from(value).some((character) => {
      const codePoint = character.codePointAt(0)
      return codePoint !== undefined && (codePoint <= 31 || codePoint === 127)
    })
    && !value.includes('/')
    && !value.includes('\\')
    && value !== '.'
    && value !== '..'
}

function validateRegistrationAggregate(
  input: SourceRegistrationInput,
): ValidatedRegistrationAggregate {
  if (!hasExactKeys(input, inputKeys)) {
    throw new SourceRegistrationAggregateMismatchError('fields')
  }
  if (!hasExactKeys(input.source, sourceKeys)) {
    throw new SourceRegistrationAggregateMismatchError('source.fields')
  }
  if (!hasExactKeys(input.job, jobKeys)) {
    throw new SourceRegistrationAggregateMismatchError('job.fields')
  }
  if (!hasExactKeys(input.job.payload, jobPayloadKeys)) {
    throw new SourceRegistrationAggregateMismatchError('job.payload.fields')
  }
  if (!hasExactKeys(input.event, eventKeys)) {
    throw new SourceRegistrationAggregateMismatchError('event.fields')
  }
  if (!hasExactKeys(input.event.payload, eventPayloadKeys)) {
    throw new SourceRegistrationAggregateMismatchError('event.payload.fields')
  }
  const jobPayload = input.job.payload
  const eventPayload = input.event.payload
  const stagedRef = jobPayload['stagedRef']
  const mediaType = jobPayload['mediaType']
  const byteLength = jobPayload['byteLength']
  const checks: ReadonlyArray<readonly [boolean, string]> = [
    [typeof input.source.id === 'string' && uuidPattern.test(input.source.id), 'source.id'],
    [
      typeof input.source.projectId === 'string'
      && uuidPattern.test(input.source.projectId),
      'source.projectId',
    ],
    [isSafeSourceName(input.source.name), 'source.name'],
    [input.source.kind === 'document', 'source.kind'],
    [isSafeTimestamp(input.source.createdAt), 'source.createdAt'],
    [isSafeTimestamp(input.source.updatedAt), 'source.updatedAt'],
    [typeof input.job.id === 'string' && uuidPattern.test(input.job.id), 'job.id'],
    [
      typeof input.job.workspaceId === 'string'
      && uuidPattern.test(input.job.workspaceId),
      'job.workspaceId',
    ],
    [input.job.entityType === 'ingestion', 'job.entityType'],
    [input.job.entityId === input.source.id, 'job.entityId'],
    [input.job.status === 'pending', 'job.status'],
    [
      typeof input.job.attempts === 'number'
      && Number.isSafeInteger(input.job.attempts)
      && input.job.attempts === 0,
      'job.attempts',
    ],
    [
      typeof input.job.maxAttempts === 'number'
      && Number.isSafeInteger(input.job.maxAttempts)
      && input.job.maxAttempts > 0
      && input.job.maxAttempts <= MAX_SOURCE_REGISTRATION_ATTEMPTS,
      'job.maxAttempts',
    ],
    [isSafeTimestamp(input.job.createdAt), 'job.createdAt'],
    [isSafeTimestamp(input.job.updatedAt), 'job.updatedAt'],
    [jobPayload['sourceId'] === input.source.id, 'job.payload.sourceId'],
    [jobPayload['projectId'] === input.source.projectId, 'job.payload.projectId'],
    [jobPayload['name'] === input.source.name, 'job.payload.name'],
    [isCanonicalStagedArtifactRef(stagedRef), 'job.payload.stagedRef'],
    [
      isSupportedSourceUpload(jobPayload['name'], mediaType),
      'job.payload.mediaType',
    ],
    [
      typeof byteLength === 'number'
      && Number.isSafeInteger(byteLength)
      && byteLength >= 0
      && byteLength <= MAX_SOURCE_REGISTRATION_BYTES,
      'job.payload.byteLength',
    ],
    [
      typeof input.event.id === 'string' && uuidPattern.test(input.event.id),
      'event.id',
    ],
    [input.event.workspaceId === input.job.workspaceId, 'event.workspaceId'],
    [input.event.entityType === 'ingestion', 'event.entityType'],
    [input.event.entityId === input.source.id, 'event.entityId'],
    [input.event.eventType === 'ingestion-requested', 'event.eventType'],
    [typeof input.event.cursor === 'bigint' && input.event.cursor === 0n, 'event.cursor'],
    [isSafeTimestamp(input.event.createdAt), 'event.createdAt'],
    [eventPayload['sourceId'] === input.source.id, 'event.payload.sourceId'],
    [eventPayload['jobId'] === input.job.id, 'event.payload.jobId'],
    [eventPayload['stagedRef'] === stagedRef, 'event.payload.stagedRef'],
    [eventPayload['mediaType'] === mediaType, 'event.payload.mediaType'],
    [eventPayload['byteLength'] === byteLength, 'event.payload.byteLength'],
  ]
  const mismatch = checks.find(([valid]) => !valid)
  if (mismatch !== undefined) {
    throw new SourceRegistrationAggregateMismatchError(mismatch[1])
  }
  const canonicalStagedRef = stagedRef as `staged://${string}/${string}`
  const canonicalMediaType = mediaType as 'text/plain' | 'text/markdown'
  return {
    jobPayload: {
      stagedRef: canonicalStagedRef,
      name: input.source.name,
      mediaType: canonicalMediaType,
      byteLength: byteLength as number,
      sourceId: input.source.id,
      projectId: input.source.projectId,
    },
    eventPayload: {
      sourceId: input.source.id,
      jobId: input.job.id,
      stagedRef: canonicalStagedRef,
      mediaType: canonicalMediaType,
      byteLength: byteLength as number,
    },
  }
}

export class SourceRegistrationRepo extends Effect.Service<SourceRegistrationRepo>()('SourceRegistrationRepo', {
  accessors: true,
  effect: Effect.gen(function* () {
    const sql = yield* SqlClient

    const create = Effect.fn('SourceRegistrationRepo.create')(function* (input: SourceRegistrationInput) {
      return yield* Effect.tryPromise({
        try: () =>
          sql.transaction(async (transaction) => {
            const validated = validateRegistrationAggregate(input)
            const projectRows = await transaction.unsafe(
              `SELECT id, workspace_id
               FROM projects
               WHERE id = $1
               FOR SHARE`,
              [input.source.projectId],
            )
            const authorizedProject = projectRows[0]
            if (
              authorizedProject === undefined
              || authorizedProject['workspace_id'] !== input.job.workspaceId
            ) {
              throw new SourceRegistrationScopeMismatchError(
                'source-registration-project-workspace-mismatch',
              )
            }
            const projectId = String(authorizedProject['id'])
            const workspaceId = String(authorizedProject['workspace_id'])
            const sourceRows = await transaction.unsafe(
              `INSERT INTO sources (id, project_id, name, kind, created_at, updated_at)
               VALUES ($1, $2, $3, $4, to_timestamp($5 / 1000.0), to_timestamp($6 / 1000.0))
               RETURNING *`,
              [
                input.source.id,
                projectId,
                input.source.name,
                input.source.kind,
                Number(input.source.createdAt),
                Number(input.source.updatedAt),
              ],
            )
            const jobRows = await transaction.unsafe(
              `INSERT INTO job_queue (id, workspace_id, entity_type, entity_id, status, payload, attempts, max_attempts, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, to_timestamp($9 / 1000.0), to_timestamp($10 / 1000.0))
               RETURNING *`,
              [
                input.job.id,
                workspaceId,
                'ingestion',
                input.source.id,
                input.job.status,
                JSON.stringify(validated.jobPayload),
                input.job.attempts,
                input.job.maxAttempts,
                Number(input.job.createdAt),
                Number(input.job.updatedAt),
              ],
            )
            const eventRows = await transaction.unsafe(
              `INSERT INTO event_journal (id, workspace_id, entity_type, entity_id, event_type, payload, created_at)
               VALUES ($1, $2, $3, $4, $5, $6::jsonb, to_timestamp($7 / 1000.0))
               RETURNING *`,
              [
                input.event.id,
                workspaceId,
                'ingestion',
                input.source.id,
                'ingestion-requested',
                JSON.stringify(validated.eventPayload),
                Number(input.event.createdAt),
              ],
            )
            const source = await Effect.runPromise(
              decodeSourceRow(sourceRows[0] as unknown as SourceRow),
            )
            const job = await Effect.runPromise(
              decodeJobQueueRow(jobRows[0] as unknown as JobQueueRow),
            )
            const event = await Effect.runPromise(
              decodeEventJournalRow(eventRows[0] as unknown as EventJournalRow),
            )
            return { source, job, event }
          }),
        catch: (error) =>
          error instanceof SourceRegistrationScopeMismatchError
            ? new AuthorizationError({
                detail: 'source-registration-project-workspace-mismatch',
                message: 'Project does not belong to the source registration workspace',
              })
            : error instanceof SourceRegistrationAggregateMismatchError
              ? new ValidationError({
                  field: error.field,
                  reason: 'source-registration-aggregate-mismatch',
                  message: 'Source registration aggregate is inconsistent',
                })
              : new QueryError({
                  operation: 'createSourceRegistration',
                  entity: 'SourceRegistration',
                  message: 'Atomic source registration failed',
                }),
      })
    })

    return { create }
  }),
}) {}

export type SourceRegistrationError =
  | PersistenceError
  | AuthorizationError
  | ValidationError
