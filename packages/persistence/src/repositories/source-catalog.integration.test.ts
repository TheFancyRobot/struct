import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { Effect, Layer } from 'effect'
import postgres from 'postgres'
import type postgresTypes from 'postgres'
import {
  EventJournalId,
  JobQueueId,
  ProjectId,
  SourceId,
  WorkspaceId,
} from '@struct/domain'
import { SqlClientLive } from '../sql-client'
import { SourceCatalogRepo } from './source-catalog'

const DATABASE_URL = process.env['DATABASE_URL']
const describeIf = DATABASE_URL ? describe : describe.skip
const workspaceId = WorkspaceId.make('a50e8400-e29b-41d4-a716-446655440000')
const projectId = ProjectId.make('a50e8400-e29b-41d4-a716-446655440001')
const secondProjectId = ProjectId.make('a50e8400-e29b-41d4-a716-446655440011')
const readySourceId = 'a50e8400-e29b-41d4-a716-446655440002'
const pendingSourceId = 'a50e8400-e29b-41d4-a716-446655440003'
const readyJobId = 'a50e8400-e29b-41d4-a716-446655440004'
const failedJobId = 'a50e8400-e29b-41d4-a716-446655440005'
const directorySourceId = 'a50e8400-e29b-41d4-a716-446655440010'
const globalDatasetSourceId = 'a50e8400-e29b-41d4-a716-446655440012'
const globalDatasetVersionId = 'a50e8400-e29b-41d4-a716-446655440013'

describeIf('source catalog projection', () => {
  let sql: postgresTypes.Sql
  let layer: Layer.Layer<SourceCatalogRepo>

  beforeAll(async () => {
    sql = postgres(DATABASE_URL!, { max: 1 })
    layer = Layer.provide(SourceCatalogRepo.Default, SqlClientLive(sql))
    await sql.unsafe('DELETE FROM event_journal WHERE workspace_id = $1', [workspaceId])
    await sql.unsafe('DELETE FROM job_queue WHERE workspace_id = $1', [workspaceId])
    await sql.unsafe('DELETE FROM source_versions WHERE source_id IN ($1, $2, $3)', [readySourceId, pendingSourceId, globalDatasetSourceId])
    await sql.unsafe('DELETE FROM sources WHERE id = $1', [globalDatasetSourceId])
    await sql.unsafe('DELETE FROM sources WHERE project_id = $1', [projectId])
    await sql.unsafe('DELETE FROM projects WHERE id = $1', [projectId])
    await sql.unsafe('DELETE FROM projects WHERE id = $1', [secondProjectId])
    await sql.unsafe('DELETE FROM workspaces WHERE id = $1', [workspaceId])
    await sql.unsafe('INSERT INTO workspaces (id, name) VALUES ($1, $2)', [workspaceId, 'Catalog workspace'])
    await sql.unsafe('INSERT INTO projects (id, workspace_id, name) VALUES ($1, $2, $3)', [projectId, workspaceId, 'Catalog project'])
    await sql.unsafe('INSERT INTO projects (id, workspace_id, name) VALUES ($1, $2, $3)', [secondProjectId, workspaceId, 'Second project'])
    await sql.unsafe(
      `INSERT INTO sources (id, workspace_id, project_id, name, kind) VALUES
       ($1, $3, $4, 'ready.md', 'document'),
       ($2, $3, $4, 'failed.md', 'document'),
       ($5, $3, $4, 'existing-directory', 'directory'),
       ($6, $3, NULL, 'global.csv', 'dataset')`,
      [readySourceId, pendingSourceId, workspaceId, projectId, directorySourceId, globalDatasetSourceId],
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
      `INSERT INTO source_versions (
         id, source_id, version, artifact_ref, content_hash
       ) VALUES (
         $1, $2, 1,
         'artifact://sha256/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
         'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
       )`,
      [globalDatasetVersionId, globalDatasetSourceId],
    )
    await sql.unsafe(
      `INSERT INTO source_text_index (source_version_id, content)
       VALUES ('a50e8400-e29b-41d4-a716-446655440006', 'ready source')`,
    )
    await sql.unsafe(
      `INSERT INTO job_queue (
         id, workspace_id, entity_type, entity_id, status, payload, attempts, max_attempts
       ) VALUES
       ($1, $3, 'ingestion', $4, 'in-progress', '{"mediaType":"text/markdown"}', 1, 3),
       ($2, $3, 'ingestion', $5, 'failed', '{"mediaType":"text/markdown"}', 1, 3),
       ('a50e8400-e29b-41d4-a716-446655440014', $3, 'ingestion', $6, 'completed',
        '{"stagedRef":"staged://a50e8400-e29b-41d4-a716-446655440000/global.csv","name":"global.csv","mediaType":"text/csv","projectId":null,"sourceKind":"dataset","structuredFormat":"csv"}', 1, 3)`,
      [readyJobId, failedJobId, workspaceId, readySourceId, pendingSourceId, globalDatasetSourceId],
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
    await sql.unsafe('DELETE FROM source_versions WHERE source_id IN ($1, $2, $3)', [readySourceId, pendingSourceId, globalDatasetSourceId])
    await sql.unsafe('DELETE FROM sources WHERE id = $1', [globalDatasetSourceId])
    await sql.unsafe('DELETE FROM sources WHERE project_id = $1', [projectId])
    await sql.unsafe('DELETE FROM projects WHERE id = $1', [projectId])
    await sql.unsafe('DELETE FROM projects WHERE id = $1', [secondProjectId])
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

  it('lists each source once in the workspace and reuses it through project attachments', async () => {
    const readyId = SourceId.make(readySourceId)
    expect(await Effect.runPromise(SourceCatalogRepo.setAttached(
      workspaceId,
      secondProjectId,
      readyId,
      true,
    ).pipe(Effect.provide(layer)))).toBe(true)

    const workspace = await Effect.runPromise(
      SourceCatalogRepo.list(workspaceId, null).pipe(Effect.provide(layer)),
    )
    const secondProject = await Effect.runPromise(
      SourceCatalogRepo.list(workspaceId, secondProjectId).pipe(Effect.provide(layer)),
    )
    expect(workspace.items.filter((item) => item.sourceId === readyId)).toHaveLength(1)
    expect(workspace.items.find((item) => item.sourceId === readyId)?.projectIds)
      .toEqual([projectId, secondProjectId])
    expect(secondProject.items.map((item) => item.sourceId)).toEqual([readyId])

    await sql.unsafe(
      `UPDATE source_text_reindex_jobs job
       SET status = 'failed', attempts = max_attempts, last_error_code = 'attachment-lost'
       FROM source_versions version
       WHERE version.source_id = $1 AND job.source_version_id = version.id`,
      [readySourceId],
    )

    expect(await Effect.runPromise(SourceCatalogRepo.setAttached(
      workspaceId,
      secondProjectId,
      readyId,
      false,
    ).pipe(Effect.provide(layer)))).toBe(true)
    expect(await Effect.runPromise(SourceCatalogRepo.setAttached(
      workspaceId,
      secondProjectId,
      readyId,
      true,
    ).pipe(Effect.provide(layer)))).toBe(true)
    const [requeued] = await sql.unsafe(
      `SELECT project_id, status, attempts, last_error_code
       FROM source_text_reindex_jobs job
       JOIN source_versions version ON version.id = job.source_version_id
       WHERE version.source_id = $1`,
      [readySourceId],
    )
    expect(requeued).toMatchObject({
      project_id: secondProjectId,
      status: 'pending',
      attempts: 0,
      last_error_code: null,
    })
    expect((await Effect.runPromise(
      SourceCatalogRepo.list(workspaceId, secondProjectId).pipe(Effect.provide(layer)),
    )).items.map((item) => item.sourceId)).toEqual([readyId])
  })

  it('replays a global dataset from its immutable version when attached to a project', async () => {
    expect(await Effect.runPromise(SourceCatalogRepo.setAttached(
      workspaceId,
      secondProjectId,
      SourceId.make(globalDatasetSourceId),
      true,
    ).pipe(Effect.provide(layer)))).toBe(true)

    const [replay] = await sql.unsafe(
      `SELECT payload FROM job_queue
       WHERE workspace_id = $1
         AND entity_type = 'ingestion'
         AND entity_id = $2
         AND status = 'pending'
       ORDER BY created_at DESC
       LIMIT 1`,
      [workspaceId, globalDatasetSourceId],
    )
    expect(replay?.['payload']).toMatchObject({
      projectId: secondProjectId,
      materializeExistingVersion: {
        id: globalDatasetVersionId,
        artifactRef: 'artifact://sha256/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        contentHash: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      },
    })
  })
})
