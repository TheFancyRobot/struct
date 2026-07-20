import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import {
  DatasetCitationId,
  DatasetId,
  DatasetSnapshotId,
  EventJournalId,
  JobQueueId,
  ProjectId,
  QueryResultSnapshotId,
  ResearchRunId,
  ResearchThreadId,
  Sha256Digest,
  SourceId,
  SourceVersionId,
  WorkspaceId,
  type DatasetCitation,
  type JobQueue,
} from '@struct/domain'
import { Effect, Exit, Layer } from 'effect'
import postgres from 'postgres'
import {
  ResearchExecutionRepo,
  ResearchProjectionRepo,
  SqlClientLive,
} from '../index.js'

const DATABASE_URL = process.env['DATABASE_URL']
const describeIf = DATABASE_URL ? describe : describe.skip
const uuid = (suffix: string) => `ca0e8400-e29b-41d4-a716-${suffix}`
const workspaceId = WorkspaceId.make(uuid('446655440001'))
const projectId = ProjectId.make(uuid('446655440002'))
const sourceId = SourceId.make(uuid('446655440003'))
const sourceVersionId = SourceVersionId.make(uuid('446655440004'))
const threadId = ResearchThreadId.make(uuid('446655440005'))
const runId = ResearchRunId.make(uuid('446655440006'))
const rejectedRunId = ResearchRunId.make(uuid('446655440007'))
const jobId = JobQueueId.make(uuid('446655440008'))
const rejectedJobId = JobQueueId.make(uuid('446655440009'))
const datasetId = DatasetId.make(uuid('446655440010'))
const familyId = uuid('446655440011')
const snapshotId = DatasetSnapshotId.make(uuid('446655440012'))
const resultId = QueryResultSnapshotId.make(uuid('446655440013'))
const citationId = DatasetCitationId.make(uuid('446655440014'))
const unknownCitationId = DatasetCitationId.make(uuid('446655440015'))
const schemaHash = Sha256Digest.make(`sha256:${'1'.repeat(64)}`)
const resultHash = Sha256Digest.make(`sha256:${'2'.repeat(64)}`)
const artifactHash = Sha256Digest.make(`sha256:${'3'.repeat(64)}`)
const canonicalSql = 'SELECT "value" FROM "records" LIMIT 1'

const citation: DatasetCitation = {
  id: citationId,
  queryResultSnapshotId: resultId,
  workspaceId,
  projectId,
  datasetId,
  datasetSnapshotId: snapshotId,
  schemaHash,
  parquetDigest: '4'.repeat(64),
  resultHash,
  resultArtifactHash: artifactHash,
  canonicalSql,
  selectedColumns: ['value'],
  rowStart: 0,
  rowEndExclusive: 1,
  createdAt: 1n,
}

describeIf('research dataset citation completion (PostgreSQL)', () => {
  const sql = postgres(DATABASE_URL ?? '', { max: 1, idle_timeout: 5 })
  const sqlLayer = SqlClientLive(sql)
  const executionLayer = Layer.provide(ResearchExecutionRepo.Default, sqlLayer)
  const projectionLayer = Layer.provide(ResearchProjectionRepo.Default, sqlLayer)
  const job = (
    id: typeof JobQueueId.Type,
    entityId: typeof ResearchRunId.Type,
  ): typeof JobQueue.Type => ({
    id,
    workspaceId,
    entityType: 'research',
    entityId,
    status: 'in-progress',
    payload: { projectId, sourceVersionIds: [sourceVersionId] },
    attempts: 1,
    maxAttempts: 1,
    createdAt: 1n,
    updatedAt: 1n,
  })
  const event = (
    id: string,
    entityId: typeof ResearchRunId.Type,
    eventType: string,
    payload: Record<string, unknown>,
  ) => ({
    id: EventJournalId.make(id),
    workspaceId,
    entityType: 'research',
    entityId,
    eventType,
    payload,
    cursor: 0n,
    createdAt: 1n,
  })

  beforeAll(async () => {
    await sql.unsafe(
      `INSERT INTO workspaces (id, name) VALUES ($1, 'Dataset citation completion')`,
      [workspaceId],
    )
    await sql.unsafe(
      `INSERT INTO projects (id, workspace_id, name)
       VALUES ($1, $2, 'Dataset citation completion')`,
      [projectId, workspaceId],
    )
    await sql.unsafe(
      `INSERT INTO sources (id, project_id, name, kind)
       VALUES ($1, $2, 'records.csv', 'dataset')`,
      [sourceId, projectId],
    )
    await sql.unsafe(
      `INSERT INTO source_versions (
         id, source_id, version, artifact_ref, content_hash
       ) VALUES ($1, $2, 1, 'artifact://dataset-citation', $3)`,
      [sourceVersionId, sourceId, `sha256:${'5'.repeat(64)}`],
    )
    await sql.unsafe(
      `INSERT INTO research_threads (id, project_id, title)
       VALUES ($1, $2, 'Dataset result')`,
      [threadId, projectId],
    )
    await sql.unsafe(
      `INSERT INTO research_runs (id, thread_id, question, status)
       VALUES
         ($1, $3, 'What is the value?', 'in-progress'),
         ($2, $3, 'Can an unknown citation pass?', 'in-progress')`,
      [runId, rejectedRunId, threadId],
    )
    const payload = JSON.stringify({
      projectId,
      sourceVersionIds: [sourceVersionId],
    })
    await sql.unsafe(
      `INSERT INTO job_queue (
         id, workspace_id, entity_type, entity_id, status, payload,
         attempts, max_attempts
       ) VALUES
         ($1, $3, 'research', $4, 'in-progress', $6::jsonb, 1, 1),
         ($2, $3, 'research', $5, 'in-progress', $6::jsonb, 1, 1)`,
      [jobId, rejectedJobId, workspaceId, runId, rejectedRunId, payload],
    )
    await sql.unsafe(
      `INSERT INTO dataset_assets (
         id, workspace_id, project_id, name, lifecycle_status
       ) VALUES ($1, $2, $3, 'Records', 'active')`,
      [datasetId, workspaceId, projectId],
    )
    await sql.unsafe(
      `INSERT INTO dataset_schema_families (
         id, dataset_id, workspace_id, project_id, schema_hash
       ) VALUES ($1, $2, $3, $4, $5)`,
      [familyId, datasetId, workspaceId, projectId, schemaHash],
    )
    await sql.unsafe(
      `INSERT INTO dataset_field_schemas (
         schema_family_id, ordinal, name, source_type, logical_type, nullable
       ) VALUES ($1, 0, 'value', 'integer', 'integer', false)`,
      [familyId],
    )
    await sql.unsafe(
      `INSERT INTO dataset_snapshots (
         id, dataset_id, workspace_id, project_id, version,
         schema_family_id, content_hash
       ) VALUES ($1, $2, $3, $4, 1, $5, $6)`,
      [
        snapshotId,
        datasetId,
        workspaceId,
        projectId,
        familyId,
        `sha256:${'6'.repeat(64)}`,
      ],
    )
    await sql.unsafe(
      `INSERT INTO dataset_snapshot_sources (
         snapshot_id, dataset_id, workspace_id, project_id, ordinal,
         source_id, source_version_id, content_hash
       ) VALUES ($1, $2, $3, $4, 0, $5, $6, $7)`,
      [
        snapshotId,
        datasetId,
        workspaceId,
        projectId,
        sourceId,
        sourceVersionId,
        `sha256:${'5'.repeat(64)}`,
      ],
    )
    await sql.unsafe(
      `INSERT INTO query_result_snapshots (
         id, workspace_id, project_id, request_hash, protocol_version,
         engine_version, engine_config_hash, canonical_sql, dataset_snapshots,
         schema_hash, result_hash, result_artifact_hash, columns, rows,
         row_count, truncated, executed_at, created_at
       ) VALUES (
         $1, $2, $3, $4, '1', 'duckdb-test', $5, $6, $7::jsonb,
         $8, $9, $10, $11::jsonb, $12::jsonb, 1, false,
         to_timestamp(0.001), to_timestamp(0.001)
       )`,
      [
        resultId,
        workspaceId,
        projectId,
        `sha256:${'7'.repeat(64)}`,
        `sha256:${'8'.repeat(64)}`,
        canonicalSql,
        JSON.stringify([{
          alias: 'records',
          datasetId,
          snapshotId,
          schemaHash,
          parquetDigest: '4'.repeat(64),
        }]),
        schemaHash,
        resultHash,
        artifactHash,
        JSON.stringify([{ ordinal: 0, name: 'value', type: 'BIGINT' }]),
        JSON.stringify([['42']]),
      ],
    )
    await sql.unsafe(
      `INSERT INTO dataset_citations (
         id, query_result_snapshot_id, workspace_id, project_id, dataset_id,
         dataset_snapshot_id, schema_hash, parquet_digest, result_hash,
         result_artifact_hash, canonical_sql, selected_columns, row_start,
         row_end_exclusive, created_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
         '["value"]'::jsonb, 0, 1, to_timestamp(0.001)
       )`,
      [
        citationId,
        resultId,
        workspaceId,
        projectId,
        datasetId,
        snapshotId,
        schemaHash,
        '4'.repeat(64),
        resultHash,
        artifactHash,
        canonicalSql,
      ],
    )
  })

  afterAll(async () => {
    await sql.unsafe('DELETE FROM workspaces WHERE id = $1', [workspaceId])
    await sql.end()
  })

  it('atomically links canonical dataset citations and exposes them in the completed read model', async () => {
    const ownedJob = job(jobId, runId)
    await Effect.runPromise(
      ResearchExecutionRepo.appendInProgressEvent(
        ownedJob,
        event(
          uuid('446655440020'),
          runId,
          'citations-validated',
          { citationCount: 0 },
        ),
      ).pipe(Effect.provide(executionLayer)),
    )
    await Effect.runPromise(ResearchExecutionRepo.complete({
      runId,
      job: ownedJob,
      answer: {
        answer: 'The value is 42.',
        citations: [],
        datasetCitations: [citation],
      },
      citations: [],
      event: event(
        uuid('446655440021'),
        runId,
        'research-completed',
        { citationCount: 0 },
      ),
    }).pipe(Effect.provide(executionLayer)))

    const links = await sql.unsafe(
      `SELECT dataset_citation_id, ordinal
       FROM research_run_dataset_citations
       WHERE run_id = $1`,
      [runId],
    )
    expect(links.map((row) => ({
      dataset_citation_id: row['dataset_citation_id'],
      ordinal: row['ordinal'],
    }))).toEqual([{ dataset_citation_id: citationId, ordinal: 0 }])
    const projection = await Effect.runPromise(
      ResearchProjectionRepo.findCompleted(workspaceId, projectId, runId)
        .pipe(Effect.provide(projectionLayer)),
    )
    expect(projection.datasetCitations).toEqual([citation])
  })

  it('rejects an unknown dataset citation without any terminal or result write', async () => {
    const ownedJob = job(rejectedJobId, rejectedRunId)
    await Effect.runPromise(
      ResearchExecutionRepo.appendInProgressEvent(
        ownedJob,
        event(
          uuid('446655440022'),
          rejectedRunId,
          'citations-validated',
          { citationCount: 0 },
        ),
      ).pipe(Effect.provide(executionLayer)),
    )
    const exit = await Effect.runPromiseExit(ResearchExecutionRepo.complete({
      runId: rejectedRunId,
      job: ownedJob,
      answer: {
        answer: 'Must not persist.',
        citations: [],
        datasetCitations: [{ ...citation, id: unknownCitationId }],
      },
      citations: [],
      event: event(
        uuid('446655440023'),
        rejectedRunId,
        'research-completed',
        { citationCount: 0 },
      ),
    }).pipe(Effect.provide(executionLayer)))
    expect(Exit.isFailure(exit)).toBe(true)
    expect(await sql.unsafe(
      `SELECT run_id FROM research_run_results WHERE run_id = $1`,
      [rejectedRunId],
    )).toHaveLength(0)
  })
})
