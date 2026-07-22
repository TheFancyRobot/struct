import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { Cause, Effect, Layer, Option } from 'effect'
import postgres from 'postgres'
import type postgresTypes from 'postgres'
import { ProjectId, WorkspaceId } from '@struct/domain'
import {
  ProjectConflictError,
  ProjectRepo,
  SqlClientLive,
} from '../index.js'

const DATABASE_URL = process.env['DATABASE_URL']
const describeIf = DATABASE_URL ? describe : describe.skip

const ownedWorkspaceId = WorkspaceId.make('560e8400-e29b-41d4-a716-446655440000')
const foreignWorkspaceId = WorkspaceId.make('560e8400-e29b-41d4-a716-446655440001')
const alphaId = ProjectId.make('560e8400-e29b-41d4-a716-446655440010')
const betaId = ProjectId.make('560e8400-e29b-41d4-a716-446655440011')
const foreignId = ProjectId.make('560e8400-e29b-41d4-a716-446655440012')
const concurrentAlphaId = ProjectId.make('560e8400-e29b-41d4-a716-446655440013')
const concurrentBetaId = ProjectId.make('560e8400-e29b-41d4-a716-446655440014')

async function cleanup(sql: postgresTypes.Sql) {
  await sql.unsafe(
    'DELETE FROM project_idempotency_keys WHERE workspace_id = ANY($1::uuid[])',
    [[ownedWorkspaceId, foreignWorkspaceId]],
  )
  await sql.unsafe(
    'DELETE FROM projects WHERE id = ANY($1::uuid[]) OR workspace_id = ANY($2::uuid[])',
    [[alphaId, betaId, foreignId, concurrentAlphaId, concurrentBetaId], [ownedWorkspaceId, foreignWorkspaceId]],
  )
  await sql.unsafe(
    'DELETE FROM workspaces WHERE id = ANY($1::uuid[])',
    [[ownedWorkspaceId, foreignWorkspaceId]],
  )
}

describeIf('project lifecycle repository integration', () => {
  let sql: postgresTypes.Sql

  beforeAll(async () => {
    if (!DATABASE_URL) return
    sql = postgres(DATABASE_URL, { max: 4, idle_timeout: 5 })
    await cleanup(sql)
    await sql.unsafe(
      'INSERT INTO workspaces (id, name) VALUES ($1, $2), ($3, $4)',
      [ownedWorkspaceId, 'Owned', foreignWorkspaceId, 'Foreign'],
    )
  })

  afterAll(async () => {
    if (!DATABASE_URL) return
    await cleanup(sql)
    await sql.end()
  })

  it('replays the first committed project for the same idempotency key', async () => {
    if (!DATABASE_URL) return

    const layer = Layer.provide(ProjectRepo.Default, SqlClientLive(sql))
    const firstCreatedAt = 10n
    const secondCreatedAt = 20n

    const result = await Effect.runPromise(Effect.gen(function* () {
      const repo = yield* ProjectRepo
      const first = yield* repo.createWithIdempotency({
        project: {
          id: alphaId,
          workspaceId: ownedWorkspaceId,
          name: 'Alpha',
          createdAt: firstCreatedAt,
          updatedAt: firstCreatedAt,
        },
        idempotencyKey: 'project:create:alpha',
      })
      const replay = yield* repo.createWithIdempotency({
        project: {
          id: betaId,
          workspaceId: ownedWorkspaceId,
          name: 'Beta',
          createdAt: secondCreatedAt,
          updatedAt: secondCreatedAt,
        },
        idempotencyKey: 'project:create:alpha',
      })
      const page = yield* repo.listByWorkspaceId(ownedWorkspaceId, { limit: 10 })
      return { first, replay, page }
    }).pipe(Effect.provide(layer)))

    expect(result.first.id).toBe(alphaId)
    expect(result.replay.id).toBe(alphaId)
    expect(result.page.items.map((item) => item.id)).toEqual([alphaId])
  })

  it('replays the first committed project for concurrent same-key creates', async () => {
    if (!DATABASE_URL) return

    const layer = Layer.provide(ProjectRepo.Default, SqlClientLive(sql))
    const now = 25n

    const [first, second] = await Promise.all([
      Effect.runPromise(ProjectRepo.createWithIdempotency({
        project: {
          id: concurrentAlphaId,
          workspaceId: ownedWorkspaceId,
          name: 'Concurrent roadmap',
          createdAt: now,
          updatedAt: now,
        },
        idempotencyKey: 'project:create:concurrent',
      }).pipe(Effect.provide(layer))),
      Effect.runPromise(ProjectRepo.createWithIdempotency({
        project: {
          id: concurrentBetaId,
          workspaceId: ownedWorkspaceId,
          name: 'Concurrent roadmap',
          createdAt: now + 1n,
          updatedAt: now + 1n,
        },
        idempotencyKey: 'project:create:concurrent',
      }).pipe(Effect.provide(layer))),
    ])

    expect(first.id).toBe(second.id)

    const page = await Effect.runPromise(ProjectRepo.listByWorkspaceId(
      ownedWorkspaceId,
      { limit: 20 },
    ).pipe(Effect.provide(layer)))

    expect(page.items.filter((item) => item.name === 'Concurrent roadmap').map((item) => item.id))
      .toEqual([first.id])
  })

  it('rejects case-only duplicates within one workspace and lists only owned projects', async () => {
    if (!DATABASE_URL) return

    const layer = Layer.provide(ProjectRepo.Default, SqlClientLive(sql))
    const now = 30n

    const duplicate = await Effect.runPromiseExit(Effect.gen(function* () {
      const repo = yield* ProjectRepo
      yield* repo.createWithIdempotency({
        project: {
          id: betaId,
          workspaceId: ownedWorkspaceId,
          name: 'Roadmap',
          createdAt: now,
          updatedAt: now,
        },
        idempotencyKey: 'project:create:roadmap',
      })
      return yield* repo.createWithIdempotency({
        project: {
          id: foreignId,
          workspaceId: ownedWorkspaceId,
          name: 'roadmap',
          createdAt: now + 1n,
          updatedAt: now + 1n,
        },
        idempotencyKey: 'project:create:roadmap-duplicate',
      })
    }).pipe(Effect.provide(layer)))

    expect(duplicate._tag).toBe('Failure')
    if (duplicate._tag === 'Failure') {
      const failure = Option.getOrUndefined(Cause.failureOption(duplicate.cause))
      expect(failure).toBeInstanceOf(ProjectConflictError)
      if (failure instanceof ProjectConflictError) {
        expect(failure.projectName).toBe('roadmap')
      }
      expect(String(duplicate.cause)).toContain(ProjectConflictError.name)
    }

    await sql.unsafe(
      'INSERT INTO projects (id, workspace_id, name, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW())',
      [foreignId, foreignWorkspaceId, 'Foreign project'],
    )

    const list = await Effect.runPromise(ProjectRepo.listByWorkspaceId(
      ownedWorkspaceId,
      { limit: 10 },
    ).pipe(Effect.provide(layer)))

    expect(list.items.every((item) => item.id !== foreignId)).toBe(true)
    expect(list.items.some((item) => item.name === 'Roadmap')).toBe(true)
  })
})
