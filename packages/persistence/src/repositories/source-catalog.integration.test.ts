import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { Effect, Layer } from 'effect'
import postgres from 'postgres'
import type postgresTypes from 'postgres'
import {
  EventJournalId,
  JobQueueId,
  ProjectId,
  WorkspaceId,
} from '@struct/domain'
import { SqlClientLive } from '../sql-client'
import { SourceCatalogRepo } from './source-catalog'

const DATABASE_URL = process.env['DATABASE_URL']
const describeIf = DATABASE_URL ? describe : describe.skip
const workspaceId = WorkspaceId.make('a50e8400-e29b-41d4-a716-446655440000')
const projectId = ProjectId.make('a50e8400-e29b-41d4-a716-446655440001')
const readySourceId = 'a50e8400-e29b-41d4-a716-446655440002'
const pendingSourceId = 'a50e8400-e29b-41d4-a716-446655440003'
const readyJobId = 'a50e8400-e29b-41d4-a716-446655440004'
const failedJobId = 'a50e8400-e29b-41d4-a716-446655440005'
const directorySourceId = 'a50e8400-e29b-41d4-a716-446655440010'

describeIf('source catalog projection', () => {
  let sql: postgresTypes.Sql
  let layer: Layer.Layer<SourceCatalogRepo>

  beforeAll(async () => {
    sql = postgres(DATABASE_URL!, { max: 1 })
    layer = Layer.provide(SourceCatalogRepo.Default, SqlClientLive(sql))
    await sql.unsafe('DELETE FROM event_journal WHERE workspace_id = $1', [workspaceId])
    await sql.unsafe('DELETE FROM job_queue WHERE workspace_id = $1', [workspaceId])
    await sql.unsafe('DELETE FROM source_versions WHERE source_id IN ($1, $2)', [readySourceId, pendingSourceId])
    await sql.unsafe('DELETE FROM sources WHERE project_id = $1', [projectId])
    await sql.unsafe('DELETE FROM projects WHERE id = $1', [projectId])
    await sql.unsafe('DELETE FROM workspaces WHERE id = $1', [workspaceId])
    await sql.unsafe('INSERT INTO workspaces (id, name) VALUES ($1, $2)', [workspaceId, 'Catalog workspace'])
    await sql.unsafe('INSERT INTO projects (id, workspace_id, name) VALUES ($1, $2, $3)', [projectId, workspaceId, 'Catalog project'])
    await sql.unsafe(
      `INSERT INTO sources (id, project_id, name, kind) VALUES
       ($1, $3, 'ready.md', 'document'),
       ($2, $3, 'failed.md', 'document'),
       ($4, $3, 'existing-directory', 'directory')`,
      [readySourceId, pendingSourceId, projectId, directorySourceId],
    )
    await sql.unsafe(
      `INSERT INTO source_versions (
         id, source_id, version, artifact_ref, content_hash
       ) VALUES (
         'a50e8400-e29b-41d4-a716-446655440006', $1, 1,
         'artifact://sha256/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
         'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
       )`,
      [readySourceId],
    )
    await sql.unsafe(
      `INSERT INTO job_queue (
         id, workspace_id, entity_type, entity_id, status, payload, attempts, max_attempts
       ) VALUES
       ($1, $3, 'ingestion', $4, 'in-progress', '{"mediaType":"text/markdown"}', 1, 3),
       ($2, $3, 'ingestion', $5, 'failed', '{"mediaType":"text/markdown"}', 1, 3)`,
      [readyJobId, failedJobId, workspaceId, readySourceId, pendingSourceId],
    )
    await sql.unsafe(
      `INSERT INTO event_journal (
         id, workspace_id, entity_type, entity_id, event_type, payload
       ) VALUES (
         'a50e8400-e29b-41d4-a716-446655440007', $1, 'ingestion', $2,
         'ingestion-requested', '{}'
       )`,
      [workspaceId, readySourceId],
    )
  })

  afterAll(async () => {
    if (!sql) return
    await sql.unsafe('DELETE FROM event_journal WHERE workspace_id = $1', [workspaceId])
    await sql.unsafe('DELETE FROM job_queue WHERE workspace_id = $1', [workspaceId])
    await sql.unsafe('DELETE FROM source_versions WHERE source_id IN ($1, $2)', [readySourceId, pendingSourceId])
    await sql.unsafe('DELETE FROM sources WHERE project_id = $1', [projectId])
    await sql.unsafe('DELETE FROM projects WHERE id = $1', [projectId])
    await sql.unsafe('DELETE FROM workspaces WHERE id = $1', [workspaceId])
    await sql.end()
  })

  it('keeps a committed version ready while exposing current work and hydrates durable failures', async () => {
    const catalog = await Effect.runPromise(
      SourceCatalogRepo.list(workspaceId, projectId).pipe(Effect.provide(layer)),
    )

    expect(catalog.items.find((item) => item.sourceId === readySourceId)).toMatchObject({
      readiness: 'ready',
      latestVersion: 1,
      job: { status: 'in-progress' },
    })
    expect(catalog.items.find((item) => item.sourceId === pendingSourceId)).toMatchObject({
      readiness: 'failed',
      latestVersionId: null,
      job: { status: 'failed' },
    })
    expect(catalog.items.some((item) => item.sourceId === directorySourceId)).toBe(false)

    const events = await Effect.runPromise(
      SourceCatalogRepo.listEventsAfter(
        workspaceId,
        projectId,
        0n,
        10,
      ).pipe(Effect.provide(layer)),
    )
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      sourceId: readySourceId,
      type: 'ingestion-requested',
    })
    expect(catalog.cursor).toBe(events[0]?.cursor)
  })

  it('fences cancel and retry to owned non-terminal source jobs and journals the transition', async () => {
    expect(await Effect.runPromise(SourceCatalogRepo.controlJob(
      workspaceId,
      projectId,
      JobQueueId.make(readyJobId),
      'cancel',
      EventJournalId.make('a50e8400-e29b-41d4-a716-446655440008'),
      1_700_000_000_001n,
    ).pipe(Effect.provide(layer)))).toBe(true)
    expect(await Effect.runPromise(SourceCatalogRepo.controlJob(
      workspaceId,
      projectId,
      JobQueueId.make(failedJobId),
      'retry',
      EventJournalId.make('a50e8400-e29b-41d4-a716-446655440009'),
      1_700_000_000_002n,
    ).pipe(Effect.provide(layer)))).toBe(true)

    const catalog = await Effect.runPromise(
      SourceCatalogRepo.list(workspaceId, projectId).pipe(Effect.provide(layer)),
    )
    expect(catalog.items.find((item) => item.sourceId === readySourceId)).toMatchObject({
      readiness: 'ready',
      job: { status: 'cancelled' },
    })
    expect(catalog.items.find((item) => item.sourceId === pendingSourceId)).toMatchObject({
      readiness: 'pending',
      job: { status: 'pending' },
    })
    expect((await Effect.runPromise(SourceCatalogRepo.listEventsAfter(
      workspaceId,
      projectId,
      0n,
      10,
    ).pipe(Effect.provide(layer)))).map((event) => event.type)).toEqual([
      'ingestion-requested',
      'ingestion-cancelled',
      'ingestion-retried',
    ])
  })
})
