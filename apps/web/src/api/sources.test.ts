import { afterEach, describe, expect, it } from 'bun:test'
import { ProjectId, SourceId } from '@struct/domain'
import {
  fetchWorkspaceSourceCatalog,
  importBrowserSources,
  setProjectSourceAttached,
} from './sources'

const originalFetch = globalThis.fetch
const projectId = ProjectId.make('b50e8400-e29b-41d4-a716-446655440001')
const clientBatchId = 'b50e8400-e29b-41d4-a716-446655440010'
const sourceId = SourceId.make('b50e8400-e29b-41d4-a716-446655440002')

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('source import api client', () => {
  it('returns a valid all-rejected import response for the in-page reason list', async () => {
    globalThis.fetch = Object.assign(async () => new Response(JSON.stringify({
      clientBatchId,
      replayed: false,
      accepted: [],
      rejected: [{ name: 'payload.exe', reason: 'unsupported-type' }],
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }), { preconnect: originalFetch.preconnect })

    await expect(importBrowserSources(projectId, clientBatchId, {
      mode: 'paste',
      name: 'payload.exe',
      content: 'nope',
    })).resolves.toEqual({
      clientBatchId,
      replayed: false,
      accepted: [],
      rejected: [{ name: 'payload.exe', reason: 'unsupported-type' }],
    })
  })

  it('loads the workspace library and attaches one source without reimporting it', async () => {
    const requests: Array<[string, string]> = []
    globalThis.fetch = Object.assign(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString()
      const method = init?.method ?? 'GET'
      requests.push([url, method])
      if (method === 'GET') {
        return new Response(JSON.stringify({ items: [], cursor: '0' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }
      return new Response(null, { status: 204 })
    }, { preconnect: originalFetch.preconnect })

    await expect(fetchWorkspaceSourceCatalog()).resolves.toEqual({
      items: [],
      cursor: '0',
    })
    await setProjectSourceAttached(projectId, sourceId, true)
    await setProjectSourceAttached(projectId, sourceId, false)

    expect(requests).toEqual([
        ['/api/sources', 'GET'],
        [`/api/projects/${projectId}/sources/${sourceId}`, 'PUT'],
        [`/api/projects/${projectId}/sources/${sourceId}`, 'DELETE'],
      ])
  })
})
