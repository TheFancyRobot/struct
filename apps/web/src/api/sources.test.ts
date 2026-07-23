import { afterEach, describe, expect, it } from 'bun:test'
import { ProjectId } from '@struct/domain'
import { importBrowserSources } from './sources'

const originalFetch = globalThis.fetch
const projectId = ProjectId.make('b50e8400-e29b-41d4-a716-446655440001')

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('source import api client', () => {
  it('returns a valid all-rejected import response for the in-page reason list', async () => {
    globalThis.fetch = Object.assign(async () => new Response(JSON.stringify({
      accepted: [],
      rejected: [{ name: 'payload.exe', reason: 'unsupported-type' }],
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }), { preconnect: originalFetch.preconnect })

    await expect(importBrowserSources(projectId, {
      mode: 'paste',
      name: 'payload.exe',
      content: 'nope',
    })).resolves.toEqual({
      accepted: [],
      rejected: [{ name: 'payload.exe', reason: 'unsupported-type' }],
    })
  })
})
