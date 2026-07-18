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
import { AuthorizationError } from '@struct/domain'
import { QueryError, type PersistenceError } from '../errors.js'
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
  readonly jobId: typeof JobQueue.Type['id']
  readonly answer: typeof ResearchAnswer.Type
  readonly citations: ReadonlyArray<typeof Citation.Type>
  readonly event: typeof EventJournal.Type
}

export interface FailResearchInput {
  readonly runId: typeof ResearchRun.Type['id']
  readonly jobId: typeof JobQueue.Type['id']
  readonly event: typeof EventJournal.Type
}

class ResearchScopeMismatchError extends Error {}

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
      staleBeforeMs: number,
    ) {
      const rows = yield* Effect.tryPromise({
        try: () =>
          sql.transaction(async (transaction) => {
            const staleRows = await transaction.unsafe(
              `UPDATE job_queue
               SET status = 'failed', updated_at = NOW()
               WHERE entity_type = 'research'
                 AND status = 'in-progress'
                 AND updated_at < to_timestamp($1 / 1000.0)
               RETURNING *`,
              [staleBeforeMs],
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
                 '{"errorTag":"ResearchJobStaleError","message":"Research failed"}'::jsonb,
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

    const appendEvent = Effect.fn('ResearchExecutionRepo.appendEvent')(function* (
      event: typeof EventJournal.Type,
    ) {
      const rows = yield* Effect.tryPromise({
        try: () =>
          sql.unsafe(
            `INSERT INTO event_journal (id, workspace_id, entity_type, entity_id, event_type, payload, created_at)
             VALUES ($1, $2, 'research', $3, $4, $5::jsonb, to_timestamp($6 / 1000.0))
             RETURNING *`,
            [
              event.id,
              event.workspaceId,
              event.entityId,
              event.eventType,
              JSON.stringify(event.payload),
              Number(event.createdAt),
            ],
          ),
        catch: () =>
          new QueryError({
            operation: 'appendResearchEvent',
            entity: 'ResearchExecution',
            message: 'Research event append failed',
          }),
      })
      return yield* decodeEventJournalRow(rows[0] as unknown as EventJournalRow).pipe(
        Effect.mapError((error) => persistenceDecodeError('appendResearchEvent.decode', error)),
      )
    })

    const appendInProgressEvent = Effect.fn(
      'ResearchExecutionRepo.appendInProgressEvent',
    )(function* (
      jobId: typeof JobQueue.Type['id'],
      event: typeof EventJournal.Type,
    ) {
      yield* Effect.tryPromise({
        try: () =>
          sql.transaction(async (transaction) => {
            const ownership = await transaction.unsafe(
              `SELECT id
               FROM job_queue
               WHERE id = $1
                 AND entity_type = 'research'
                 AND entity_id = $2
                 AND status = 'in-progress'
               FOR UPDATE`,
              [jobId, event.entityId],
            )
            if (ownership.length !== 1) {
              throw new Error('research-event-ownership-lost')
            }
            await transaction.unsafe(
              `INSERT INTO event_journal
                 (id, workspace_id, entity_type, entity_id, event_type, payload, created_at)
               VALUES ($1, $2, 'research', $3, $4, $5::jsonb, to_timestamp($6 / 1000.0))`,
              [
                event.id,
                event.workspaceId,
                event.entityId,
                event.eventType,
                JSON.stringify(event.payload),
                Number(event.createdAt),
              ],
            )
          }),
        catch: () =>
          new QueryError({
            operation: 'appendInProgressResearchEvent',
            entity: 'ResearchExecution',
            message: 'Research event append lost in-progress ownership',
          }),
      })
    })

    const complete = Effect.fn('ResearchExecutionRepo.complete')(function* (
      input: CompleteResearchInput,
    ) {
      yield* Effect.tryPromise({
        try: () =>
          sql.transaction(async (transaction) => {
            const jobRows = await transaction.unsafe(
              `UPDATE job_queue
               SET status = 'completed', updated_at = NOW()
               WHERE id = $1
                 AND entity_type = 'research'
                 AND entity_id = $2
                 AND status = 'in-progress'
               RETURNING id`,
              [input.jobId, input.runId],
            )
            if (jobRows.length !== 1) {
              throw new Error('research-job-completion-ownership-lost')
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
            await transaction.unsafe(
              `INSERT INTO research_run_results (run_id, answer, citations)
               VALUES ($1, $2, $3::jsonb)
               ON CONFLICT (run_id) DO NOTHING`,
              [input.runId, input.answer.answer, JSON.stringify(input.answer.citations)],
            )
            for (const citation of input.citations) {
              await transaction.unsafe(
                `INSERT INTO citations (id, run_id, source_version_id, locator, status, created_at)
                 VALUES ($1, $2, $3, $4, 'validated', to_timestamp($5 / 1000.0))
                 ON CONFLICT (id) DO NOTHING`,
                [
                  citation.id,
                  citation.runId,
                  citation.sourceVersionId,
                  citation.locator,
                  Number(citation.createdAt),
                ],
              )
            }
            await transaction.unsafe(
              `INSERT INTO event_journal (id, workspace_id, entity_type, entity_id, event_type, payload, created_at)
               VALUES ($1, $2, 'research', $3, $4, $5::jsonb, to_timestamp($6 / 1000.0))`,
              [
                input.event.id,
                input.event.workspaceId,
                input.event.entityId,
                input.event.eventType,
                JSON.stringify(input.event.payload),
                Number(input.event.createdAt),
              ],
            )
          }),
        catch: () =>
          new QueryError({
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
            const jobRows = await transaction.unsafe(
              `UPDATE job_queue
               SET status = 'failed', updated_at = NOW()
               WHERE id = $1
                 AND entity_type = 'research'
                 AND entity_id = $2
                 AND status = 'in-progress'
               RETURNING id`,
              [input.jobId, input.runId],
            )
            if (jobRows.length !== 1) {
              throw new Error('research-job-failure-ownership-lost')
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
                input.event.workspaceId,
                input.event.entityId,
                input.event.eventType,
                JSON.stringify(input.event.payload),
                Number(input.event.createdAt),
              ],
            )
          }),
        catch: () =>
          new QueryError({
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
      appendEvent,
      appendInProgressEvent,
      complete,
      fail,
    }
  }),
}) {}

export type ResearchExecutionError = PersistenceError | AuthorizationError
