import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import { Effect, Exit, Layer } from 'effect'
import postgres from 'postgres'
import type postgresTypes from 'postgres'
import {
  ProjectId,
  SourceId,
  SourceVersionId,
  WorkspaceId,
} from '@struct/domain'
import {
  SourceTextReindexOwnershipLostError,
  SourceTextReindexRepo,
  SqlClientLive,
} from '../index.js'

const DATABASE_URL = process.env['DATABASE_URL']
const describeIf = DATABASE_URL ? describe : describe.skip
const workspaceId = WorkspaceId.make('c70e8400-e29b-41d4-a716-446655440000')
const projectId = ProjectId.make('c70e8400-e29b-41d4-a716-446655440001')
const sourceId = SourceId.make('c70e8400-e29b-41d4-a716-446655440002')
const renewableVersionId =
  SourceVersionId.make('c70e8400-e29b-41d4-a716-446655440003')
const retryVersionId =
  SourceVersionId.make('c70e8400-e29b-41d4-a716-446655440004')
const exhaustedVersionId =
  SourceVersionId.make('c70e8400-e29b-41d4-a716-446655440005')

describeIf('SourceTextReindexRepo leases (PostgreSQL)', () => {
  let sql: postgresTypes.Sql
  let layer: Layer.Layer<SourceTextReindexRepo>

  beforeAll(async () => {
    if (!DATABASE_URL) return
    sql = postgres(DATABASE_URL, { max: 2, idle_timeout: 5 })
    layer = Layer.provide(SourceTextReindexRepo.Default, SqlClientLive(sql))
    await sql.unsafe(`DELETE FROM workspaces WHERE id = $1`, [workspaceId])
    await sql.unsafe(
      `INSERT INTO workspaces (id, name) VALUES ($1, 'Reindex Lease Workspace')`,
      [workspaceId],
    )
    await sql.unsafe(
      `INSERT INTO projects (id, workspace_id, name)
       VALUES ($1, $2, 'Reindex Lease Project')`,
      [projectId, workspaceId],
    )
    await sql.unsafe(
      `INSERT INTO sources (id, project_id, name, kind)
       VALUES ($1, $2, 'reindex.txt', 'document')`,
      [sourceId, projectId],
    )
    await sql.unsafe(
      `INSERT INTO source_versions (
         id, source_id, version, artifact_ref, content_hash
       )
       VALUES
         ($1, $4, 1, 'artifact://reindex-renew', 'sha256:reindex-renew'),
         ($2, $4, 2, 'artifact://reindex-retry', 'sha256:reindex-retry'),
         ($3, $4, 3, 'artifact://reindex-exhausted', 'sha256:reindex-exhausted')`,
      [renewableVersionId, retryVersionId, exhaustedVersionId, sourceId],
    )
  })

  beforeEach(async () => {
    await sql.unsafe(
      `UPDATE source_text_reindex_jobs
       SET status = 'in-progress',
           attempts = CASE
             WHEN source_version_id = $2 THEN 3
             ELSE 1
           END,
           max_attempts = 3,
           last_error_code = NULL,
           updated_at = CASE
             WHEN source_version_id = $1 THEN NOW() - INTERVAL '1 hour'
             ELSE NOW() - INTERVAL '10 minutes'
           END
       WHERE source_version_id = ANY($3::uuid[])`,
      [
        renewableVersionId,
        exhaustedVersionId,
        [renewableVersionId, retryVersionId, exhaustedVersionId],
      ],
    )
  })

  afterAll(async () => {
    if (!sql) return
    await sql.unsafe(`DELETE FROM workspaces WHERE id = $1`, [workspaceId])
    await sql.end()
  })

  it('renews only the exact workspace, project, source version, and attempt', async () => {
    const job = {
      sourceVersionId: renewableVersionId,
      workspaceId,
      projectId,
      artifactRef: 'artifact://reindex-renew',
      contentHash: 'sha256:reindex-renew',
      status: 'in-progress',
      attempts: 1,
      maxAttempts: 3,
    } as const

    await Effect.runPromise(
      SourceTextReindexRepo.renewLease(job).pipe(Effect.provide(layer)),
    )
    const [renewed] = await sql.unsafe(
      `SELECT updated_at > NOW() - INTERVAL '5 seconds' AS fresh
       FROM source_text_reindex_jobs WHERE source_version_id = $1`,
      [renewableVersionId],
    )
    expect(renewed?.['fresh']).toBe(true)

    await sql.unsafe(
      `UPDATE source_text_reindex_jobs
       SET updated_at = NOW() - INTERVAL '1 hour'
       WHERE source_version_id = $1`,
      [renewableVersionId],
    )
    const rejected = await Promise.all([
      Effect.runPromiseExit(
        SourceTextReindexRepo.renewLease({
          ...job,
          workspaceId: WorkspaceId.make(
            'c70e8400-e29b-41d4-a716-446655440010',
          ),
        }).pipe(Effect.provide(layer)),
      ),
      Effect.runPromiseExit(
        SourceTextReindexRepo.renewLease({
          ...job,
          projectId: ProjectId.make(
            'c70e8400-e29b-41d4-a716-446655440011',
          ),
        }).pipe(Effect.provide(layer)),
      ),
      Effect.runPromiseExit(
        SourceTextReindexRepo.renewLease({ ...job, attempts: 2 }).pipe(
          Effect.provide(layer),
        ),
      ),
    ])
    expect(rejected.every(Exit.isFailure)).toBe(true)
    expect(rejected.every((exit) =>
      String(exit).includes(SourceTextReindexOwnershipLostError.name))).toBe(true)
    const [stillStale] = await sql.unsafe(
      `SELECT updated_at < NOW() - INTERVAL '59 minutes' AS stale
       FROM source_text_reindex_jobs WHERE source_version_id = $1`,
      [renewableVersionId],
    )
    expect(stillStale?.['stale']).toBe(true)
  })

  it('recovers stale retryable and exhausted leases using PostgreSQL time', async () => {
    await sql.unsafe(
      `UPDATE source_text_reindex_jobs
       SET updated_at = NOW()
       WHERE source_version_id = $1`,
      [renewableVersionId],
    )

    await Effect.runPromise(
      SourceTextReindexRepo.recoverStale(300_000).pipe(Effect.provide(layer)),
    )

    const rows = await sql.unsafe(
      `SELECT source_version_id, status, attempts, last_error_code
       FROM source_text_reindex_jobs
       WHERE source_version_id = ANY($1::uuid[])
       ORDER BY source_version_id`,
      [[renewableVersionId, retryVersionId, exhaustedVersionId]],
    )
    expect(rows.map((row) => ({
      sourceVersionId: row['source_version_id'],
      status: row['status'],
      attempts: row['attempts'],
      lastErrorCode: row['last_error_code'],
    }))).toEqual([
      {
        sourceVersionId: renewableVersionId,
        status: 'in-progress',
        attempts: 1,
        lastErrorCode: null,
      },
      {
        sourceVersionId: retryVersionId,
        status: 'pending',
        attempts: 1,
        lastErrorCode: 'stale-lease',
      },
      {
        sourceVersionId: exhaustedVersionId,
        status: 'failed',
        attempts: 3,
        lastErrorCode: 'stale-lease-exhausted',
      },
    ])
  })

  it('rejects failure recording after ownership moves to a newer attempt', async () => {
    const staleJob = {
      sourceVersionId: renewableVersionId,
      workspaceId,
      projectId,
      artifactRef: 'artifact://reindex-renew',
      contentHash: 'sha256:reindex-renew',
      status: 'in-progress',
      attempts: 1,
      maxAttempts: 3,
    } as const
    await sql.unsafe(
      `UPDATE source_text_reindex_jobs
       SET attempts = 2, updated_at = NOW()
       WHERE source_version_id = $1`,
      [renewableVersionId],
    )

    const exit = await Effect.runPromiseExit(
      SourceTextReindexRepo.recordFailure(
        staleJob,
        'artifact-unavailable',
      ).pipe(Effect.provide(layer)),
    )
    expect(Exit.isFailure(exit)).toBe(true)
    expect(String(exit)).toContain(SourceTextReindexOwnershipLostError.name)
    const [owned] = await sql.unsafe(
      `SELECT status, attempts, last_error_code
       FROM source_text_reindex_jobs WHERE source_version_id = $1`,
      [renewableVersionId],
    )
    expect(owned).toMatchObject({
      status: 'in-progress',
      attempts: 2,
      last_error_code: null,
    })
  })
})
