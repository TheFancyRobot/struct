import { describe, expect, it } from 'bun:test'
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
import { startResearch, type StartResearchDeps } from './research'

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
    expect(registrations[0]).toMatchObject({ createThread: true })
    expect(registrations).toHaveLength(1)
  })

  it('appends a run without renaming an existing thread', async () => {
    const thread = {
      id: ResearchThreadId.make('d50e8400-e29b-41d4-a716-446655440003'),
      projectId,
      title: 'First question',
      createdAt: 1n,
      updatedAt: 1n,
    }
    let registration: Parameters<StartResearchDeps['register']>[0] | undefined
    await Effect.runPromise(startResearch({
      workspaceId,
      projectId,
      sourceVersionIds: [sourceVersionId],
      question: 'Follow up',
      thread,
    }, {
      now: () => 2n,
      randomThreadId: () => ResearchThreadId.make(crypto.randomUUID()),
      randomRunId: () => ResearchRunId.make(crypto.randomUUID()),
      randomJobId: () => JobQueueId.make(crypto.randomUUID()),
      randomEventId: () => EventJournalId.make(crypto.randomUUID()),
      register: (input) => {
        registration = input
        return Effect.succeed(input)
      },
    }))

    expect(registration?.thread.title).toBe('First question')
    expect(registration?.run.threadId).toBe(thread.id)
    expect(registration?.createThread).toBe(false)
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

  it('accepts exactly 2048 question characters and rejects 2049 before persistence', async () => {
    let registrations = 0
    const deps = {
      now: () => 0n,
      randomThreadId: () => ResearchThreadId.make(crypto.randomUUID()),
      randomRunId: () => ResearchRunId.make(crypto.randomUUID()),
      randomJobId: () => JobQueueId.make(crypto.randomUUID()),
      randomEventId: () => EventJournalId.make(crypto.randomUUID()),
      register: ((input) => {
        registrations += 1
        return Effect.succeed({
          thread: input.thread,
          run: input.run,
          job: input.job,
          event: input.event,
        })
      }) satisfies StartResearchDeps['register'],
    }

    const accepted = await Effect.runPromiseExit(startResearch({
      workspaceId,
      projectId,
      sourceVersionIds: [sourceVersionId],
      question: 'a'.repeat(2_048),
    }, deps))
    const rejected = await Effect.runPromiseExit(startResearch({
      workspaceId,
      projectId,
      sourceVersionIds: [sourceVersionId],
      question: 'a'.repeat(2_049),
    }, deps))

    expect(Exit.isSuccess(accepted)).toBe(true)
    expect(Exit.isFailure(rejected)).toBe(true)
    expect(registrations).toBe(1)
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
