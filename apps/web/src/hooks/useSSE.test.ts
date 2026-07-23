import { describe, expect, it } from 'bun:test'
import { createRoot } from 'solid-js'
import {
  SSE_BACKOFF,
  type SSEEnvironment,
  sseRetryDelay,
  useSSE,
} from './useSSE'

class FakeEventSource {
  onopen: ((event: Event) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent<string>) => void) | null = null
  closed = false
  private readonly listeners = new Map<string, Array<(event: Event) => void>>()

  addEventListener(type: string, listener: (event: Event) => void): void {
    const listeners = this.listeners.get(type) ?? []
    listeners.push(listener)
    this.listeners.set(type, listeners)
  }

  close(): void {
    this.closed = true
  }

  emit(type: string, event: Event = new Event(type)): void {
    for (const listener of this.listeners.get(type) ?? []) listener(event)
  }
}

function fakeLifecycle() {
  const sources: Array<FakeEventSource> = []
  const scheduled: Array<() => void> = []
  const endpoints: URL[] = []
  const environment: SSEEnvironment = {
    origin: 'http://localhost',
    createSource: (endpoint) => {
      endpoints.push(endpoint)
      const source = new FakeEventSource()
      sources.push(source)
      return source
    },
    schedule: (callback) => {
      scheduled.push(callback)
      return scheduled.length
    },
    cancel: () => undefined,
  }
  return { environment, sources, scheduled, endpoints }
}

describe('SSE retry policy', () => {
  it('uses bounded exponential backoff', () => {
    expect(sseRetryDelay(1)).toBe(1_000)
    expect(sseRetryDelay(2)).toBe(2_000)
    expect(sseRetryDelay(6)).toBe(30_000)
    expect(sseRetryDelay(20)).toBe(30_000)
    expect(SSE_BACKOFF.maxRetries).toBe(10)
  })

  it('stops after ten consecutive short-lived reconnects', () => {
    const lifecycle = fakeLifecycle()
    createRoot((dispose) => {
      const state = useSSE(
        () => '/events',
        (input) => input,
        () => undefined,
        [],
        lifecycle.environment,
      )
      for (let attempt = 0; attempt <= SSE_BACKOFF.maxRetries; attempt += 1) {
        const source = lifecycle.sources[attempt]
        expect(source).toBeDefined()
        source?.onopen?.(new Event('open'))
        source?.onerror?.(new Event('error'))
        const reconnect = lifecycle.scheduled.shift()
        if (attempt < SSE_BACKOFF.maxRetries) {
          expect(reconnect).toBeDefined()
          reconnect?.()
        } else {
          expect(reconnect).toBeUndefined()
        }
      }
      expect(lifecycle.sources).toHaveLength(11)
      expect(state.reconnecting()).toBe(false)
      expect(state.error()).toContain('could not reconnect')
      dispose()
    })
  })

  it('treats a named stream-error as terminal', () => {
    const lifecycle = fakeLifecycle()
    createRoot((dispose) => {
      const state = useSSE(
        () => '/events',
        (input) => input,
        () => undefined,
        [],
        lifecycle.environment,
      )
      lifecycle.sources[0]?.emit('stream-error')
      expect(lifecycle.sources[0]?.closed).toBe(true)
      expect(state.reconnecting()).toBe(false)
      expect(state.error()).toContain('became unavailable')
      expect(lifecycle.scheduled).toHaveLength(0)
      dispose()
    })
  })

  it('ignores stale callbacks after a replacement connection opens', () => {
    const lifecycle = fakeLifecycle()
    createRoot((dispose) => {
      const state = useSSE(
        () => '/events',
        (input) => input,
        () => undefined,
        [],
        lifecycle.environment,
      )
      const first = lifecycle.sources[0]
      first?.onerror?.(new Event('error'))
      lifecycle.scheduled.shift()?.()
      const second = lifecycle.sources[1]
      second?.onopen?.(new Event('open'))
      first?.onerror?.(new Event('error'))
      expect(second?.closed).toBe(false)
      expect(state.connected()).toBe(true)
      expect(lifecycle.scheduled).toHaveLength(0)
      dispose()
    })
  })

  it('replays from the last persisted cursor after reconnecting', () => {
    const lifecycle = fakeLifecycle()
    createRoot((dispose) => {
      useSSE(
        () => '/events',
        (input) => input,
        () => undefined,
        [],
        lifecycle.environment,
      )
      lifecycle.sources[0]?.onmessage?.(new MessageEvent('message', {
        data: '{}',
        lastEventId: '42',
      }))
      lifecycle.sources[0]?.onerror?.(new Event('error'))
      lifecycle.scheduled.shift()?.()

      expect(lifecycle.endpoints[1]?.searchParams.get('cursor')).toBe('42')
      dispose()
    })
  })

  it('does not acknowledge a frame that fails decode or reduction', () => {
    const lifecycle = fakeLifecycle()
    createRoot((dispose) => {
      const state = useSSE(
        () => '/events',
        () => {
          throw new Error('invalid')
        },
        () => undefined,
        [],
        lifecycle.environment,
      )
      lifecycle.sources[0]?.onmessage?.(new MessageEvent('message', {
        data: '{}',
        lastEventId: '42',
      }))

      expect(state.error()).toContain('invalid')
      expect(lifecycle.endpoints[0]?.searchParams.get('cursor')).toBeNull()
      dispose()
    })
  })
})
