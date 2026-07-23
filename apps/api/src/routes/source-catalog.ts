import { Effect } from 'effect'
import type * as type from '@struct/domain'
import type { SourceCatalogPersistenceError } from '@struct/persistence'

const MAX_EVENT_BATCH = 100
const HEARTBEAT_INTERVAL_MS = 30_000

export interface SourceCatalogRouteDeps {
  readonly list: (
    workspaceId: type.WorkspaceId,
    projectId: type.ProjectId,
  ) => Effect.Effect<type.SourceCatalog, SourceCatalogPersistenceError>
  readonly listEventsAfter: (
    workspaceId: type.WorkspaceId,
    projectId: type.ProjectId,
    cursor: bigint,
    limit: number,
  ) => Effect.Effect<ReadonlyArray<type.SourceActivityEvent>, SourceCatalogPersistenceError>
}

export const loadSourceCatalog = (
  workspaceId: type.WorkspaceId,
  projectId: type.ProjectId,
  deps: Pick<SourceCatalogRouteDeps, 'list'>,
) => deps.list(workspaceId, projectId)

export function encodeSourceActivityEvent(event: type.SourceActivityEvent): string {
  return `id: ${event.cursor}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`
}

export function sourceActivityResponse(
  workspaceId: type.WorkspaceId,
  projectId: type.ProjectId,
  initialCursor: bigint,
  deps: Pick<SourceCatalogRouteDeps, 'listEventsAfter'>,
  signal: AbortSignal,
): Response {
  const encoder = new TextEncoder()
  let cursor = initialCursor
  let lastWrite = Date.now()
  let closed = false

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (closed || signal.aborted) {
        controller.close()
        return
      }
      const exit = await Effect.runPromiseExit(
        deps.listEventsAfter(workspaceId, projectId, cursor, MAX_EVENT_BATCH),
        { signal },
      )
      if (exit._tag === 'Failure') {
        controller.enqueue(encoder.encode(
          'event: stream-error\ndata: {"error":"SourceActivityUnavailable"}\n\n',
        ))
        controller.close()
        closed = true
        return
      }
      if (exit.value.length > 0) {
        for (const event of exit.value) {
          controller.enqueue(encoder.encode(encodeSourceActivityEvent(event)))
          cursor = BigInt(event.cursor)
        }
        lastWrite = Date.now()
        return
      }
      if (Date.now() - lastWrite >= HEARTBEAT_INTERVAL_MS) {
        controller.enqueue(encoder.encode(': heartbeat\n\n'))
        lastWrite = Date.now()
        return
      }
      await Bun.sleep(1_000)
    },
    cancel() {
      closed = true
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
