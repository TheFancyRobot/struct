import { describe, expect, it } from 'vitest'
import { Effect, Exit } from 'effect'
import {
  AuthorizationError,
  EventJournalId,
  JobQueueId,
  ProjectId,
  ResearchRunId,
  ResearchThreadId,
  SourceVersionId,
  WorkspaceId,
} from '@struct/domain'
import { QueryError } from '@struct/persistence'
import { startResearch } from './research'

const workspaceId = WorkspaceId.make('d50e8400-e29b-41d4-a716-446655440000')
const projectId = ProjectId.make('d50e8400-e29b-41d4-a716-446655440001')
const sourceVersionId = SourceVersionId.make('d50e8400-e29b-41d4-a716-446655440002')

describe('startResearch', () => {
  it('atomically prepares a pending run and one bounded research job', async () => {
    const registrations: unknown[] = []
    const result = await Effect.runPromise(startResearch({
      workspaceId,
      projectId,
      sourceVersionIds: [sourceVersionId],
      question: 'When is launch?',
    }, {
      now: () => 1700000000000n,
      randomThreadId: () => ResearchThreadId.make('d50e8400-e29b-41d4-a716-446655440003'),
      randomRunId: () => ResearchRunId.make('d50e8400-e29b-41d4-a716-446655440004'),
      randomJobId: () => JobQueueId.make('d50e8400-e29b-41d4-a716-446655440005'),
      randomEventId: () => EventJournalId.make('d50e8400-e29b-41d4-a716-446655440006'),
      register: (input) => {
        registrations.push(input)
        return Effect.succeed({
          thread: input.thread,
          run: input.run,
          job: input.job,
          event: input.event,
        })
      },
    }))

    expect(result.run.status).toBe('pending')
    expect(result.job.entityType).toBe('research')
    expect(result.job.maxAttempts).toBe(1)
    expect(result.event.eventType).toBe('research-started')
    expect(registrations).toHaveLength(1)
  })

  it('rejects empty questions and duplicate source versions before persistence', async () => {
    let registered = false
    const deps = {
      now: () => 0n,
      randomThreadId: () => ResearchThreadId.make(crypto.randomUUID()),
      randomRunId: () => ResearchRunId.make(crypto.randomUUID()),
      randomJobId: () => JobQueueId.make(crypto.randomUUID()),
      randomEventId: () => EventJournalId.make(crypto.randomUUID()),
      register: () => {
        registered = true
        return Effect.die('must not register')
      },
    }

    const empty = await Effect.runPromiseExit(startResearch({
      workspaceId,
      projectId,
      sourceVersionIds: [sourceVersionId],
      question: ' ',
    }, deps))
    const duplicate = await Effect.runPromiseExit(startResearch({
      workspaceId,
      projectId,
      sourceVersionIds: [sourceVersionId, sourceVersionId],
      question: 'When?',
    }, deps))

    expect(Exit.isFailure(empty)).toBe(true)
    expect(Exit.isFailure(duplicate)).toBe(true)
    expect(registered).toBe(false)
  })

  it('preserves authorization and infrastructure registration failures', async () => {
    const baseDeps = {
      now: () => 0n,
      randomThreadId: () => ResearchThreadId.make(crypto.randomUUID()),
      randomRunId: () => ResearchRunId.make(crypto.randomUUID()),
      randomJobId: () => JobQueueId.make(crypto.randomUUID()),
      randomEventId: () => EventJournalId.make(crypto.randomUUID()),
    }
    const input = {
      workspaceId,
      projectId,
      sourceVersionIds: [sourceVersionId],
      question: 'When?',
    }
    const forbidden = await Effect.runPromiseExit(startResearch(input, {
      ...baseDeps,
      register: () =>
        Effect.fail(
          new AuthorizationError({
            detail: 'research-source-scope-mismatch',
            message: 'Outside scope',
          }),
        ),
    }))
    const unavailable = await Effect.runPromiseExit(startResearch(input, {
      ...baseDeps,
      register: () =>
        Effect.fail(
          new QueryError({
            operation: 'registerResearch',
            entity: 'ResearchExecution',
            message: 'Unavailable',
          }),
        ),
    }))

    expect(Exit.isFailure(forbidden)).toBe(true)
    expect(Exit.isFailure(unavailable)).toBe(true)
    if (Exit.isFailure(forbidden) && Exit.isFailure(unavailable)) {
      expect(forbidden.cause.toString()).toContain('AuthorizationError')
      expect(unavailable.cause.toString()).toContain('QueryError')
      expect(forbidden.cause.toString()).not.toContain('ValidationError')
      expect(unavailable.cause.toString()).not.toContain('ValidationError')
    }
  })
})
