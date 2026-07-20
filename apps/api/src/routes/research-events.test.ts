import { describe, expect, it } from 'bun:test'
import { Effect } from 'effect'
import {
  EventJournalId,
  JobQueueId,
  ProjectId,
  ResearchRunId,
  ResearchThreadId,
  WorkspaceId,
} from '@struct/domain'
import {
  EntityNotFoundError,
  QueryError,
} from '@struct/persistence'
import {
  encodeSseEvent,
  loadResearchEvents,
  parseEventCursor,
  researchEventScopeFailureResponse,
  researchEventsResponse,
  resolveResearchEventScope,
} from './research-events'

const projectId = ProjectId.make('b50e8400-e29b-41d4-a716-446655440001')
const runId = ResearchRunId.make('b50e8400-e29b-41d4-a716-446655440002')
const workspaceId = WorkspaceId.make('b50e8400-e29b-41d4-a716-446655440004')

describe('research event projection', () => {
  it('maps a missing syntactically valid project to ResearchRunNotFound', async () => {
    const exit = await Effect.runPromiseExit(resolveResearchEventScope(
      projectId,
      runId,
      {
        findProject: () => Effect.fail(new EntityNotFoundError({
          entity: 'Project',
          id: projectId,
          message: 'Project not found',
        })),
        runExists: () => Effect.die('not called'),
      },
    ))
    expect(exit._tag).toBe('Failure')
    if (exit._tag === 'Success') throw new Error('Expected missing project')
    const failure = exit.cause._tag === 'Fail'
      ? exit.cause.error
      : undefined
    if (failure === undefined) throw new Error('Expected typed failure')
    const response = researchEventScopeFailureResponse(failure)
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'ResearchRunNotFound' })
  })

  it('keeps infrastructure failures unavailable and absent runs not found', async () => {
    const unavailable = researchEventScopeFailureResponse(new QueryError({
      operation: 'findById',
      entity: 'Project',
      message: 'database unavailable',
    }))
    expect(unavailable.status).toBe(503)

    const exit = await Effect.runPromiseExit(resolveResearchEventScope(
      projectId,
      runId,
      {
        findProject: () => Effect.succeed({
          id: projectId,
          workspaceId,
          name: 'Project',
          createdAt: 0n,
          updatedAt: 0n,
        }),
        runExists: () => Effect.succeed(false),
      },
    ))
    expect(exit._tag).toBe('Failure')
    if (exit._tag === 'Success') throw new Error('Expected missing run')
    const failure = exit.cause._tag === 'Fail'
      ? exit.cause.error
      : undefined
    if (failure === undefined) throw new Error('Expected typed failure')
    expect(researchEventScopeFailureResponse(failure).status).toBe(404)
  })

  it('validates cursors and emits replayable SSE frames', async () => {
    expect(parseEventCursor(null)).toBe(0n)
    expect(parseEventCursor('42')).toBe(42n)
    expect(parseEventCursor('-1')).toBeUndefined()

    const [event] = await Effect.runPromise(loadResearchEvents(
      workspaceId,
      projectId,
      runId,
      4n,
      {
        listEventsAfter: (_workspaceId, _projectId, _runId, cursor) => {
          expect(cursor).toBe(4n)
          return Effect.succeed([{
            id: EventJournalId.make('b50e8400-e29b-41d4-a716-446655440003'),
            workspaceId,
            entityType: 'research',
            entityId: runId,
            eventType: 'research-started',
            payload: {
              jobId: JobQueueId.make('b50e8400-e29b-41d4-a716-446655440005'),
              threadId: ResearchThreadId.make('b50e8400-e29b-41d4-a716-446655440006'),
            },
            cursor: 5n,
            createdAt: 1_700_000_000_000n,
          }])
        },
        findCompleted: () => Effect.die('not called'),
      },
    ))

    expect(event?.cursor).toBe('5')
    expect(encodeSseEvent(event!)).toContain('id: 5\nevent: research-started\ndata:')
  })

  it('emits a comment heartbeat after 30 seconds without persisted events', async () => {
    const abort = new AbortController()
    let clockReads = 0
    const response = researchEventsResponse(
      workspaceId,
      projectId,
      runId,
      0n,
      {
        listEventsAfter: () => Effect.succeed([]),
        findCompleted: () => Effect.die('not called'),
      },
      abort.signal,
      {
        now: () => clockReads++ === 0 ? 0 : 30_000,
        sleep: () => {
          abort.abort()
          return Promise.resolve()
        },
      },
    )
    if (response.body === null) throw new Error('Expected SSE response body')
    const reader = response.body.getReader()
    const first = await reader.read()
    const second = await reader.read()
    const frames = new TextDecoder().decode(first.value)
      + new TextDecoder().decode(second.value)
    expect(frames).toContain(': heartbeat\n\n')
  })

  it('does not poll ahead while an emitted frame is backpressured', async () => {
    let polls = 0
    let sleeps = 0
    const response = researchEventsResponse(
      workspaceId,
      projectId,
      runId,
      0n,
      {
        listEventsAfter: () => {
          polls += 1
          return Effect.succeed([{
            id: EventJournalId.make('b50e8400-e29b-41d4-a716-446655440013'),
            workspaceId: WorkspaceId.make('b50e8400-e29b-41d4-a716-446655440014'),
            entityType: 'research',
            entityId: runId,
            eventType: 'research-started',
            payload: {
              jobId: JobQueueId.make('b50e8400-e29b-41d4-a716-446655440015'),
              threadId: ResearchThreadId.make('b50e8400-e29b-41d4-a716-446655440016'),
            },
            cursor: 1n,
            createdAt: 1_700_000_000_000n,
          }])
        },
        findCompleted: () => Effect.die('not called'),
      },
      new AbortController().signal,
      {
        now: () => 0,
        sleep: () => {
          sleeps += 1
          return Promise.resolve()
        },
      },
    )
    await Bun.sleep(0)
    expect(response.body).not.toBeNull()
    expect(polls).toBe(1)
    expect(sleeps).toBe(0)
    await response.body?.cancel()
  })

  it('cancels an in-flight producer independently of the request signal', async () => {
    const request = new AbortController()
    let interrupted = false
    const response = researchEventsResponse(
      workspaceId,
      projectId,
      runId,
      0n,
      {
        listEventsAfter: () => Effect.never.pipe(
          Effect.onInterrupt(() => Effect.sync(() => {
            interrupted = true
          })),
        ),
        findCompleted: () => Effect.die('not called'),
      },
      request.signal,
      {
        now: () => 0,
        sleep: () => Promise.resolve(),
      },
    )
    if (response.body === null) throw new Error('Expected SSE response body')
    const reader = response.body.getReader()
    const read = reader.read()
    await Bun.sleep(0)
    await reader.cancel()
    expect(request.signal.aborted).toBe(false)
    expect(interrupted).toBe(true)
    expect(await read).toEqual({ value: undefined, done: true })
  })
})
