import { describe, expect, it } from 'bun:test'
import type { ProxyOptions } from 'vite'
import viteConfig from './vite.config'
import { apiProxyHeaders, appBase } from './vite-helpers'

describe('Vite API proxy authentication', () => {
  it('does not emit an empty bearer credential', () => {
    expect(apiProxyHeaders(undefined)).toEqual({})
    expect(apiProxyHeaders('')).toEqual({})
    expect(apiProxyHeaders('local-development-token')).toEqual({
      Authorization: 'Bearer local-development-token',
    })
  })

  it('maps a normalized base path to the Vite base option', () => {
    expect(appBase('')).toBe('/')
    expect(appBase('/struct')).toBe('/struct/')
  })

  it('rewrites base-prefixed API proxy requests back to /api', async () => {
    process.env.BASE_PATH = '/struct'

    const resolved = await viteConfig({
      command: 'serve',
      mode: 'test',
      isSsrBuild: false,
      isPreview: false,
    })

    const proxy = resolved.server?.proxy
    const basePrefixedApiProxy = proxy && '/struct/api' in proxy ? proxy['/struct/api'] : undefined
    const basePrefixedApiRewrite =
      typeof basePrefixedApiProxy === 'object' && basePrefixedApiProxy !== null
        ? (basePrefixedApiProxy as ProxyOptions).rewrite
        : undefined

    expect(basePrefixedApiProxy).toBeDefined()
    expect(typeof basePrefixedApiRewrite).toBe('function')
    expect(basePrefixedApiRewrite?.('/struct/api/health')).toBe('/api/health')
  })
})
