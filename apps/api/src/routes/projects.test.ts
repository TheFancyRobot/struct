import { describe, expect, it } from 'bun:test'
import { Effect } from 'effect'
import { ProjectId, WorkspaceId } from '@struct/domain'
import { ProjectConflictError } from '@struct/persistence'
import { projectRoute } from './projects'

const workspaceId = WorkspaceId.make('570e8400-e29b-41d4-a716-446655440000')
const foreignWorkspaceId = WorkspaceId.make('570e8400-e29b-41d4-a716-446655440001')
const projectId = ProjectId.make('570e8400-e29b-41d4-a716-446655440010')
const project = {
  id: projectId,
  workspaceId,
  name: 'Café roadmap',
  createdAt: 1n,
  updatedAt: 2n,
}

describe('project lifecycle route', () => {
  it('lists projects from the authenticated workspace only', async () => {
    let receivedLimit = -1
    const response = await Effect.runPromise(projectRoute(
      new Request('http://localhost/api/projects'),
      { workspaceId },
      {
        listByWorkspaceId: (requestedWorkspaceId, options) => {
          expect(requestedWorkspaceId).toBe(workspaceId)
          receivedLimit = options.limit
          return Effect.succeed({ items: [project], nextCursor: null })
        },
        createWithIdempotency: () => Effect.die('create should not run'),
        findById: () => Effect.die('find should not run'),
        randomProjectId: () => projectId,
        now: () => 1n,
      },
    ))

    expect(receivedLimit).toBeGreaterThan(0)
    expect(response?.status).toBe(200)
    expect(await response?.json()).toEqual({
      items: [{
        id: project.id,
        name: project.name,
        createdAt: 1,
        updatedAt: 2,
      }],
      nextCursor: null,
    })
  })

  it('rejects malformed list cursors before repository access', async () => {
    let listCalled = false
    const response = await Effect.runPromise(projectRoute(
      new Request('http://localhost/api/projects?cursor=garbage'),
      { workspaceId },
      {
        listByWorkspaceId: () => {
          listCalled = true
          return Effect.succeed({ items: [project], nextCursor: null })
        },
        createWithIdempotency: () => Effect.die('create should not run'),
        findById: () => Effect.die('find should not run'),
        randomProjectId: () => projectId,
        now: () => 1n,
      },
    ))

    expect(listCalled).toBe(false)
    expect(response?.status).toBe(400)
    expect(await response?.json()).toEqual({ error: 'InvalidProjectListRequest' })
  })

  it('creates a project with an idempotency key and normalized input', async () => {
    let received: Record<string, unknown> | undefined
    const response = await Effect.runPromise(projectRoute(
      new Request('http://localhost/api/projects', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'idempotency-key': 'create:cafe',
        },
        body: JSON.stringify({ name: '  Cafe\u0301 roadmap  ' }),
      }),
      { workspaceId },
      {
        listByWorkspaceId: () => Effect.die('list should not run'),
        createWithIdempotency: (input) => {
          received = input as unknown as Record<string, unknown>
          return Effect.succeed(project)
        },
        findById: () => Effect.die('find should not run'),
        randomProjectId: () => projectId,
        now: () => 2n,
      },
    ))

    expect(received).toMatchObject({
      idempotencyKey: 'create:cafe',
      project: {
        id: projectId,
        workspaceId,
        name: 'Café roadmap',
      },
    })
    expect(response?.status).toBe(201)
  })

  it('maps malformed create json to a bounded invalid-request response', async () => {
    let createCalled = false
    const response = await Effect.runPromise(projectRoute(
      new Request('http://localhost/api/projects', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'idempotency-key': 'create:invalid-json',
        },
        body: '{"name":"Café roadmap"',
      }),
      { workspaceId },
      {
        listByWorkspaceId: () => Effect.die('list should not run'),
        createWithIdempotency: () => {
          createCalled = true
          return Effect.succeed(project)
        },
        findById: () => Effect.die('find should not run'),
        randomProjectId: () => projectId,
        now: () => 2n,
      },
    ))

    expect(createCalled).toBe(false)
    expect(response?.status).toBe(400)
    expect(await response?.json()).toEqual({ error: 'InvalidProjectCreateRequest' })
  })

  it('maps duplicate names to a bounded conflict response', async () => {
    const response = await Effect.runPromise(projectRoute(
      new Request('http://localhost/api/projects', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'idempotency-key': 'create:duplicate',
        },
        body: JSON.stringify({ name: 'Roadmap' }),
      }),
      { workspaceId },
      {
        listByWorkspaceId: () => Effect.die('list should not run'),
        createWithIdempotency: () => Effect.fail(new ProjectConflictError({
          workspaceId,
          projectName: 'Roadmap',
          message: 'Project name already exists',
        })),
        findById: () => Effect.die('find should not run'),
        randomProjectId: () => projectId,
        now: () => 2n,
      },
    ))

    expect(response?.status).toBe(409)
    expect(await response?.json()).toEqual({ error: 'ProjectNameAlreadyExists' })
  })

  it('returns not found for foreign, malformed, and guessed project ids', async () => {
    const foreign = await Effect.runPromise(projectRoute(
      new Request(`http://localhost/api/projects/${projectId}`),
      { workspaceId },
      {
        listByWorkspaceId: () => Effect.die('list should not run'),
        createWithIdempotency: () => Effect.die('create should not run'),
        findById: () => Effect.succeed({ ...project, workspaceId: foreignWorkspaceId }),
        randomProjectId: () => projectId,
        now: () => 2n,
      },
    ))
    expect(foreign?.status).toBe(404)
    expect(await foreign?.json()).toEqual({ error: 'ProjectNotFound' })

    const malformed = await Effect.runPromise(projectRoute(
      new Request('http://localhost/api/projects/not-a-project-id'),
      { workspaceId },
      {
        listByWorkspaceId: () => Effect.die('list should not run'),
        createWithIdempotency: () => Effect.die('create should not run'),
        findById: () => Effect.die('find should not run'),
        randomProjectId: () => projectId,
        now: () => 2n,
      },
    ))
    expect(malformed?.status).toBe(404)
  })

  it('does not claim nested project routes owned by later slices', async () => {
    const response = await Effect.runPromise(projectRoute(
      new Request(`http://localhost/api/projects/${projectId}/research/thread`),
      { workspaceId },
      {
        listByWorkspaceId: () => Effect.die('must not run'),
        createWithIdempotency: () => Effect.die('must not run'),
        findById: () => Effect.die('must not run'),
        randomProjectId: () => projectId,
        now: () => 2n,
      },
    ))

    expect(response).toBeUndefined()
  })
})
