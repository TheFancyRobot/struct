import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { Effect, Layer } from 'effect'
import postgres from 'postgres'
import type postgresTypes from 'postgres'
import { ProjectId, WorkspaceId } from '@struct/domain'
import {
  ProjectRepo,
  SqlClientLive,
} from '@struct/persistence'
import { projectRoute } from './projects'

const DATABASE_URL = process.env['DATABASE_URL']
const describeIf = DATABASE_URL ? describe : describe.skip

const workspaceId = WorkspaceId.make('580e8400-e29b-41d4-a716-446655440000')
const foreignWorkspaceId = WorkspaceId.make('580e8400-e29b-41d4-a716-446655440001')
const alphaId = ProjectId.make('580e8400-e29b-41d4-a716-446655440010')
const foreignId = ProjectId.make('580e8400-e29b-41d4-a716-446655440011')

async function cleanup(sql: postgresTypes.Sql) {
  await sql.unsafe(
    'DELETE FROM project_idempotency_keys WHERE workspace_id = ANY($1::uuid[])',
    [[workspaceId, foreignWorkspaceId]],
  )
  await sql.unsafe(
    'DELETE FROM projects WHERE id = ANY($1::uuid[]) OR workspace_id = ANY($2::uuid[])',
    [[alphaId, foreignId], [workspaceId, foreignWorkspaceId]],
  )
  await sql.unsafe(
    'DELETE FROM workspaces WHERE id = ANY($1::uuid[])',
    [[workspaceId, foreignWorkspaceId]],
  )
}

describeIf('project lifecycle route integration', () => {
  let sql: postgresTypes.Sql
  let layer: Layer.Layer<ProjectRepo, never, never>

  beforeAll(async () => {
    if (!DATABASE_URL) return
    sql = postgres(DATABASE_URL, { max: 1, idle_timeout: 5 })
    layer = Layer.provide(ProjectRepo.Default, SqlClientLive(sql))
    await cleanup(sql)
    await sql.unsafe(
      'INSERT INTO workspaces (id, name) VALUES ($1, $2), ($3, $4)',
      [workspaceId, 'Owned', foreignWorkspaceId, 'Foreign'],
    )
    await sql.unsafe(
      'INSERT INTO projects (id, workspace_id, name, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW())',
      [foreignId, foreignWorkspaceId, 'Foreign project'],
    )
  })

  afterAll(async () => {
    if (!DATABASE_URL) return
    await cleanup(sql)
    await sql.end()
  })

  it('creates, replays, and lists only authorized projects through the route contract', async () => {
    if (!DATABASE_URL) return

    const deps = {
      listByWorkspaceId: (requestedWorkspaceId: typeof WorkspaceId.Type, options: { limit: number, cursor?: string | null }) =>
        ProjectRepo.listByWorkspaceId(requestedWorkspaceId, options).pipe(Effect.provide(layer)),
      createWithIdempotency: (input: { project: { id: typeof ProjectId.Type, workspaceId: typeof WorkspaceId.Type, name: string, createdAt: bigint, updatedAt: bigint }, idempotencyKey: string }) =>
        ProjectRepo.createWithIdempotency(input).pipe(Effect.provide(layer)),
      findById: (requestedProjectId: typeof ProjectId.Type) =>
        ProjectRepo.findById(requestedProjectId).pipe(Effect.provide(layer)),
      randomProjectId: () => alphaId,
      now: () => 10n,
    }

    const first = await Effect.runPromise(projectRoute(
      new Request('http://localhost/api/projects', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'idempotency-key': 'project:create:alpha',
        },
        body: JSON.stringify({ name: 'Alpha' }),
      }),
      { workspaceId },
      deps,
    ))
    expect(first?.status).toBe(201)

    const replay = await Effect.runPromise(projectRoute(
      new Request('http://localhost/api/projects', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'idempotency-key': 'project:create:alpha',
        },
        body: JSON.stringify({ name: 'Alpha again' }),
      }),
      { workspaceId },
      deps,
    ))
    expect(replay?.status).toBe(201)
    expect(await replay?.json()).toEqual(await first?.json())

    const list = await Effect.runPromise(projectRoute(
      new Request('http://localhost/api/projects'),
      { workspaceId },
      deps,
    ))
    expect(list?.status).toBe(200)
    const body = await list?.json() as { items: Array<{ id: string }> }
    expect(body.items.map((item) => item.id)).toEqual([alphaId])

    const foreign = await Effect.runPromise(projectRoute(
      new Request(`http://localhost/api/projects/${foreignId}`),
      { workspaceId },
      deps,
    ))
    expect(foreign?.status).toBe(404)
    expect(await foreign?.json()).toEqual({ error: 'ProjectNotFound' })
  })
})
