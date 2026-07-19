import { createSignal, onCleanup } from 'solid-js'

export const SSE_BACKOFF = {
  initialMs: 1_000,
  maxMs: 30_000,
  maxRetries: 10,
} as const

export function sseRetryDelay(retry: number): number {
  return Math.min(
    SSE_BACKOFF.initialMs * (2 ** Math.max(0, retry - 1)),
    SSE_BACKOFF.maxMs,
  )
}

export interface SSEState {
  readonly connected: () => boolean
  readonly reconnecting: () => boolean
  readonly error: () => string | undefined
}

interface SSESource {
  onopen: ((event: Event) => void) | null
  onerror: ((event: Event) => void) | null
  onmessage: ((event: MessageEvent<string>) => void) | null
  addEventListener: (type: string, listener: (event: Event) => void) => void
  close: () => void
}

export interface SSEEnvironment {
  readonly origin: string
  readonly createSource: (endpoint: URL) => SSESource
  readonly schedule: (callback: () => void, milliseconds: number) => number
  readonly cancel: (handle: number) => void
}

const liveEnvironment = (): SSEEnvironment => ({
  origin: window.location.origin,
  createSource: (endpoint) => new EventSource(endpoint),
  schedule: (callback, milliseconds) => window.setTimeout(callback, milliseconds),
  cancel: (handle) => window.clearTimeout(handle),
})

export function useSSE<T>(
  url: () => string,
  decode: (input: unknown) => T,
  onEvent: (event: T) => void,
  eventTypes: ReadonlyArray<string> = [],
  environment: SSEEnvironment = liveEnvironment(),
): SSEState {
  const [connected, setConnected] = createSignal(false)
  const [reconnecting, setReconnecting] = createSignal(false)
  const [error, setError] = createSignal<string>()
  let source: SSESource | undefined
  let retryTimer: number | undefined
  let retries = 0
  let cursor: string | undefined
  let disposed = false
  let terminated = false

  const stopWithError = (message: string) => {
    terminated = true
    source?.close()
    if (retryTimer !== undefined) environment.cancel(retryTimer)
    setConnected(false)
    setReconnecting(false)
    setError(message)
  }

  const connect = () => {
    if (disposed || terminated) return
    const endpoint = new URL(url(), environment.origin)
    if (cursor !== undefined) endpoint.searchParams.set('cursor', cursor)
    const currentSource = environment.createSource(endpoint)
    source = currentSource
    currentSource.onopen = () => {
      if (source !== currentSource) return
      setConnected(true)
      setReconnecting(false)
      setError(undefined)
    }
    const receive = (message: MessageEvent<string>) => {
      if (source !== currentSource) return
      if (message.lastEventId !== '') cursor = message.lastEventId
      try {
        onEvent(decode(JSON.parse(message.data)))
        retries = 0
      } catch {
        stopWithError('A progress update was invalid. Refresh to reload persisted progress.')
      }
    }
    currentSource.onmessage = receive
    currentSource.addEventListener('stream-error', () => {
      if (source !== currentSource) return
      stopWithError('Live progress became unavailable. Refresh to try again.')
    })
    for (const eventType of eventTypes) {
      if (eventType === 'stream-error') continue
      currentSource.addEventListener(eventType, (event) => {
        if (event instanceof MessageEvent) receive(event)
      })
    }
    currentSource.onerror = () => {
      if (disposed || terminated || source !== currentSource) return
      currentSource.close()
      source = undefined
      setConnected(false)
      retries += 1
      if (retries > SSE_BACKOFF.maxRetries) {
        setReconnecting(false)
        setError('Live progress could not reconnect. Refresh to try again.')
        return
      }
      setReconnecting(true)
      retryTimer = environment.schedule(() => {
        retryTimer = undefined
        connect()
      }, sseRetryDelay(retries))
    }
  }

  connect()
  onCleanup(() => {
    disposed = true
    source?.close()
    if (retryTimer !== undefined) environment.cancel(retryTimer)
  })

  return { connected, reconnecting, error }
}
