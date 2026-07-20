import { describe, expect, it } from 'bun:test'
import { apiProxyHeaders } from './vite.config'

describe('Vite API proxy authentication', () => {
  it('does not emit an empty bearer credential', () => {
    expect(apiProxyHeaders(undefined)).toEqual({})
    expect(apiProxyHeaders('')).toEqual({})
    expect(apiProxyHeaders('local-development-token')).toEqual({
      Authorization: 'Bearer local-development-token',
    })
  })
})
