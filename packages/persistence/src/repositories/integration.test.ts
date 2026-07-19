/**
 * Repository integration tests — round-trip create/read tests against PostgreSQL.
 *
 * These tests require a real PostgreSQL database with migrations applied.
 * Use `bun run db:up` to start the container and `bun run db:migrate` to apply migrations.
 *
 * Tests are skipped if DATABASE_URL is not set (CI environments may not have a database).
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { Effect, Layer } from 'effect'
import postgres from 'postgres'
import type postgresTypes from 'postgres'
import {
  WorkspaceId,
  ProjectId,
  SourceId,
  SourceVersionId,
  ResearchThreadId,
  ResearchRunId,
  CitationId,
} from '@struct/domain'
import {
  WorkspaceRepo,
  ProjectRepo,
  SourceRepo,
  SourceVersionRepo,
  ResearchThreadRepo,
  ResearchRunRepo,
  CitationRepo,
  SqlClientLive,
} from '../index.js'

const DATABASE_URL = process.env['DATABASE_URL']

const WORKSPACE_ID = '550e8400-e29b-41d4-a716-446655440000'
const PROJECT_ID = '550e8400-e29b-41d4-a716-446655440001'
const SOURCE_ID = '550e8400-e29b-41d4-a716-446655440002'
const SOURCE_VERSION_ID = '550e8400-e29b-41d4-a716-446655440003'
const THREAD_ID = '550e8400-e29b-41d4-a716-446655440004'
const RUN_ID = '550e8400-e29b-41d4-a716-446655440005'
const CITATION_ID = '550e8400-e29b-41d4-a716-446655440006'

// Skip all tests if no database is available
const describeIf = DATABASE_URL ? describe : describe.skip

async function cleanupFixtureRows(sql: postgresTypes.Sql): Promise<void> {
  await sql.unsafe(`DELETE FROM citations WHERE id = '${CITATION_ID}' OR run_id = '${RUN_ID}'`)
  await sql.unsafe(`DELETE FROM research_runs WHERE id = '${RUN_ID}' OR thread_id = '${THREAD_ID}'`)
  await sql.unsafe(`DELETE FROM research_threads WHERE id = '${THREAD_ID}' OR project_id = '${PROJECT_ID}'`)
  await sql.unsafe(`DELETE FROM source_versions WHERE id = '${SOURCE_VERSION_ID}' OR source_id = '${SOURCE_ID}'`)
  await sql.unsafe(`DELETE FROM sources WHERE id = '${SOURCE_ID}' OR project_id = '${PROJECT_ID}'`)
  await sql.unsafe(`DELETE FROM projects WHERE id = '${PROJECT_ID}' OR workspace_id = '${WORKSPACE_ID}'`)
  await sql.unsafe(`DELETE FROM workspaces WHERE id = '${WORKSPACE_ID}'`)
}

describeIf('Repository Integration Tests (PostgreSQL)', () => {
  let sql: postgresTypes.Sql

  beforeAll(async () => {
    if (!DATABASE_URL) return
    sql = postgres(DATABASE_URL, {
      max: 1,
      idle_timeout: 5,
    })
    await cleanupFixtureRows(sql)
  })

  afterAll(async () => {
    if (sql) {
      await cleanupFixtureRows(sql)
      await sql.end()
    }
  })

  describe('WorkspaceRepo', () => {
    it('creates and retrieves a workspace', async () => {
      if (!sql) return

      const sqlLayer = SqlClientLive(sql)
      const layer = Layer.provide(WorkspaceRepo.Default, sqlLayer)

      const workspaceId = WorkspaceId.make('550e8400-e29b-41d4-a716-446655440000')
      const now = BigInt(Date.now())
      const workspace = {
        id: workspaceId,
        name: 'Test Workspace',
        createdAt: now,
        updatedAt: now,
      }

      const program = Effect.gen(function* () {
        const repo = yield* WorkspaceRepo
        const created = yield* repo.create(workspace)
        const retrieved = yield* repo.findById(workspaceId)
        return { created, retrieved }
      })

      const result = await Effect.runPromise(program.pipe(Effect.provide(layer)))

      expect(result.created.id).toBe(workspaceId)
      expect(result.created.name).toBe('Test Workspace')
      expect(result.retrieved.id).toBe(workspaceId)
      expect(result.retrieved.name).toBe('Test Workspace')
    })
  })

  describe('ProjectRepo', () => {
    it('creates and retrieves a project', async () => {
      if (!sql) return

      const sqlLayer = SqlClientLive(sql)
      const layer = Layer.provide(ProjectRepo.Default, sqlLayer)

      const projectId = ProjectId.make('550e8400-e29b-41d4-a716-446655440001')
      const workspaceId = WorkspaceId.make('550e8400-e29b-41d4-a716-446655440000')
      const now = BigInt(Date.now())
      const project = {
        id: projectId,
        workspaceId,
        name: 'Test Project',
        createdAt: now,
        updatedAt: now,
      }

      const program = Effect.gen(function* () {
        const repo = yield* ProjectRepo
        const created = yield* repo.create(project)
        const retrieved = yield* repo.findById(projectId)
        return { created, retrieved }
      })

      const result = await Effect.runPromise(program.pipe(Effect.provide(layer)))

      expect(result.created.id).toBe(projectId)
      expect(result.created.workspaceId).toBe(workspaceId)
      expect(result.retrieved.id).toBe(projectId)
    })
  })

  describe('SourceRepo', () => {
    it('creates and retrieves a source', async () => {
      if (!sql) return

      const sqlLayer = SqlClientLive(sql)
      const layer = Layer.provide(SourceRepo.Default, sqlLayer)

      const sourceId = SourceId.make('550e8400-e29b-41d4-a716-446655440002')
      const projectId = ProjectId.make('550e8400-e29b-41d4-a716-446655440001')
      const now = BigInt(Date.now())
      const source = {
        id: sourceId,
        projectId,
        name: 'Test Source',
        kind: 'document' as const,
        createdAt: now,
        updatedAt: now,
      }

      const program = Effect.gen(function* () {
        const repo = yield* SourceRepo
        const created = yield* repo.create(source)
        const retrieved = yield* repo.findById(sourceId)
        return { created, retrieved }
      })

      const result = await Effect.runPromise(program.pipe(Effect.provide(layer)))

      expect(result.created.id).toBe(sourceId)
      expect(result.created.kind).toBe('document')
      expect(result.retrieved.id).toBe(sourceId)
    })
  })

  describe('SourceVersionRepo', () => {
    it('creates and retrieves a source version', async () => {
      if (!sql) return

      const sqlLayer = SqlClientLive(sql)
      const layer = Layer.provide(SourceVersionRepo.Default, sqlLayer)

      const versionId = SourceVersionId.make('550e8400-e29b-41d4-a716-446655440003')
      const sourceId = SourceId.make('550e8400-e29b-41d4-a716-446655440002')
      const now = BigInt(Date.now())
      const version = {
        id: versionId,
        sourceId,
        version: 1,
        artifactRef: 'artifacts/test.pdf',
        contentHash: 'sha256:abc123',
        createdAt: now,
      }

      const program = Effect.gen(function* () {
        const repo = yield* SourceVersionRepo
        const created = yield* repo.create(version)
        const retrieved = yield* repo.findById(versionId)
        return { created, retrieved }
      })

      const result = await Effect.runPromise(program.pipe(Effect.provide(layer)))

      expect(result.created.id).toBe(versionId)
      expect(result.created.contentHash).toBe('sha256:abc123')
      expect(result.retrieved.id).toBe(versionId)
    })
  })

  describe('ResearchThreadRepo', () => {
    it('creates and retrieves a research thread', async () => {
      if (!sql) return

      const sqlLayer = SqlClientLive(sql)
      const layer = Layer.provide(ResearchThreadRepo.Default, sqlLayer)

      const threadId = ResearchThreadId.make('550e8400-e29b-41d4-a716-446655440004')
      const projectId = ProjectId.make('550e8400-e29b-41d4-a716-446655440001')
      const now = BigInt(Date.now())
      const thread = {
        id: threadId,
        projectId,
        title: 'Test Research Thread',
        createdAt: now,
        updatedAt: now,
      }

      const program = Effect.gen(function* () {
        const repo = yield* ResearchThreadRepo
        const created = yield* repo.create(thread)
        const retrieved = yield* repo.findById(threadId)
        return { created, retrieved }
      })

      const result = await Effect.runPromise(program.pipe(Effect.provide(layer)))

      expect(result.created.id).toBe(threadId)
      expect(result.created.title).toBe('Test Research Thread')
      expect(result.retrieved.id).toBe(threadId)
    })
  })

  describe('ResearchRunRepo', () => {
    it('creates and retrieves a research run', async () => {
      if (!sql) return

      const sqlLayer = SqlClientLive(sql)
      const layer = Layer.provide(ResearchRunRepo.Default, sqlLayer)

      const runId = ResearchRunId.make('550e8400-e29b-41d4-a716-446655440005')
      const threadId = ResearchThreadId.make('550e8400-e29b-41d4-a716-446655440004')
      const now = BigInt(Date.now())
      const run = {
        id: runId,
        threadId,
        question: 'What is X?',
        status: 'in-progress' as const,
        createdAt: now,
        updatedAt: now,
      }

      const program = Effect.gen(function* () {
        const repo = yield* ResearchRunRepo
        const created = yield* repo.create(run)
        const retrieved = yield* repo.findById(runId)
        return { created, retrieved }
      })

      const result = await Effect.runPromise(program.pipe(Effect.provide(layer)))

      expect(result.created.id).toBe(runId)
      expect(result.created.status).toBe('in-progress')
      expect(result.retrieved.id).toBe(runId)
    })
  })

  describe('CitationRepo', () => {
    it('creates and retrieves a citation', async () => {
      if (!sql) return

      const sqlLayer = SqlClientLive(sql)
      const layer = Layer.provide(CitationRepo.Default, sqlLayer)

      const citationId = CitationId.make('550e8400-e29b-41d4-a716-446655440006')
      const runId = ResearchRunId.make('550e8400-e29b-41d4-a716-446655440005')
      const sourceVersionId = SourceVersionId.make('550e8400-e29b-41d4-a716-446655440003')
      const now = BigInt(Date.now())
      const citation = {
        id: citationId,
        runId,
        sourceVersionId,
        locator: 'page:5,para:2',
        status: 'validated' as const,
        createdAt: now,
      }

      const program = Effect.gen(function* () {
        const repo = yield* CitationRepo
        const created = yield* repo.create(citation)
        const retrieved = yield* repo.findById(citationId)
        return { created, retrieved }
      })

      const result = await Effect.runPromise(program.pipe(Effect.provide(layer)))

      expect(result.created.id).toBe(citationId)
      expect(result.created.sourceVersionId).toBe(sourceVersionId)
      expect(result.retrieved.id).toBe(citationId)
    })
  })
})
