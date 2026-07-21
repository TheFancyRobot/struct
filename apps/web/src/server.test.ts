import { describe, expect, it } from 'bun:test'
import {
  createWebRequestHandler,
  loadWebServerConfig,
  proxyApiRequest,
} from './server'

describe('production web server', () => {
  it('requires a non-empty server-side API credential', () => {
    expect(() => loadWebServerConfig({ API_AUTH_TOKEN: '' })).toThrow()
    expect(() => loadWebServerConfig({ API_AUTH_TOKEN: 'too-short' })).toThrow()
  })

  it('proxies built-app EventSource requests with a server-only credential', async () => {
    const received: {
      authorization: string | null
      url: string | undefined
    } = {
      authorization: null,
      url: undefined,
    }
    const upstream = Bun.serve({
      port: 0,
      fetch(request) {
        received.authorization = request.headers.get('authorization')
        received.url = request.url
        return new Response('id: 1\ndata: {}\n\n', {
          headers: { 'Content-Type': 'text/event-stream' },
        })
      },
    })
    try {
      const response = await proxyApiRequest(
        new Request(
          'http://web.local/api/projects/project/runs/run/events?cursor=42',
        ),
        {
          apiOrigin: new URL(`http://127.0.0.1:${upstream.port}`),
          apiAuthToken: 'server-only-token',
        },
      )
      expect(received.authorization).toBe('Bearer server-only-token')
      expect(new URL(received.url ?? '').searchParams.get('cursor')).toBe('42')
      expect(response.headers.get('content-type')).toBe('text/event-stream')
      expect(await response.text()).toContain('id: 1')
    } finally {
      upstream.stop(true)
    }
  })

  it('serves and proxies through a configured base path', async () => {
    const upstream = Bun.serve({
      port: 0,
      fetch() {
        return new Response('ok', { status: 200 })
      },
    })
    try {
      const handler = createWebRequestHandler({
        apiOrigin: new URL(`http://127.0.0.1:${upstream.port}`),
        apiAuthToken: 'server-only-token',
        basePath: '/struct',
        distRoot: `${import.meta.dir}/../dist`,
        port: 3000,
      })
      const response = await handler(new Request('http://web.local/struct/api/healthz'))
      expect(response.status).toBe(200)
      expect(await response.text()).toBe('ok')
    } finally {
      upstream.stop(true)
    }
  })

  it('redirects local root to the configured base path', async () => {
    const handler = createWebRequestHandler({
      apiOrigin: new URL('http://127.0.0.1:3001'),
      apiAuthToken: 'server-only-token',
      basePath: '/struct',
      distRoot: `${import.meta.dir}/../dist`,
      port: 3000,
    })
    const response = await handler(new Request('http://web.local/'))
    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('http://web.local/struct/')
  })
})
