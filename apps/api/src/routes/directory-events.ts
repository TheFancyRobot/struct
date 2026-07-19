import { Effect, Schema } from 'effect'
import {
  DirectoryProgressEvent,
  type DirectoryStatusProjection,
} from '@struct/domain'
import type * as type from '@struct/domain'
import type {
  DirectoryControlRepositoryError,
  DirectoryJournalEvent,
} from '@struct/persistence'

const MAX_EVENT_BATCH = 100
const HEARTBEAT_INTERVAL_MS = 30_000

export interface DirectoryEventDeps {
  readonly listEventsAfter: (
    workspaceId: type.WorkspaceId,
    projectId: type.ProjectId,
    jobId: type.JobQueueId,
    cursor: bigint,
    limit: number,
  ) => Effect.Effect<
    ReadonlyArray<DirectoryJournalEvent>,
    DirectoryControlRepositoryError,
    never
  >
  readonly findStatus: (
    workspaceId: type.WorkspaceId,
    projectId: type.ProjectId,
    jobId: type.JobQueueId,
  ) => Effect.Effect<
    DirectoryStatusProjection,
    DirectoryControlRepositoryError,
    never
  >
}

export interface DirectoryEventStreamRuntime {
  readonly now: () => number
  readonly sleep: (milliseconds: number) => Promise<void>
}

const liveRuntime: DirectoryEventStreamRuntime = {
  now: () => Date.now(),
  sleep: (milliseconds) => Bun.sleep(milliseconds),
}

export function encodeDirectorySseEvent(
  event: typeof DirectoryProgressEvent.Type,
): string {
  return `id: ${event.cursor}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`
}

export const loadDirectoryEvents = (
  workspaceId: type.WorkspaceId,
  projectId: type.ProjectId,
  jobId: type.JobQueueId,
  cursor: bigint,
  deps: DirectoryEventDeps,
): Effect.Effect<
  ReadonlyArray<typeof DirectoryProgressEvent.Type>,
  DirectoryControlRepositoryError | DirectoryEventProjectionError,
  never
> =>
  Effect.gen(function* () {
    const events = yield* deps.listEventsAfter(
      workspaceId,
      projectId,
      jobId,
      cursor,
      MAX_EVENT_BATCH,
    )
    if (events.length === 0) return []
    const status = yield* deps.findStatus(workspaceId, projectId, jobId)
    return yield* Effect.forEach(events, (event) =>
      Schema.decodeUnknown(DirectoryProgressEvent)({
        id: event.id,
        cursor: event.cursor.toString(),
        type: event.type,
        jobId,
        createdAt: event.createdAt,
        status,
      }).pipe(
        Effect.mapError(() => new DirectoryEventProjectionError({
          eventId: event.id,
          message: 'Persisted directory progress could not be projected',
        })),
      ),
    )
  })

export class DirectoryEventProjectionError
  extends Schema.TaggedError<DirectoryEventProjectionError>()(
    'DirectoryEventProjectionError',
    {
      eventId: Schema.UUID,
      message: Schema.String,
    },
  ) {}

export function directoryEventsResponse(
  workspaceId: type.WorkspaceId,
  projectId: type.ProjectId,
  jobId: type.JobQueueId,
  initialCursor: bigint,
  deps: DirectoryEventDeps,
  signal: AbortSignal,
  runtime: DirectoryEventStreamRuntime = liveRuntime,
): Response {
  const encoder = new TextEncoder()
  let cursor = initialCursor
  let lastWrite = runtime.now()
  let stopped = false
  const execution = new AbortController()
  const stop = () => {
    stopped = true
    execution.abort()
  }
  signal.addEventListener('abort', stop, { once: true })

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (stopped) {
        controller.close()
        return
      }
      const exit = await Effect.runPromiseExit(
        loadDirectoryEvents(
          workspaceId,
          projectId,
          jobId,
          cursor,
          deps,
        ),
        { signal: execution.signal },
      )
      if (stopped) {
        controller.close()
        return
      }
      if (exit._tag === 'Failure') {
        controller.enqueue(encoder.encode(
          'event: stream-error\ndata: {"error":"DirectoryEventsUnavailable"}\n\n',
        ))
        controller.close()
        return
      }
      if (exit.value.length > 0) {
        for (const event of exit.value) {
          controller.enqueue(encoder.encode(encodeDirectorySseEvent(event)))
          cursor = BigInt(event.cursor)
          lastWrite = runtime.now()
        }
        return
      }
      if (runtime.now() - lastWrite >= HEARTBEAT_INTERVAL_MS) {
        controller.enqueue(encoder.encode(': heartbeat\n\n'))
        lastWrite = runtime.now()
        return
      }
      await runtime.sleep(1_000)
    },
    cancel() {
      stop()
      signal.removeEventListener('abort', stop)
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
