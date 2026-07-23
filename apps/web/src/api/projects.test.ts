import { afterEach, describe, expect, it } from 'bun:test'
import { ProjectId } from '@struct/domain'
import {
  ProjectNameConflictError,
  createProject,
  fetchProject,
  fetchProjects,
} from './projects'

const originalFetch = globalThis.fetch
const projectId = ProjectId.make('590e8400-e29b-41d4-a716-446655440010')

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('project lifecycle api client', () => {
  it('lists decoded projects from the typed api route', async () => {
    globalThis.fetch = Object.assign(async () => new Response(JSON.stringify({
      items: [{ id: projectId, name: 'Alpha', createdAt: 1, updatedAt: 2 }],
      nextCursor: null,
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }), { preconnect: originalFetch.preconnect })

    const page = await fetchProjects()
    expect(page.items[0]?.id).toBe(projectId)
    expect(page.items[0]?.createdAt).toBe(1n)
    expect(page.nextCursor).toBeNull()
  })

  it('creates projects without sending workspace ids and includes idempotency', async () => {
    let request: Request | undefined
    globalThis.fetch = Object.assign(async (input: RequestInfo | URL, init?: RequestInit) => {
      request = input instanceof Request
        ? input
        : new Request(new URL(String(input), 'http://web.local'), init)
      return new Response(JSON.stringify({
        id: projectId,
        name: 'Café',
        createdAt: 1,
        updatedAt: 2,
      }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      })
    }, { preconnect: originalFetch.preconnect })

    const created = await createProject('Café', 'create:cafe')

    expect(created.id).toBe(projectId)
    expect(request?.headers.get('idempotency-key')).toBe('create:cafe')
    expect(await request?.json()).toEqual({ name: 'Café' })
  })

  it('maps duplicate names to a typed client error', async () => {
    globalThis.fetch = Object.assign(async () => new Response(
      JSON.stringify({ error: 'ProjectNameAlreadyExists' }),
      {
        status: 409,
        headers: { 'content-type': 'application/json' },
      },
    ), { preconnect: originalFetch.preconnect })

    await expect(createProject('Roadmap', 'create:roadmap')).rejects.toBeInstanceOf(
      ProjectNameConflictError,
    )
  })

  it('returns null for tenant-safe not-found project reads', async () => {
    globalThis.fetch = Object.assign(async () => new Response(
      JSON.stringify({ error: 'ProjectNotFound' }),
      {
        status: 404,
        headers: { 'content-type': 'application/json' },
      },
    ), { preconnect: originalFetch.preconnect })

    await expect(fetchProject(projectId)).resolves.toBeNull()
  })
})
