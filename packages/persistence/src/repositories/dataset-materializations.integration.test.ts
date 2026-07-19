import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import {
  DatasetId,
  DatasetSchemaFamilyId,
  DatasetSnapshotId,
  JobQueueId,
  ProjectId,
  Sha256Digest,
  SourceId,
  SourceVersionId,
  WorkspaceId,
} from '@struct/domain'
import { Effect, Layer, Option } from 'effect'
import postgres from 'postgres'
import type postgresTypes from 'postgres'
import {
  type DatasetMaterializationEnqueueInput,
  DatasetMaterializationRepo,
  SqlClientLive,
} from '../index.js'

const DATABASE_URL = process.env['DATABASE_URL']
const describeIf = DATABASE_URL ? describe : describe.skip
const workspaceId = WorkspaceId.make('730e8400-e29b-41d4-a716-446655440000')
const projectId = ProjectId.make('730e8400-e29b-41d4-a716-446655440001')
const sourceId = SourceId.make('730e8400-e29b-41d4-a716-446655440002')
const versionId = SourceVersionId.make('730e8400-e29b-41d4-a716-446655440003')
const datasetId = DatasetId.make('730e8400-e29b-41d4-a716-446655440004')
const familyId = DatasetSchemaFamilyId.make('730e8400-e29b-41d4-a716-446655440005')
const snapshotId = DatasetSnapshotId.make('730e8400-e29b-41d4-a716-446655440006')
const jobId = JobQueueId.make('730e8400-e29b-41d4-a716-446655440007')
const conflictingJobId = JobQueueId.make('730e8400-e29b-41d4-a716-446655440008')
const foreignWorkspaceId = WorkspaceId.make('730e8400-e29b-41d4-a716-446655440009')
const terminalSnapshotId = DatasetSnapshotId.make('730e8400-e29b-41d4-a716-446655440010')
const terminalJobId = JobQueueId.make('730e8400-e29b-41d4-a716-446655440011')
const contentHash = `sha256:${'a'.repeat(64)}`
const terminalContentHash = `sha256:${'e'.repeat(64)}`

describeIf('DatasetMaterializationRepo (PostgreSQL)', () => {
  let sql: postgresTypes.Sql
  let layer: Layer.Layer<DatasetMaterializationRepo>

  beforeAll(async () => {
    if (!DATABASE_URL) return
    sql = postgres(DATABASE_URL, { max: 4, idle_timeout: 5 })
    layer = Layer.provide(DatasetMaterializationRepo.Default, SqlClientLive(sql))
    await sql.unsafe('DELETE FROM workspaces WHERE id = $1', [workspaceId])
    await sql.unsafe(
      `INSERT INTO workspaces (id, name) VALUES ($1, 'Materialization')`,
      [workspaceId],
    )
    await sql.unsafe(
      `INSERT INTO projects (id, workspace_id, name)
       VALUES ($1, $2, 'Materialization')`,
      [projectId, workspaceId],
    )
    await sql.unsafe(
      `INSERT INTO sources (id, project_id, name, kind)
       VALUES ($1, $2, 'Rows', 'dataset')`,
      [sourceId, projectId],
    )
    await sql.unsafe(
      `INSERT INTO source_versions (
         id, source_id, version, artifact_ref, content_hash
       ) VALUES ($1, $2, 1, $3, $4)`,
      [versionId, sourceId, `artifact://sha256/${'a'.repeat(64)}`, contentHash],
    )
    await sql.unsafe(
      `INSERT INTO dataset_assets (
         id, workspace_id, project_id, name, lifecycle_status
       ) VALUES ($1, $2, $3, 'Rows', 'active')`,
      [datasetId, workspaceId, projectId],
    )
    await sql.unsafe(
      `INSERT INTO dataset_schema_families (
         id, dataset_id, workspace_id, project_id, schema_hash
       ) VALUES ($1, $2, $3, $4, $5)`,
      [familyId, datasetId, workspaceId, projectId, `sha256:${'b'.repeat(64)}`],
    )
    await sql.unsafe(
      `INSERT INTO dataset_field_schemas (
         schema_family_id, ordinal, name, source_type, logical_type, nullable
       ) VALUES ($1, 0, 'id', 'number', 'integer', false)`,
      [familyId],
    )
    await sql.unsafe(
      `INSERT INTO dataset_snapshots (
         id, dataset_id, workspace_id, project_id, version,
         schema_family_id, content_hash
       ) VALUES ($1, $2, $3, $4, 1, $5, $6)`,
      [snapshotId, datasetId, workspaceId, projectId, familyId, contentHash],
    )
    await sql.unsafe(
      `INSERT INTO dataset_snapshot_sources (
         snapshot_id, dataset_id, workspace_id, project_id,
         ordinal, source_id, source_version_id, content_hash
       ) VALUES ($1, $2, $3, $4, 0, $5, $6, $7)`,
      [
        snapshotId,
        datasetId,
        workspaceId,
        projectId,
        sourceId,
        versionId,
        contentHash,
      ],
    )
  })

  afterAll(async () => {
    if (!sql) return
    await sql.unsafe('DELETE FROM workspaces WHERE id = $1', [workspaceId])
    await sql.end()
  })

  it('recovers a lost lease and commits one result/event from the new attempt', async () => {
    const enqueue = (input: DatasetMaterializationEnqueueInput) =>
      Effect.runPromise(
        DatasetMaterializationRepo.enqueue(input).pipe(Effect.provide(layer)),
      )
    expect(await enqueue({
      jobId,
      workspaceId,
      snapshotId,
      sourceFormats: ['json'],
      maxAttempts: 3,
    })).toEqual({ replayed: false })
    expect(await enqueue({
      jobId,
      workspaceId,
      snapshotId,
      sourceFormats: ['json'],
      maxAttempts: 3,
    })).toEqual({ replayed: true })
    const foreign = await Effect.runPromiseExit(
      DatasetMaterializationRepo.enqueue({
        jobId: conflictingJobId,
        workspaceId: foreignWorkspaceId,
        snapshotId,
        sourceFormats: ['json'],
        maxAttempts: 3,
      }).pipe(Effect.provide(layer)),
    )
    expect(String(foreign)).toContain('DatasetMaterializationScopeError')
    const conflict = await Effect.runPromiseExit(
      DatasetMaterializationRepo.enqueue({
        jobId: conflictingJobId,
        workspaceId,
        snapshotId,
        sourceFormats: ['json'],
        maxAttempts: 3,
      }).pipe(Effect.provide(layer)),
    )
    expect(String(conflict)).toContain('DatasetMaterializationConflictError')

    const first = await Effect.runPromise(
      DatasetMaterializationRepo.claimNext(1_000).pipe(Effect.provide(layer)),
    )
    expect(Option.isSome(first)).toBe(true)
    if (Option.isNone(first)) throw new Error('job was not claimed')
    await Effect.runPromise(
      DatasetMaterializationRepo.recordFailure(
        first.value,
        true,
        'engine',
      ).pipe(Effect.provide(layer)),
    )
    const retry = await Effect.runPromise(
      DatasetMaterializationRepo.claimNext(1_000).pipe(Effect.provide(layer)),
    )
    expect(Option.isSome(retry)).toBe(true)
    if (Option.isNone(retry)) throw new Error('failed job was not reclaimed')
    expect(retry.value.attempt).toBe(2)
    await sql.unsafe(
      `UPDATE dataset_materialization_jobs
       SET lease_expires_at = clock_timestamp() - interval '1 second'
       WHERE job_id = $1`,
      [jobId],
    )
    expect(await Effect.runPromise(
      DatasetMaterializationRepo.recoverExpired().pipe(Effect.provide(layer)),
    )).toBe(1)
    const recovered = await Effect.runPromise(
      DatasetMaterializationRepo.claimNext(1_000).pipe(Effect.provide(layer)),
    )
    expect(Option.isSome(recovered)).toBe(true)
    if (Option.isNone(recovered)) throw new Error('expired job was not reclaimed')
    expect(recovered.value.attempt).toBe(3)

    const materialization = {
      snapshotId,
      workspaceId,
      projectId,
      datasetId,
      parquetRef: `artifact://sha256/${'c'.repeat(64)}`,
      parquetHash: Sha256Digest.make(`sha256:${'c'.repeat(64)}`),
      parquetByteLength: 643,
      profileRef: `artifact://sha256/${'d'.repeat(64)}`,
      profileHash: Sha256Digest.make(`sha256:${'d'.repeat(64)}`),
      profile: { rowCount: 2, columns: [] },
    }
    const stale = await Effect.runPromiseExit(
      DatasetMaterializationRepo.complete(retry.value, materialization).pipe(
        Effect.provide(layer),
      ),
    )
    expect(stale._tag).toBe('Failure')
    const wrongSnapshot = await Effect.runPromiseExit(
      DatasetMaterializationRepo.complete(recovered.value, {
        ...materialization,
        snapshotId: DatasetSnapshotId.make(
          '730e8400-e29b-41d4-a716-446655440099',
        ),
      }).pipe(Effect.provide(layer)),
    )
    expect(String(wrongSnapshot)).toContain('DatasetMaterializationScopeError')
    await Effect.runPromise(
      DatasetMaterializationRepo.complete(recovered.value, materialization).pipe(
        Effect.provide(layer),
      ),
    )
    const rows = await sql.unsafe(
      `SELECT
         (SELECT count(*) FROM dataset_materializations
          WHERE snapshot_id = $1) AS materializations,
         (SELECT count(*) FROM event_journal
          WHERE entity_type = 'dataset-materialization'
            AND entity_id = $1) AS events,
         (SELECT status FROM job_queue WHERE id = $2) AS status`,
      [snapshotId, jobId],
    )
    expect(Number(rows[0]?.['materializations'])).toBe(1)
    expect(Number(rows[0]?.['events'])).toBe(2)
    expect(rows[0]?.['status']).toBe('completed')
  })

  it('journals an expired final attempt before marking it failed', async () => {
    await sql.unsafe(
      `INSERT INTO dataset_snapshots (
         id, dataset_id, workspace_id, project_id, version,
         schema_family_id, previous_snapshot_id, content_hash
       ) VALUES ($1, $2, $3, $4, 2, $5, $6, $7)`,
      [
        terminalSnapshotId,
        datasetId,
        workspaceId,
        projectId,
        familyId,
        snapshotId,
        terminalContentHash,
      ],
    )
    await sql.unsafe(
      `INSERT INTO dataset_snapshot_sources (
         snapshot_id, dataset_id, workspace_id, project_id,
         ordinal, source_id, source_version_id, content_hash
       ) VALUES ($1, $2, $3, $4, 0, $5, $6, $7)`,
      [
        terminalSnapshotId,
        datasetId,
        workspaceId,
        projectId,
        sourceId,
        versionId,
        contentHash,
      ],
    )
    await Effect.runPromise(
      DatasetMaterializationRepo.enqueue({
        jobId: terminalJobId,
        workspaceId,
        snapshotId: terminalSnapshotId,
        sourceFormats: ['json'],
        maxAttempts: 1,
      }).pipe(Effect.provide(layer)),
    )
    const claimed = await Effect.runPromise(
      DatasetMaterializationRepo.claimNext(1_000).pipe(Effect.provide(layer)),
    )
    expect(Option.isSome(claimed)).toBe(true)
    await sql.unsafe(
      `UPDATE dataset_materialization_jobs
       SET lease_expires_at = clock_timestamp() - interval '1 second'
       WHERE job_id = $1`,
      [terminalJobId],
    )

    expect(await Effect.runPromise(
      DatasetMaterializationRepo.recoverExpired().pipe(Effect.provide(layer)),
    )).toBe(1)
    const rows = await sql.unsafe(
      `SELECT job.status, event.payload
       FROM job_queue job
       JOIN event_journal event
         ON event.entity_type = 'dataset-materialization'
        AND event.entity_id = $1
        AND event.event_type = 'dataset-materialization-failed'
       WHERE job.id = $2`,
      [terminalSnapshotId, terminalJobId],
    )
    expect(rows[0]?.['status']).toBe('failed')
    expect(rows[0]?.['payload']).toMatchObject({
      jobId: terminalJobId,
      attempt: 1,
      errorCode: 'lease-expired',
      retryable: true,
      willRetry: false,
    })
  })
})
