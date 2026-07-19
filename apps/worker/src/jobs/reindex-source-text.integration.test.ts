import { createHash } from 'node:crypto'
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
  QueryError,
  SourceTextReindexRepo,
  SqlClientLive,
} from '@struct/persistence'
import { processOneSourceTextReindex } from './reindex-source-text'

const DATABASE_URL = process.env['DATABASE_URL']
const describeIf = DATABASE_URL ? describe : describe.skip
const workspaceId = WorkspaceId.make('d70e8400-e29b-41d4-a716-446655440000')
const projectId = ProjectId.make('d70e8400-e29b-41d4-a716-446655440001')
const sourceId = SourceId.make('d70e8400-e29b-41d4-a716-446655440002')
const sourceVersionId =
  SourceVersionId.make('d70e8400-e29b-41d4-a716-446655440003')
const manifestRef =
  'artifact://sha256/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaad'
const normalizedRef =
  'artifact://sha256/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbba'
const normalizedBytes = new TextEncoder().encode('Reindex lease content.\n')
const contentHash =
  `sha256:${createHash('sha256').update(normalizedBytes).digest('hex')}`
const manifestBytes = new TextEncoder().encode(JSON.stringify({
  kind: 'text-source-manifest',
  version: 1,
  normalizedRef,
  contentHash,
}))

describeIf('source-text reindex worker leases (PostgreSQL)', () => {
  let sql: postgresTypes.Sql
  let layer: Layer.Layer<SourceTextReindexRepo>

  beforeAll(async () => {
    if (!DATABASE_URL) return
    sql = postgres(DATABASE_URL, { max: 2, idle_timeout: 5 })
    layer = Layer.provide(SourceTextReindexRepo.Default, SqlClientLive(sql))
    await sql.unsafe(`DELETE FROM workspaces WHERE id = $1`, [workspaceId])
    await sql.unsafe(
      `INSERT INTO workspaces (id, name) VALUES ($1, 'Reindex Worker Lease')`,
      [workspaceId],
    )
    await sql.unsafe(
      `INSERT INTO projects (id, workspace_id, name)
       VALUES ($1, $2, 'Reindex Worker Project')`,
      [projectId, workspaceId],
    )
    await sql.unsafe(
      `INSERT INTO sources (id, project_id, name, kind)
       VALUES ($1, $2, 'worker-reindex.txt', 'document')`,
      [sourceId, projectId],
    )
    await sql.unsafe(
      `INSERT INTO source_versions (
         id, source_id, version, artifact_ref, content_hash
       )
       VALUES ($1, $2, 1, $3, $4)`,
      [sourceVersionId, sourceId, manifestRef, contentHash],
    )
  })

  beforeEach(async () => {
    await sql.unsafe(`DELETE FROM source_text_index WHERE source_version_id = $1`, [
      sourceVersionId,
    ])
    await sql.unsafe(
      `UPDATE source_text_reindex_jobs
       SET status = 'pending',
           attempts = 0,
           max_attempts = 3,
           last_error_code = NULL,
           updated_at = NOW()
       WHERE source_version_id = $1`,
      [sourceVersionId],
    )
  })

  afterAll(async () => {
    if (!sql) return
    await sql.unsafe(`DELETE FROM workspaces WHERE id = $1`, [workspaceId])
    await sql.end()
  })

  const store = {
    readObject: (ref: string) =>
      Effect.succeed({
        bytes: ref === manifestRef ? manifestBytes : normalizedBytes,
        byteLength: ref === manifestRef
          ? manifestBytes.byteLength
          : normalizedBytes.byteLength,
      }),
  }

  it('interrupts indexing without late terminal writes when PostgreSQL ownership moves', async () => {
    let renewals = 0
    let interrupted = false
    const result = await Effect.runPromise(processOneSourceTextReindex({
      staleAfterMs: 300_000,
      heartbeatIntervalMs: 2,
      jobs: {
        recoverStale: (staleAfterMs) =>
          SourceTextReindexRepo.recoverStale(staleAfterMs).pipe(
            Effect.provide(layer),
          ),
        claimNext: () =>
          SourceTextReindexRepo.claimNext().pipe(Effect.provide(layer)),
        renewLease: (job) =>
          Effect.gen(function* () {
            renewals += 1
            if (renewals === 2) {
              yield* Effect.promise(() =>
                sql.unsafe(
                  `UPDATE source_text_reindex_jobs
                   SET attempts = attempts + 1, updated_at = NOW()
                   WHERE source_version_id = $1`,
                  [sourceVersionId],
                ).then(() => undefined),
              )
            }
            yield* SourceTextReindexRepo.renewLease(job).pipe(
              Effect.provide(layer),
            )
          }),
        recordFailure: (job, errorCode) =>
          SourceTextReindexRepo.recordFailure(job, errorCode).pipe(
            Effect.provide(layer),
          ),
      },
      store,
      textIndex: {
        indexText: () =>
          Effect.never.pipe(
            Effect.onInterrupt(() =>
              Effect.sync(() => {
                interrupted = true
              }),
            ),
          ),
      },
    }))

    expect(result).toEqual({ processed: true, sourceVersionId })
    expect(renewals).toBe(2)
    expect(interrupted).toBe(true)
    const [row] = await sql.unsafe(
      `SELECT status, attempts, last_error_code
       FROM source_text_reindex_jobs WHERE source_version_id = $1`,
      [sourceVersionId],
    )
    expect(row).toMatchObject({
      status: 'in-progress',
      attempts: 2,
      last_error_code: null,
    })
    const indexed = await sql.unsafe(
      `SELECT source_version_id FROM source_text_index
       WHERE source_version_id = $1`,
      [sourceVersionId],
    )
    expect(indexed).toHaveLength(0)
  })

  it('leaves the claimed PostgreSQL row nonterminal when heartbeat infrastructure fails', async () => {
    let interrupted = false
    const heartbeatFailure = new QueryError({
      operation: 'renewSourceTextReindexLease',
      entity: 'SourceTextReindexJob',
      message: 'database unavailable',
    })
    const exit = await Effect.runPromiseExit(processOneSourceTextReindex({
      staleAfterMs: 300_000,
      heartbeatIntervalMs: 1,
      jobs: {
        recoverStale: (staleAfterMs) =>
          SourceTextReindexRepo.recoverStale(staleAfterMs).pipe(
            Effect.provide(layer),
          ),
        claimNext: () =>
          SourceTextReindexRepo.claimNext().pipe(Effect.provide(layer)),
        renewLease: () => Effect.fail(heartbeatFailure),
        recordFailure: (job, errorCode) =>
          SourceTextReindexRepo.recordFailure(job, errorCode).pipe(
            Effect.provide(layer),
          ),
      },
      store,
      textIndex: {
        indexText: () =>
          Effect.never.pipe(
            Effect.onInterrupt(() =>
              Effect.sync(() => {
                interrupted = true
              }),
            ),
          ),
      },
    }))

    expect(Exit.isFailure(exit)).toBe(true)
    expect(String(exit)).toContain('database unavailable')
    expect(interrupted).toBe(true)
    const [row] = await sql.unsafe(
      `SELECT status, attempts, last_error_code
       FROM source_text_reindex_jobs WHERE source_version_id = $1`,
      [sourceVersionId],
    )
    expect(row).toMatchObject({
      status: 'in-progress',
      attempts: 1,
      last_error_code: null,
    })
  })
})
