import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Effect, Layer } from 'effect'
import postgres from 'postgres'
import type postgresTypes from 'postgres'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  EventJournalRepo,
  JobQueueRepo,
  ProjectRepo,
  SourceRegistrationRepo,
  SourceVersionRepo,
  SqlClientLive,
} from '@struct/persistence'
import { LocalArtifactStore } from '@struct/source-storage'
import { ingestTextSource } from '@struct/ingestion'
import { TextRetrieval } from '@struct/retrieval'
import { EventJournalId, JobQueueId, ProjectId, SourceId, SourceVersionId, WorkspaceId } from '@struct/domain'
import { processOneIngestionJob } from '../../../worker/src/jobs/ingest-source'
import { registerTextSource } from './sources'

const DATABASE_URL = process.env['DATABASE_URL']
const describeIf = DATABASE_URL ? describe : describe.skip

const workspaceId = WorkspaceId.make('950e8400-e29b-41d4-a716-446655440000')
const projectId = ProjectId.make('950e8400-e29b-41d4-a716-446655440001')
const sourceId = SourceId.make('950e8400-e29b-41d4-a716-446655440002')
const sourceVersionId = SourceVersionId.make('950e8400-e29b-41d4-a716-446655440003')
const rollbackSourceId = SourceId.make('950e8400-e29b-41d4-a716-446655440020')
const rollbackJobId = JobQueueId.make('950e8400-e29b-41d4-a716-446655440021')
const rollbackEventId = EventJournalId.make('950e8400-e29b-41d4-a716-446655440022')

async function cleanup(sql: postgresTypes.Sql): Promise<void> {
  await sql.unsafe(`DELETE FROM event_journal WHERE workspace_id = '${workspaceId}'`)
  await sql.unsafe(`DELETE FROM job_queue WHERE workspace_id = '${workspaceId}'`)
  await sql.unsafe(`DELETE FROM source_versions WHERE source_id IN (SELECT id FROM sources WHERE project_id = '${projectId}')`)
  await sql.unsafe(`DELETE FROM sources WHERE project_id = '${projectId}'`)
  await sql.unsafe(`DELETE FROM projects WHERE id = '${projectId}'`)
  await sql.unsafe(`DELETE FROM workspaces WHERE id = '${workspaceId}'`)
}

describeIf('single text source ingestion real DB integration', () => {
  let sql: postgresTypes.Sql
  let root: string

  beforeAll(async () => {
    if (!DATABASE_URL) return
    sql = postgres(DATABASE_URL, { max: 1, idle_timeout: 5 })
    root = await mkdtemp(join(tmpdir(), 'struct-real-ingestion-'))
    await cleanup(sql)
    await sql.unsafe(`INSERT INTO workspaces (id, name, created_at, updated_at) VALUES ($1, 'Integration Workspace', NOW(), NOW())`, [workspaceId])
    await sql.unsafe(`INSERT INTO projects (id, workspace_id, name, created_at, updated_at) VALUES ($1, $2, 'Integration Project', NOW(), NOW())`, [projectId, workspaceId])
  })

  afterAll(async () => {
    if (sql) {
      await cleanup(sql)
      await sql.end()
    }
    if (root) await rm(root, { recursive: true, force: true })
  })

  it('registers via API service then completes one real DB worker claim into artifacts, SourceVersion, events, and job state', async () => {
    const storage = await Effect.runPromise(LocalArtifactStore.make({ root }))
    const sqlLayer = SqlClientLive(sql)
    const projectLayer = Layer.provide(ProjectRepo.Default, sqlLayer)
    const registrationLayer = Layer.provide(SourceRegistrationRepo.Default, sqlLayer)
    const jobLayer = Layer.provide(JobQueueRepo.Default, sqlLayer)
    const sourceVersionLayer = Layer.provide(SourceVersionRepo.Default, sqlLayer)
    const eventLayer = Layer.provide(EventJournalRepo.Default, sqlLayer)
    const retrievalLayer = Layer.provide(TextRetrieval.Default, sqlLayer)

    await Effect.runPromise(registerTextSource({
      workspaceId,
      projectId,
      name: 'notes.md',
      mediaType: 'text/markdown',
      bytes: new TextEncoder().encode('# Title\r\nhello'),
    }, {
      now: () => BigInt(Date.now()),
      randomUuid: () => sourceId,
      randomJobQueueId: () => JobQueueId.make('950e8400-e29b-41d4-a716-446655440010'),
      randomEventJournalId: () => EventJournalId.make('950e8400-e29b-41d4-a716-446655440011'),
      maxBytes: 1024,
      projects: { findById: (id) => ProjectRepo.findById(id).pipe(Effect.provide(projectLayer)) },
      registration: {
        create: (input) => SourceRegistrationRepo.create(input).pipe(Effect.provide(registrationLayer)),
      },
      storage,
    }))

    const workerResult = await Effect.runPromise(processOneIngestionJob({
      now: () => BigInt(Date.now()),
      randomSourceVersionId: () => sourceVersionId,
      staleBeforeMs: Date.now() - 300000,
      jobs: {
        recoverStaleIngestionJobs: (staleBeforeMs) => JobQueueRepo.recoverStaleIngestionJobs(staleBeforeMs).pipe(Effect.provide(jobLayer)),
        claimNextIngestionJob: () => JobQueueRepo.claimNextIngestionJob().pipe(Effect.provide(jobLayer)),
        markCompleted: (id) => JobQueueRepo.markCompleted(id).pipe(Effect.provide(jobLayer)),
        markPending: (id) => JobQueueRepo.markPending(id).pipe(Effect.provide(jobLayer)),
        markFailed: (id) => JobQueueRepo.markFailed(id).pipe(Effect.provide(jobLayer)),
      },
      sourceVersions: {
        findBySourceId: (id) => SourceVersionRepo.findBySourceId(id).pipe(Effect.provide(sourceVersionLayer)),
        create: (version) => SourceVersionRepo.create(version).pipe(Effect.provide(sourceVersionLayer)),
      },
      sources: {
        findProjectId: () => Effect.succeed(projectId),
      },
      textIndex: {
        indexText: (input) => TextRetrieval.indexText(input).pipe(Effect.provide(retrievalLayer)),
      },
      events: {
        append: (event) => EventJournalRepo.append(event).pipe(Effect.provide(eventLayer)),
      },
      ingestion: {
        ingestTextSource: (input) => ingestTextSource({ store: storage, ...input, maxBytes: 1024 }),
      },
    }))

    expect(workerResult).toEqual({ processed: true, jobId: '950e8400-e29b-41d4-a716-446655440010' })

    const [jobRow] = await sql.unsafe(`SELECT status, attempts, payload::text AS payload FROM job_queue WHERE id = $1`, ['950e8400-e29b-41d4-a716-446655440010'])
    const [versionRow] = await sql.unsafe(`SELECT id, artifact_ref, content_hash FROM source_versions WHERE source_id = $1`, [sourceId])
    const [indexRow] = await sql.unsafe(
      `SELECT sti.content, p.workspace_id, p.id AS project_id
       FROM source_text_index sti
       JOIN source_versions sv ON sv.id = sti.source_version_id
       JOIN sources s ON s.id = sv.source_id
       JOIN projects p ON p.id = s.project_id
       WHERE sti.source_version_id = $1`,
      [versionRow['id']],
    )
    const events = await sql.unsafe(`SELECT event_type, payload::text AS payload FROM event_journal WHERE workspace_id = $1 ORDER BY cursor ASC`, [workspaceId])
    const manifest = JSON.parse(new TextDecoder().decode((await Effect.runPromise(storage.readObject(versionRow['artifact_ref'] as never))).bytes))

    expect(jobRow['status']).toBe('completed')
    expect(jobRow['attempts']).toBe(1)
    expect(String(jobRow['payload'])).not.toContain('# Title')
    expect(versionRow['content_hash']).toMatch(/^sha256:[a-f0-9]{64}$/)
    expect(versionRow['artifact_ref']).toMatch(/^artifact:\/\/sha256\//)
    expect(manifest.normalizedRef).toMatch(/^artifact:\/\/sha256\//)
    expect(indexRow).toMatchObject({
      content: '# Title\nhello',
      workspace_id: workspaceId,
      project_id: projectId,
    })
    expect(events.map((event) => event['event_type'])).toEqual(['ingestion-requested', 'file-processed', 'ingestion-completed'])
    expect(JSON.stringify(events)).not.toContain('# Title')
    expect(JSON.stringify(events)).not.toContain('/Users/')
  })

  it('rolls back Source and job creation when ingestion-requested persistence fails', async () => {
    const storage = await Effect.runPromise(LocalArtifactStore.make({ root }))
    const sqlLayer = SqlClientLive(sql)
    const projectLayer = Layer.provide(ProjectRepo.Default, sqlLayer)
    const registrationLayer = Layer.provide(SourceRegistrationRepo.Default, sqlLayer)
    await sql.unsafe(
      `INSERT INTO event_journal (id, workspace_id, entity_type, entity_id, event_type, payload, created_at)
       VALUES ($1, $2, 'test', $3, 'rollback-seed', '{}'::jsonb, NOW())`,
      [rollbackEventId, workspaceId, sourceId],
    )

    const result = await Effect.runPromiseExit(registerTextSource({
      workspaceId,
      projectId,
      name: 'rollback.md',
      mediaType: 'text/markdown',
      bytes: new TextEncoder().encode('# Roll back'),
    }, {
      now: () => BigInt(Date.now()),
      randomUuid: () => rollbackSourceId,
      randomJobQueueId: () => rollbackJobId,
      randomEventJournalId: () => rollbackEventId,
      maxBytes: 1024,
      projects: { findById: (id) => ProjectRepo.findById(id).pipe(Effect.provide(projectLayer)) },
      registration: {
        create: (input) => SourceRegistrationRepo.create(input).pipe(Effect.provide(registrationLayer)),
      },
      storage,
    }))

    expect(result._tag).toBe('Failure')
    const [sourceCount] = await sql.unsafe(`SELECT COUNT(*)::int AS count FROM sources WHERE id = $1`, [rollbackSourceId])
    const [jobCount] = await sql.unsafe(`SELECT COUNT(*)::int AS count FROM job_queue WHERE id = $1`, [rollbackJobId])
    expect(sourceCount['count']).toBe(0)
    expect(jobCount['count']).toBe(0)
  })
})
