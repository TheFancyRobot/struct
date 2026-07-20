import { Effect, Schema } from 'effect'
import { ResearchEvent } from '@struct/domain'
import type * as typeDomain from '@struct/domain'
import type * as typePersistence from '@struct/persistence'
import { EntityNotFoundError, QueryError } from '@struct/persistence'

const MAX_EVENT_BATCH = 100
const POLL_INTERVAL_MS = 1_000
const HEARTBEAT_INTERVAL_MS = 30_000

export interface ResearchEventDeps {
  readonly listEventsAfter: (
    workspaceId: typeDomain.WorkspaceId,
    projectId: typeDomain.ProjectId,
    runId: typeDomain.ResearchRunId,
    cursor: bigint,
    limit: number,
  ) => Effect.Effect<
    ReadonlyArray<typeof typeDomain.EventJournal.Type>,
    typePersistence.PersistenceError,
    never
  >
  readonly findCompleted: (
    workspaceId: typeDomain.WorkspaceId,
    projectId: typeDomain.ProjectId,
    runId: typeDomain.ResearchRunId,
  ) => Effect.Effect<
    typePersistence.CompletedResearchProjection,
    typePersistence.PersistenceError,
    never
  >
}

export interface ResearchEventScopeDeps {
  readonly findProject: (
    projectId: typeDomain.ProjectId,
  ) => Effect.Effect<
    typeof typeDomain.Project.Type,
    typePersistence.PersistenceError,
    never
  >
  readonly runExists: (
    workspaceId: typeDomain.WorkspaceId,
    projectId: typeDomain.ProjectId,
    runId: typeDomain.ResearchRunId,
  ) => Effect.Effect<boolean, typePersistence.PersistenceError, never>
}

export const resolveResearchEventScope = (
  projectId: typeDomain.ProjectId,
  runId: typeDomain.ResearchRunId,
  deps: ResearchEventScopeDeps,
): Effect.Effect<
  typeDomain.WorkspaceId,
  typePersistence.PersistenceError,
  never
> =>
  Effect.gen(function* () {
    const project = yield* deps.findProject(projectId)
    const exists = yield* deps.runExists(project.workspaceId, projectId, runId)
    if (!exists) {
      return yield* new EntityNotFoundError({
        entity: 'ResearchRun',
        id: runId,
        message: `ResearchRun ${runId} not found`,
      })
    }
    return project.workspaceId
  })

export function researchEventScopeFailureResponse(
  error: typePersistence.PersistenceError,
): Response {
  return error instanceof EntityNotFoundError
    ? new Response(JSON.stringify({ error: 'ResearchRunNotFound' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    : new Response(JSON.stringify({ error: 'ResearchEventsUnavailable' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      })
}

export interface ResearchEventStreamRuntime {
  readonly now: () => number
  readonly sleep: (milliseconds: number) => Promise<void>
}

const liveStreamRuntime: ResearchEventStreamRuntime = {
  now: () => Date.now(),
  sleep: (milliseconds) => Bun.sleep(milliseconds),
}

export function parseEventCursor(value: string | null): bigint | undefined {
  if (value === null) return 0n
  if (!/^(0|[1-9]\d*)$/.test(value)) return undefined
  return BigInt(value)
}

export function encodeSseEvent(event: ResearchEvent): string {
  return `id: ${event.cursor}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`
}

export const loadResearchEvents = (
  workspaceId: typeDomain.WorkspaceId,
  projectId: typeDomain.ProjectId,
  runId: typeDomain.ResearchRunId,
  cursor: bigint,
  deps: ResearchEventDeps,
): Effect.Effect<
  ReadonlyArray<ResearchEvent>,
  typePersistence.PersistenceError,
  never
> =>
  Effect.gen(function* () {
    const events = yield* deps.listEventsAfter(
      workspaceId,
      projectId,
      runId,
      cursor,
      MAX_EVENT_BATCH,
    )
    return yield* Effect.forEach(events, (event) =>
      Effect.gen(function* () {
        const base = {
          id: event.id,
          cursor: event.cursor.toString(),
          runId,
          createdAt: Number(event.createdAt),
          type: event.eventType,
        }
        const candidate = event.eventType === 'research-completed'
          ? {
              ...base,
              data: {
                ...event.payload,
                ...(yield* deps.findCompleted(workspaceId, projectId, runId)),
              },
            }
          : { ...base, data: event.payload }
        return yield* Schema.decodeUnknown(ResearchEvent)(candidate).pipe(
          Effect.mapError(() => new QueryError({
            operation: 'projectResearchEvent',
            entity: 'ResearchProjection',
            message: 'Research event data is invalid',
          })),
        )
      }),
    )
  })

export function researchEventsResponse(
  workspaceId: typeDomain.WorkspaceId,
  projectId: typeDomain.ProjectId,
  runId: typeDomain.ResearchRunId,
  initialCursor: bigint,
  deps: ResearchEventDeps,
  signal: AbortSignal,
  runtime: ResearchEventStreamRuntime = liveStreamRuntime,
): Response {
  const encoder = new TextEncoder()
  let cursor = initialCursor
  let lastWrite = runtime.now()
  let cancelled = false
  let closed = false
  const pending: Array<Uint8Array> = []
  let controller: ReadableStreamDefaultController<Uint8Array> | undefined
  const execution = new AbortController()
  const cancelledResult = Symbol('cancelled')
  let resolveCancellation: () => void = () => undefined
  const cancellation = new Promise<typeof cancelledResult>((resolve) => {
    resolveCancellation = () => resolve(cancelledResult)
  })

  const close = () => {
    if (closed) return
    closed = true
    signal.removeEventListener('abort', abort)
    controller?.close()
  }
  const abort = () => {
    cancelled = true
    execution.abort()
    resolveCancellation()
    close()
  }

  const stream = new ReadableStream<Uint8Array>({
    start(streamController) {
      controller = streamController
      signal.addEventListener('abort', abort, { once: true })
      if (signal.aborted) abort()
    },
    async pull(streamController) {
      if (cancelled || closed) return
      if (pending.length === 0) {
        const exit = await Promise.race([
          Effect.runPromiseExit(
            loadResearchEvents(workspaceId, projectId, runId, cursor, deps),
            { signal: execution.signal },
          ),
          cancellation,
        ])
        if (exit === cancelledResult || cancelled || closed) return
        if (exit._tag === 'Failure') {
          streamController.enqueue(encoder.encode(
            'event: stream-error\ndata: {"error":"ResearchEventsUnavailable"}\n\n',
          ))
          close()
          return
        }
        for (const event of exit.value) {
          pending.push(encoder.encode(encodeSseEvent(event)))
          cursor = BigInt(event.cursor)
          lastWrite = runtime.now()
        }
        if (
          pending.length === 0
          && runtime.now() - lastWrite >= HEARTBEAT_INTERVAL_MS
        ) {
          pending.push(encoder.encode(': heartbeat\n\n'))
          lastWrite = runtime.now()
        }
      }
      const frame = pending.shift()
      if (frame !== undefined && !cancelled && !closed) {
        streamController.enqueue(frame)
        return
      }
      await Promise.race([runtime.sleep(POLL_INTERVAL_MS), cancellation])
    },
    cancel() {
      cancelled = true
      execution.abort()
      resolveCancellation()
      signal.removeEventListener('abort', abort)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
