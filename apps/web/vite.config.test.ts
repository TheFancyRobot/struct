import { describe, expect, it } from 'bun:test'
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
})
