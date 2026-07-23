import { describe, expect, it } from 'bun:test'
import { Effect, Layer } from 'effect'
import { ProjectId, WorkspaceId } from '@struct/domain'
import { ProjectRepo, SqlClientTest } from '../index.js'

const workspaceId = WorkspaceId.make('5f0e8400-e29b-41d4-a716-446655440000')
const projectId = ProjectId.make('5f0e8400-e29b-41d4-a716-446655440010')
const createdAt = new Date(10)
const updatedAt = new Date(20)
const projectRow = {
  id: projectId,
  workspace_id: workspaceId,
  name: 'Concurrent roadmap',
  created_at: createdAt,
  updated_at: updatedAt,
}

describe('project lifecycle repository conflict handling', () => {
  it('replays a same-key create after a concurrent name conflict commits first', async () => {
    const queries: string[] = []
    const layer = Layer.provide(ProjectRepo.Default, SqlClientTest(async (query) => {
      queries.push(query)
      if (query.includes('FROM project_idempotency_keys') && query.includes('FOR UPDATE')) {
        return []
      }
      if (query.includes('INSERT INTO projects')) {
        throw {
          code: '23505',
          constraint: 'projects_workspace_name_ci_idx',
          message: 'duplicate key value violates unique constraint "projects_workspace_name_ci_idx"',
        }
      }
      if (query.includes('FROM project_idempotency_keys AS k')) {
        return [projectRow]
      }
      throw new Error(`Unexpected query: ${query}`)
    }))

    const project = await Effect.runPromise(ProjectRepo.createWithIdempotency({
      project: {
        id: projectId,
        workspaceId,
        name: 'Concurrent roadmap',
        createdAt: 10n,
        updatedAt: 20n,
      },
      idempotencyKey: 'project:create:concurrent',
    }).pipe(Effect.provide(layer)))

    expect(project.id).toBe(projectId)
    expect(queries.some((query) => query.includes('FROM project_idempotency_keys AS k'))).toBe(true)
  })

  it('replays an idempotent create when the database reports the table primary key instead of the named index', async () => {
    const layer = Layer.provide(ProjectRepo.Default, SqlClientTest(async (query) => {
      if (query.includes('FROM project_idempotency_keys') && query.includes('FOR UPDATE')) {
        return []
      }
      if (query.includes('INSERT INTO projects')) {
        return [projectRow]
      }
      if (query.includes('INSERT INTO project_idempotency_keys')) {
        throw {
          code: '23505',
          constraint: 'project_idempotency_keys_pkey',
          message: 'duplicate key value violates unique constraint "project_idempotency_keys_pkey"',
        }
      }
      if (query.includes('FROM project_idempotency_keys AS k')) {
        return [projectRow]
      }
      throw new Error(`Unexpected query: ${query}`)
    }))

    const project = await Effect.runPromise(ProjectRepo.createWithIdempotency({
      project: {
        id: projectId,
        workspaceId,
        name: 'Concurrent roadmap',
        createdAt: 10n,
        updatedAt: 20n,
      },
      idempotencyKey: 'project:create:concurrent',
    }).pipe(Effect.provide(layer)))

    expect(project.id).toBe(projectId)
    expect(project.name).toBe('Concurrent roadmap')
  })
})
