import { Effect } from 'effect'
import type { EventJournal, JobQueue, Source } from '@struct/domain'
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

export interface SourceRegistrationResult {
  readonly source: typeof Source.Type
  readonly job: typeof JobQueue.Type
  readonly event: typeof EventJournal.Type
}

export interface SourceRegistrationRepository {
  readonly create: (
    input: SourceRegistrationInput,
  ) => Effect.Effect<SourceRegistrationResult, PersistenceError, never>
}

export class SourceRegistrationRepo extends Effect.Service<SourceRegistrationRepo>()('SourceRegistrationRepo', {
  accessors: true,
  effect: Effect.gen(function* () {
    const sql = yield* SqlClient

    const create = Effect.fn('SourceRegistrationRepo.create')(function* (input: SourceRegistrationInput) {
      return yield* Effect.tryPromise({
        try: () =>
          sql.transaction(async (transaction) => {
            const sourceRows = await transaction.unsafe(
              `INSERT INTO sources (id, project_id, name, kind, created_at, updated_at)
               VALUES ($1, $2, $3, $4, to_timestamp($5 / 1000.0), to_timestamp($6 / 1000.0))
               RETURNING *`,
              [
                input.source.id,
                input.source.projectId,
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
                input.job.workspaceId,
                input.job.entityType,
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
               VALUES ($1, $2, $3, $4, $5, $6::jsonb, to_timestamp($7 / 1000.0))
               RETURNING *`,
              [
                input.event.id,
                input.event.workspaceId,
                input.event.entityType,
                input.event.entityId,
                input.event.eventType,
                JSON.stringify(input.event.payload),
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
        catch: () =>
          new QueryError({
            operation: 'createSourceRegistration',
            entity: 'SourceRegistration',
            message: 'Atomic source registration failed',
          }),
      })
    })

    return { create }
  }),
}) {}
