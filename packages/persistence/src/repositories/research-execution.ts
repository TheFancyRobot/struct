import { Effect, Option } from 'effect'
import type {
  Citation,
  EventJournal,
  JobQueue,
  ProjectId,
  ResearchAnswer,
  ResearchRun,
  ResearchThread,
  SourceVersionId,
  WorkspaceId,
} from '@struct/domain'
import { AuthorizationError, ValidationError } from '@struct/domain'
import {
  QueryError,
  ResearchJobOwnershipLostError,
  type PersistenceError,
} from '../errors.js'
import { SqlClient } from '../sql-client.js'
import {
  decodeEventJournalRow,
  decodeJobQueueRow,
  decodeResearchRunRow,
  decodeResearchThreadRow,
  type EventJournalRow,
  type JobQueueRow,
  type ResearchRunRow,
  type ResearchThreadRow,
} from './decode.js'

export interface ResearchRegistrationInput {
  readonly workspaceId: typeof WorkspaceId.Type
  readonly projectId: typeof ProjectId.Type
  readonly sourceVersionIds: ReadonlyArray<typeof SourceVersionId.Type>
  readonly thread: typeof ResearchThread.Type
  readonly run: typeof ResearchRun.Type
  readonly job: typeof JobQueue.Type
  readonly event: typeof EventJournal.Type
}

export interface ResearchRegistrationResult {
  readonly thread: typeof ResearchThread.Type
  readonly run: typeof ResearchRun.Type
  readonly job: typeof JobQueue.Type
  readonly event: typeof EventJournal.Type
}

export interface CompleteResearchInput {
  readonly runId: typeof ResearchRun.Type['id']
  readonly job: typeof JobQueue.Type
  readonly answer: typeof ResearchAnswer.Type
  readonly citations: ReadonlyArray<typeof Citation.Type>
  readonly event: typeof EventJournal.Type
}

export interface FailResearchInput {
  readonly runId: typeof ResearchRun.Type['id']
  readonly job: typeof JobQueue.Type
  readonly event: typeof EventJournal.Type
}

class ResearchScopeMismatchError extends Error {}
class ResearchAggregateMismatchError extends Error {
  constructor(readonly field: string) {
    super(`research-aggregate-mismatch:${field}`)
  }
}

const MAX_RESEARCH_EVIDENCE_COUNT = 80
const MAX_RESEARCH_CITATION_COUNT = 80
const MAX_RESEARCH_FAILURE_TAG_LENGTH = 64
const RESEARCH_FAILURE_MESSAGE = 'Research failed'

type ResearchEventPayload = Readonly<Record<string, unknown>>

function hasExactKeys(
  value: unknown,
  expectedKeys: ReadonlyArray<string>,
): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const keys = Object.keys(value)
  return keys.length === expectedKeys.length
    && expectedKeys.every((key) => Object.hasOwn(value, key))
}

function boundedInteger(value: unknown, maximum: number): value is number {
  return typeof value === 'number'
    && Number.isSafeInteger(value)
    && value >= 0
    && value <= maximum
}

function persistedResearchScope(payload: unknown): {
  readonly projectId: typeof ProjectId.Type
  readonly sourceVersionIds: ReadonlyArray<typeof SourceVersionId.Type>
} {
  const normalized = normalizePersistedPayload(payload)
  if (
    normalized === undefined
    || !hasExactKeys(normalized, ['projectId', 'sourceVersionIds'])
    || typeof normalized['projectId'] !== 'string'
    || !Array.isArray(normalized['sourceVersionIds'])
    || normalized['sourceVersionIds'].length === 0
    || normalized['sourceVersionIds'].length > 10
    || normalized['sourceVersionIds'].some((sourceVersionId) =>
      typeof sourceVersionId !== 'string'
    )
    || new Set(normalized['sourceVersionIds']).size
      !== normalized['sourceVersionIds'].length
  ) {
    throw new ResearchAggregateMismatchError('job.payload')
  }
  return {
    projectId: normalized['projectId'] as typeof ProjectId.Type,
    sourceVersionIds:
      normalized['sourceVersionIds'] as ReadonlyArray<typeof SourceVersionId.Type>,
  }
}

function validateAppendEventPayload(
  event: typeof EventJournal.Type,
  registeredSourceVersionIds: ReadonlyArray<typeof SourceVersionId.Type>,
  job: typeof JobQueue.Type,
): ResearchEventPayload {
  if (event.cursor !== 0n) {
    throw new ResearchAggregateMismatchError('event.cursor')
  }
  if (event.eventType === 'retrieval-completed') {
    if (
      !hasExactKeys(event.payload, ['evidenceCount', 'sourceVersionIds'])
      || !boundedInteger(
        event.payload['evidenceCount'],
        MAX_RESEARCH_EVIDENCE_COUNT,
      )
      || !Array.isArray(event.payload['sourceVersionIds'])
      || event.payload['sourceVersionIds'].length !== event.payload['evidenceCount']
      || event.payload['sourceVersionIds'].some((sourceVersionId) =>
        typeof sourceVersionId !== 'string'
        || !registeredSourceVersionIds.includes(
          sourceVersionId as typeof SourceVersionId.Type,
        )
      )
    ) {
      throw new ResearchAggregateMismatchError('event.payload')
    }
    return {
      jobId: job.id,
      attempt: job.attempts,
      evidenceCount: event.payload['evidenceCount'],
      sourceVersionIds: [...event.payload['sourceVersionIds']],
    }
  }
  if (event.eventType === 'citations-validated') {
    if (
      !hasExactKeys(event.payload, ['citationCount'])
      || !boundedInteger(
        event.payload['citationCount'],
        MAX_RESEARCH_CITATION_COUNT,
      )
    ) {
      throw new ResearchAggregateMismatchError('event.payload')
    }
    return {
      jobId: job.id,
      attempt: job.attempts,
      citationCount: event.payload['citationCount'],
    }
  }
  throw new ResearchAggregateMismatchError('event.eventType')
}

function validateCompletedEventPayload(
  event: typeof EventJournal.Type,
  citationCount: number,
  job: typeof JobQueue.Type,
): ResearchEventPayload {
  if (
    event.cursor !== 0n
    || event.eventType !== 'research-completed'
    || !hasExactKeys(event.payload, ['citationCount'])
    || event.payload['citationCount'] !== citationCount
    || !boundedInteger(
      event.payload['citationCount'],
      MAX_RESEARCH_CITATION_COUNT,
    )
  ) {
    throw new ResearchAggregateMismatchError('event.payload')
  }
  return { jobId: job.id, attempt: job.attempts, citationCount }
}

function validateFailedEventPayload(
  event: typeof EventJournal.Type,
  job: typeof JobQueue.Type,
): ResearchEventPayload {
  if (
    event.cursor !== 0n
    || event.eventType !== 'research-failed'
    || !hasExactKeys(event.payload, ['errorTag', 'message'])
    || typeof event.payload['errorTag'] !== 'string'
    || event.payload['errorTag'].length === 0
    || event.payload['errorTag'].length > MAX_RESEARCH_FAILURE_TAG_LENGTH
    || !/^[A-Za-z][A-Za-z0-9]*$/.test(event.payload['errorTag'])
    || event.payload['message'] !== RESEARCH_FAILURE_MESSAGE
  ) {
    throw new ResearchAggregateMismatchError('event.payload')
  }
  return {
    jobId: job.id,
    attempt: job.attempts,
    errorTag: event.payload['errorTag'],
    message: RESEARCH_FAILURE_MESSAGE,
  }
}

function ownershipLost(
  transition: 'renew-lease' | 'append-event' | 'complete' | 'fail',
): ResearchJobOwnershipLostError {
  return new ResearchJobOwnershipLostError({
    transition,
    message: 'Research job no longer has in-progress ownership',
  })
}

function sameIds(
  left: ReadonlyArray<typeof SourceVersionId.Type>,
  right: unknown,
): boolean {
  return Array.isArray(right)
    && right.length === left.length
    && right.every((value, index) => value === left[index])
}

function normalizePersistedPayload(payload: unknown): Record<string, unknown> | undefined {
  let decoded = payload
  if (typeof decoded === 'string') {
    try {
      decoded = JSON.parse(decoded) as unknown
    } catch {
      return undefined
    }
  }
  return typeof decoded === 'object'
      && decoded !== null
      && !Array.isArray(decoded)
    ? decoded as Record<string, unknown>
    : undefined
}

function completionSourceScope(input: CompleteResearchInput): {
  readonly projectId: typeof ProjectId.Type
  readonly sourceVersionIds: ReadonlyArray<typeof SourceVersionId.Type>
} {
  return persistedResearchScope(input.job.payload)
}

function validateRegistrationAggregate(input: ResearchRegistrationInput): void {
  const payloadProjectId = input.job.payload['projectId']
  const payloadSourceVersionIds = input.job.payload['sourceVersionIds']
  const eventJobId = input.event.payload['jobId']
  const eventThreadId = input.event.payload['threadId']
  const uniqueSourceVersionIds = new Set(input.sourceVersionIds)
  const checks: ReadonlyArray<readonly [boolean, string]> = [
    [
      input.sourceVersionIds.length > 0
      && input.sourceVersionIds.length <= 10
      && uniqueSourceVersionIds.size === input.sourceVersionIds.length,
      'sourceVersionIds',
    ],
    [input.thread.projectId === input.projectId, 'thread.projectId'],
    [input.run.threadId === input.thread.id, 'run.threadId'],
    [input.run.status === 'pending', 'run.status'],
    [input.job.workspaceId === input.workspaceId, 'job.workspaceId'],
    [input.job.entityType === 'research', 'job.entityType'],
    [input.job.entityId === input.run.id, 'job.entityId'],
    [input.job.status === 'pending', 'job.status'],
    [input.job.attempts === 0, 'job.attempts'],
    [payloadProjectId === input.projectId, 'job.payload.projectId'],
    [
      hasExactKeys(input.job.payload, ['projectId', 'sourceVersionIds']),
      'job.payload',
    ],
    [sameIds(input.sourceVersionIds, payloadSourceVersionIds), 'job.payload.sourceVersionIds'],
    [input.event.workspaceId === input.workspaceId, 'event.workspaceId'],
    [input.event.entityType === 'research', 'event.entityType'],
    [input.event.entityId === input.run.id, 'event.entityId'],
    [input.event.eventType === 'research-started', 'event.eventType'],
    [input.event.cursor === 0n, 'event.cursor'],
    [
      hasExactKeys(input.event.payload, ['jobId', 'threadId']),
      'event.payload',
    ],
    [eventJobId === input.job.id, 'event.payload.jobId'],
    [eventThreadId === input.thread.id, 'event.payload.threadId'],
  ]
  const mismatch = checks.find(([valid]) => !valid)
  if (mismatch !== undefined) {
    throw new ResearchAggregateMismatchError(mismatch[1])
  }
}

function validateOwnedEvent(
  job: typeof JobQueue.Type,
  runId: typeof ResearchRun.Type['id'],
  event: typeof EventJournal.Type,
  transition: 'append-event' | 'complete' | 'fail',
): void {
  if (
    job.entityType !== 'research'
    || job.status !== 'in-progress'
    || job.entityId !== runId
    || event.workspaceId !== job.workspaceId
    || event.entityType !== 'research'
    || event.entityId !== runId
  ) {
    throw ownershipLost(transition)
  }
}

function validateCompletionAggregate(input: CompleteResearchInput): void {
  const answerCitations = input.answer.citations
  const sourceScope = completionSourceScope(input)
  if (answerCitations.length !== input.citations.length) {
    throw new ResearchAggregateMismatchError('citations')
  }
  if (new Set(input.citations.map((citation) => citation.id)).size !== input.citations.length) {
    throw new ResearchAggregateMismatchError('citations.id')
  }
  for (const [index, citation] of input.citations.entries()) {
    const answerCitation = answerCitations[index]
    if (
      citation.runId !== input.runId
      || citation.status !== 'validated'
      || answerCitation === undefined
      || citation.sourceVersionId !== answerCitation.sourceVersionId
      || citation.locator !== answerCitation.locator
      || !sourceScope.sourceVersionIds.includes(citation.sourceVersionId)
    ) {
      throw new ResearchAggregateMismatchError(`citations[${index}]`)
    }
  }
}

function persistenceDecodeError(
  operation: string,
  error: import('./decode.js').DecodeError,
): QueryError {
  return new QueryError({
    operation,
    entity: 'ResearchExecution',
    message: error.message,
  })
}

export class ResearchExecutionRepo extends Effect.Service<ResearchExecutionRepo>()('ResearchExecutionRepo', {
  accessors: true,
  effect: Effect.gen(function* () {
    const sql = yield* SqlClient

    const register = Effect.fn('ResearchExecutionRepo.register')(function* (
      input: ResearchRegistrationInput,
    ) {
      const rows = yield* Effect.tryPromise({
        try: () =>
          sql.transaction(async (transaction) => {
            validateRegistrationAggregate(input)
            const authorized = await transaction.unsafe(
              `SELECT COUNT(*)::int AS count
               FROM source_versions sv
               JOIN sources s ON s.id = sv.source_id
               JOIN projects p ON p.id = s.project_id
               WHERE p.id = $1
                 AND p.workspace_id = $2
                 AND sv.id = ANY($3::uuid[])`,
              [input.projectId, input.workspaceId, input.sourceVersionIds],
            )
            if (Number(authorized[0]?.['count']) !== input.sourceVersionIds.length) {
              throw new ResearchScopeMismatchError('research-source-scope-mismatch')
            }
            const threadRows = await transaction.unsafe(
              `INSERT INTO research_threads (id, project_id, title, created_at, updated_at)
               VALUES ($1, $2, $3, to_timestamp($4 / 1000.0), to_timestamp($5 / 1000.0))
               RETURNING *`,
              [
                input.thread.id,
                input.thread.projectId,
                input.thread.title,
                Number(input.thread.createdAt),
                Number(input.thread.updatedAt),
              ],
            )
            const runRows = await transaction.unsafe(
              `INSERT INTO research_runs (id, thread_id, question, status, created_at, updated_at)
               VALUES ($1, $2, $3, $4, to_timestamp($5 / 1000.0), to_timestamp($6 / 1000.0))
               RETURNING *`,
              [
                input.run.id,
                input.run.threadId,
                input.run.question,
                input.run.status,
                Number(input.run.createdAt),
                Number(input.run.updatedAt),
              ],
            )
            const jobRows = await transaction.unsafe(
              `INSERT INTO job_queue (id, workspace_id, entity_type, entity_id, status, payload, attempts, max_attempts, created_at, updated_at)
               VALUES ($1, $2, 'research', $3, $4, $5::jsonb, $6, $7, to_timestamp($8 / 1000.0), to_timestamp($9 / 1000.0))
               RETURNING *`,
              [
                input.job.id,
                input.job.workspaceId,
                input.job.entityId,
                input.job.status,
                JSON.stringify(input.job.payload),
                input.job.attempts,
                input.job.maxAttempts,
                Number(input.job.createdAt),
                Number(input.job.updatedAt),
              ],
            )
            const eventRows = await transaction.unsafe(
              `INSERT INTO event_journal (id, workspace_id, entity_type, entity_id, event_type, payload, created_at)
               VALUES ($1, $2, 'research', $3, $4, $5::jsonb, to_timestamp($6 / 1000.0))
               RETURNING *`,
              [
                input.event.id,
                input.event.workspaceId,
                input.event.entityId,
                input.event.eventType,
                JSON.stringify(input.event.payload),
                Number(input.event.createdAt),
              ],
            )
            return {
              thread: threadRows[0] as unknown as ResearchThreadRow,
              run: runRows[0] as unknown as ResearchRunRow,
              job: jobRows[0] as unknown as JobQueueRow,
              event: eventRows[0] as unknown as EventJournalRow,
            }
          }),
        catch: (error) =>
          error instanceof ResearchScopeMismatchError
            ? new AuthorizationError({
                detail: 'research-source-scope-mismatch',
                message: 'One or more source versions are outside the requested scope',
              })
            : error instanceof ResearchAggregateMismatchError
              ? new ValidationError({
                  field: error.field,
                  reason: 'research-aggregate-mismatch',
                  message: 'Research registration aggregate is inconsistent',
                })
            : new QueryError({
                operation: 'registerResearch',
                entity: 'ResearchExecution',
                message: 'Atomic research registration failed',
              }),
      })
      const [thread, run, job, event] = yield* Effect.all([
        decodeResearchThreadRow(rows.thread),
        decodeResearchRunRow(rows.run),
        decodeJobQueueRow(rows.job),
        decodeEventJournalRow(rows.event),
      ]).pipe(
        Effect.mapError((error) => persistenceDecodeError('registerResearch.decode', error)),
      )
      return { thread, run, job, event }
    })

    const claimNext = Effect.fn('ResearchExecutionRepo.claimNext')(function* () {
      const rows = yield* Effect.tryPromise({
        try: () =>
          sql.transaction(async (transaction) => {
            const claimedRows = await transaction.unsafe(
              `WITH next_job AS (
                 SELECT id FROM job_queue
                 WHERE entity_type = 'research' AND status = 'pending'
                 ORDER BY created_at ASC
                 FOR UPDATE SKIP LOCKED
                 LIMIT 1
               )
               UPDATE job_queue
               SET status = 'in-progress', attempts = attempts + 1, updated_at = NOW()
               WHERE id IN (SELECT id FROM next_job)
               RETURNING *`,
            )
            if (claimedRows.length === 0) return claimedRows
            const runRows = await transaction.unsafe(
              `UPDATE research_runs
               SET status = 'in-progress', updated_at = NOW()
               WHERE id = $1 AND status = 'pending'
               RETURNING id`,
              [claimedRows[0]?.['entity_id']],
            )
            if (runRows.length !== 1) {
              throw new Error('research-run-claim-transition-conflict')
            }
            return claimedRows
          }),
        catch: () =>
          new QueryError({
            operation: 'claimNextResearch',
            entity: 'ResearchExecution',
            message: 'Research job claim failed',
          }),
      })
      if (rows.length === 0) return Option.none<typeof JobQueue.Type>()
      const job = yield* decodeJobQueueRow(rows[0] as unknown as JobQueueRow).pipe(
        Effect.mapError((error) => persistenceDecodeError('claimNextResearch.decode', error)),
      )
      return Option.some(job)
    })

    const recoverStale = Effect.fn('ResearchExecutionRepo.recoverStale')(function* (
      staleAfterMs: number,
    ) {
      const rows = yield* Effect.tryPromise({
        try: () =>
          sql.transaction(async (transaction) => {
            const staleRows = await transaction.unsafe(
              `UPDATE job_queue
               SET status = 'failed', updated_at = NOW()
               WHERE entity_type = 'research'
                 AND status = 'in-progress'
                 AND updated_at < NOW() - ($1::bigint * INTERVAL '1 millisecond')
               RETURNING *`,
              [staleAfterMs],
            )
            if (staleRows.length === 0) return staleRows

            const jobIds = staleRows.map((row) => row['id'])
            const runIds = staleRows.map((row) => row['entity_id'])
            const runRows = await transaction.unsafe(
              `UPDATE research_runs
               SET status = 'failed', updated_at = NOW()
               WHERE id = ANY($1::uuid[])
                 AND status IN ('pending', 'in-progress')
               RETURNING id`,
              [runIds],
            )
            if (runRows.length !== staleRows.length) {
              throw new Error('stale-research-run-transition-conflict')
            }
            const eventRows = await transaction.unsafe(
              `INSERT INTO event_journal
                 (id, workspace_id, entity_type, entity_id, event_type, payload, created_at)
               SELECT
                 md5(j.id::text || ':research-stale')::uuid,
                 j.workspace_id,
                 'research',
                 j.entity_id,
                 'research-failed',
                 jsonb_build_object(
                   'jobId', j.id::text,
                   'attempt', j.attempts,
                   'errorTag', 'ResearchJobStaleError',
                   'message', 'Research failed'
                 ),
                 NOW()
               FROM job_queue j
               WHERE j.id = ANY($1::uuid[])
               ON CONFLICT (id) DO NOTHING
               RETURNING id`,
              [jobIds],
            )
            if (eventRows.length !== staleRows.length) {
              throw new Error('stale-research-event-transition-conflict')
            }
            return staleRows
          }),
        catch: () =>
          new QueryError({
            operation: 'recoverStaleResearch',
            entity: 'ResearchExecution',
            message: 'Stale research recovery failed',
          }),
      })
      return yield* Effect.forEach(rows, (row) =>
        decodeJobQueueRow(row as unknown as JobQueueRow).pipe(
          Effect.mapError((error) =>
            persistenceDecodeError('recoverStaleResearch.decode', error),
          ),
        ),
      )
    })

    const renewLease = Effect.fn('ResearchExecutionRepo.renewLease')(function* (
      job: typeof JobQueue.Type,
    ) {
      yield* Effect.tryPromise({
        try: async () => {
          const rows = await sql.unsafe(
            `UPDATE job_queue
             SET updated_at = NOW()
             WHERE id = $1
               AND entity_type = 'research'
               AND entity_id = $2
               AND workspace_id = $3
               AND status = 'in-progress'
               AND attempts = $4
             RETURNING id`,
            [job.id, job.entityId, job.workspaceId, job.attempts],
          )
          if (rows.length !== 1) {
            throw ownershipLost('renew-lease')
          }
        },
        catch: (error) =>
          error instanceof ResearchJobOwnershipLostError
            ? error
            : new QueryError({
                operation: 'renewResearchLease',
                entity: 'ResearchExecution',
                message: 'Research lease renewal failed',
              }),
      })
    })

    const appendInProgressEvent = Effect.fn(
      'ResearchExecutionRepo.appendInProgressEvent',
    )(function* (
      job: typeof JobQueue.Type,
      event: typeof EventJournal.Type,
    ) {
      yield* Effect.tryPromise({
        try: () =>
          sql.transaction(async (transaction) => {
            validateOwnedEvent(
              job,
              job.entityId as typeof ResearchRun.Type['id'],
              event,
              'append-event',
            )
            const ownership = await transaction.unsafe(
              `SELECT id, payload
               FROM job_queue
               WHERE id = $1
                 AND entity_type = 'research'
                 AND entity_id = $2
                 AND workspace_id = $3
                 AND status = 'in-progress'
                 AND attempts = $4
               FOR UPDATE`,
              [job.id, job.entityId, job.workspaceId, job.attempts],
            )
            if (ownership.length !== 1) {
              throw ownershipLost('append-event')
            }
            const persistedScope = persistedResearchScope(
              ownership[0]?.['payload'],
            )
            const persistedEventPayload = validateAppendEventPayload(
              event,
              persistedScope.sourceVersionIds,
              job,
            )
            await transaction.unsafe(
              `INSERT INTO event_journal
                 (id, workspace_id, entity_type, entity_id, event_type, payload, created_at)
               VALUES ($1, $2, 'research', $3, $4, $5::jsonb, to_timestamp($6 / 1000.0))`,
              [
                event.id,
                job.workspaceId,
                job.entityId,
                event.eventType,
                JSON.stringify(persistedEventPayload),
                Number(event.createdAt),
              ],
            )
          }),
        catch: (error) =>
          error instanceof ResearchJobOwnershipLostError
            ? error
            : error instanceof ResearchAggregateMismatchError
              ? new ValidationError({
                  field: error.field,
                  reason: 'research-event-contract-mismatch',
                  message: 'Research event contract is inconsistent',
                })
              : new QueryError({
                  operation: 'appendInProgressResearchEvent',
                  entity: 'ResearchExecution',
                  message: 'Research event append failed',
                }),
      })
    })

    const complete = Effect.fn('ResearchExecutionRepo.complete')(function* (
      input: CompleteResearchInput,
    ) {
      yield* Effect.tryPromise({
        try: () =>
          sql.transaction(async (transaction) => {
            validateOwnedEvent(input.job, input.runId, input.event, 'complete')
            validateCompletionAggregate(input)
            const sourceScope = completionSourceScope(input)
            const ownershipRows = await transaction.unsafe(
              `SELECT jq.payload, rt.project_id
               FROM job_queue jq
               JOIN research_runs rr ON rr.id = jq.entity_id
               JOIN research_threads rt ON rt.id = rr.thread_id
               WHERE jq.id = $1
                 AND jq.entity_type = 'research'
                 AND jq.entity_id = $2
                 AND jq.workspace_id = $3
                 AND jq.status = 'in-progress'
                 AND jq.attempts = $4
                 AND rr.status = 'in-progress'
               FOR UPDATE OF jq, rr`,
              [
                input.job.id,
                input.runId,
                input.job.workspaceId,
                input.job.attempts,
              ],
            )
            if (ownershipRows.length !== 1) {
              throw ownershipLost('complete')
            }
            const persistedEventPayload = validateCompletedEventPayload(
              input.event,
              input.citations.length,
              input.job,
            )
            const persistedPayload = normalizePersistedPayload(
              ownershipRows[0]?.['payload'],
            )
            const persistedProjectId = ownershipRows[0]?.['project_id']
            if (
              persistedProjectId !== sourceScope.projectId
              || persistedPayload === undefined
              || persistedPayload['projectId'] !== sourceScope.projectId
              || !sameIds(
                sourceScope.sourceVersionIds,
                persistedPayload['sourceVersionIds'],
              )
            ) {
              throw new ResearchAggregateMismatchError('job.payload')
            }
            const authorizedRows = await transaction.unsafe(
              `SELECT COUNT(DISTINCT sv.id)::int AS count
               FROM source_versions sv
               JOIN sources s ON s.id = sv.source_id
               JOIN projects p ON p.id = s.project_id
               WHERE p.id = $1
                 AND p.workspace_id = $2
                 AND sv.id = ANY($3::uuid[])`,
              [
                sourceScope.projectId,
                input.job.workspaceId,
                sourceScope.sourceVersionIds,
              ],
            )
            if (Number(authorizedRows[0]?.['count']) !== sourceScope.sourceVersionIds.length) {
              throw new ResearchScopeMismatchError('research-source-scope-mismatch')
            }
            const validationEventRows = await transaction.unsafe(
              `SELECT payload
               FROM event_journal
               WHERE workspace_id = $1
                 AND entity_type = 'research'
                 AND entity_id = $2
                 AND event_type = 'citations-validated'
               ORDER BY cursor DESC
               LIMIT 1`,
              [input.job.workspaceId, input.runId],
            )
            if (validationEventRows.length !== 1) {
              throw new ResearchAggregateMismatchError(
                'event.citations-validated',
              )
            }
            const validatedCitationPayload = normalizePersistedPayload(
              validationEventRows[0]?.['payload'],
            )
            if (
              validatedCitationPayload === undefined
              || !hasExactKeys(
                validatedCitationPayload,
                ['jobId', 'attempt', 'citationCount'],
              )
              || validatedCitationPayload['jobId'] !== input.job.id
              || validatedCitationPayload['attempt'] !== input.job.attempts
              || validatedCitationPayload['citationCount'] !== input.citations.length
              || !boundedInteger(
                validatedCitationPayload['citationCount'],
                MAX_RESEARCH_CITATION_COUNT,
              )
            ) {
              throw new ResearchAggregateMismatchError(
                'event.citations-validated.payload',
              )
            }
            const jobRows = await transaction.unsafe(
              `UPDATE job_queue
               SET status = 'completed', updated_at = NOW()
               WHERE id = $1
                 AND entity_type = 'research'
                 AND entity_id = $2
                 AND workspace_id = $3
                 AND status = 'in-progress'
                 AND attempts = $4
               RETURNING id`,
              [
                input.job.id,
                input.runId,
                input.job.workspaceId,
                input.job.attempts,
              ],
            )
            if (jobRows.length !== 1) {
              throw ownershipLost('complete')
            }
            const runRows = await transaction.unsafe(
              `UPDATE research_runs
               SET status = 'completed', updated_at = NOW()
               WHERE id = $1 AND status = 'in-progress'
               RETURNING id`,
              [input.runId],
            )
            if (runRows.length !== 1) {
              throw new Error('research-run-completion-transition-conflict')
            }
            const resultRows = await transaction.unsafe(
              `INSERT INTO research_run_results (run_id, answer, citations)
               VALUES ($1, $2, $3::jsonb)
               RETURNING run_id`,
              [input.runId, input.answer.answer, JSON.stringify(input.answer.citations)],
            )
            if (resultRows.length !== 1) {
              throw new Error('research-result-insert-conflict')
            }
            for (const citation of input.citations) {
              const citationRows = await transaction.unsafe(
                `INSERT INTO citations (id, run_id, source_version_id, locator, status, created_at)
                 VALUES ($1, $2, $3, $4, 'validated', to_timestamp($5 / 1000.0))
                 RETURNING id`,
                [
                  citation.id,
                  input.runId,
                  citation.sourceVersionId,
                  citation.locator,
                  Number(citation.createdAt),
                ],
              )
              if (citationRows.length !== 1) {
                throw new Error('research-citation-insert-conflict')
              }
            }
            await transaction.unsafe(
              `INSERT INTO event_journal (id, workspace_id, entity_type, entity_id, event_type, payload, created_at)
               VALUES ($1, $2, 'research', $3, $4, $5::jsonb, to_timestamp($6 / 1000.0))`,
              [
                input.event.id,
                input.job.workspaceId,
                input.runId,
                input.event.eventType,
                JSON.stringify(persistedEventPayload),
                Number(input.event.createdAt),
              ],
            )
          }),
        catch: (error) =>
          error instanceof ResearchJobOwnershipLostError
            ? error
            : error instanceof ResearchScopeMismatchError
              ? new AuthorizationError({
                  detail: 'research-source-scope-mismatch',
                  message: 'One or more source versions are outside the research job scope',
                })
            : error instanceof ResearchAggregateMismatchError
              ? new ValidationError({
                  field: error.field,
                  reason: 'research-aggregate-mismatch',
                  message: 'Research completion aggregate is inconsistent',
                })
            : new QueryError({
                operation: 'completeResearch',
                entity: 'ResearchExecution',
                message: 'Atomic research completion failed',
              }),
      })
    })

    const fail = Effect.fn('ResearchExecutionRepo.fail')(function* (input: FailResearchInput) {
      yield* Effect.tryPromise({
        try: () =>
          sql.transaction(async (transaction) => {
            validateOwnedEvent(input.job, input.runId, input.event, 'fail')
            const ownershipRows = await transaction.unsafe(
              `SELECT id
               FROM job_queue
               WHERE id = $1
                 AND entity_type = 'research'
                 AND entity_id = $2
                 AND workspace_id = $3
                 AND status = 'in-progress'
                 AND attempts = $4
               FOR UPDATE`,
              [
                input.job.id,
                input.runId,
                input.job.workspaceId,
                input.job.attempts,
              ],
            )
            if (ownershipRows.length !== 1) {
              throw ownershipLost('fail')
            }
            const persistedEventPayload = validateFailedEventPayload(
              input.event,
              input.job,
            )
            const jobRows = await transaction.unsafe(
              `UPDATE job_queue
               SET status = 'failed', updated_at = NOW()
               WHERE id = $1
                 AND entity_type = 'research'
                 AND entity_id = $2
                 AND workspace_id = $3
                 AND status = 'in-progress'
                 AND attempts = $4
               RETURNING id`,
              [
                input.job.id,
                input.runId,
                input.job.workspaceId,
                input.job.attempts,
              ],
            )
            if (jobRows.length !== 1) {
              throw ownershipLost('fail')
            }
            const runRows = await transaction.unsafe(
              `UPDATE research_runs
               SET status = 'failed', updated_at = NOW()
               WHERE id = $1 AND status = 'in-progress'
               RETURNING id`,
              [input.runId],
            )
            if (runRows.length !== 1) {
              throw new Error('research-run-failure-transition-conflict')
            }
            await transaction.unsafe(
              `INSERT INTO event_journal (id, workspace_id, entity_type, entity_id, event_type, payload, created_at)
               VALUES ($1, $2, 'research', $3, $4, $5::jsonb, to_timestamp($6 / 1000.0))`,
              [
                input.event.id,
                input.job.workspaceId,
                input.runId,
                input.event.eventType,
                JSON.stringify(persistedEventPayload),
                Number(input.event.createdAt),
              ],
            )
          }),
        catch: (error) =>
          error instanceof ResearchJobOwnershipLostError
            ? error
            : error instanceof ResearchAggregateMismatchError
              ? new ValidationError({
                  field: error.field,
                  reason: 'research-event-contract-mismatch',
                  message: 'Research failure event contract is inconsistent',
                })
              : new QueryError({
                  operation: 'failResearch',
                  entity: 'ResearchExecution',
                  message: 'Atomic research failure persistence failed',
                }),
      })
    })

    return {
      register,
      recoverStale,
      claimNext,
      renewLease,
      appendInProgressEvent,
      complete,
      fail,
    }
  }),
}) {}

export type ResearchExecutionError = PersistenceError | AuthorizationError | ValidationError
