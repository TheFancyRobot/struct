import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { Effect, Exit, Layer } from 'effect'
import postgres from 'postgres'
import {
  CitationId,
  DatasetCitationId,
  DatasetId,
  DatasetSnapshotId,
  ProjectId,
  QueryResultSnapshotId,
  ResearchRunId,
  ResearchThreadId,
  WorkspaceId,
} from '@struct/domain'
import { SqlClientLive } from '../sql-client'
import { ResearchProjectionRepo } from './research-projections'

const DATABASE_URL = process.env['DATABASE_URL']
const describeIf = DATABASE_URL ? describe : describe.skip
const workspaceId = WorkspaceId.make('e70e8400-e29b-41d4-a716-446655440001')
const projectId = ProjectId.make('e70e8400-e29b-41d4-a716-446655440002')
const sourceId = 'e70e8400-e29b-41d4-a716-446655440003'
const sourceVersionId = 'e70e8400-e29b-41d4-a716-446655440004'
const threadId = ResearchThreadId.make('e70e8400-e29b-41d4-a716-446655440005')
const runId = ResearchRunId.make('e70e8400-e29b-41d4-a716-446655440006')
const citationId = CitationId.make('e70e8400-e29b-41d4-a716-446655440007')
const lineCitationId = CitationId.make('e70e8400-e29b-41d4-a716-446655440012')
const missingDocumentCitationId = CitationId.make(
  'e70e8400-e29b-41d4-a716-446655440013',
)
const documentId = 'e70e8400-e29b-41d4-a716-446655440011'
const documentLocator = 'document:paragraph:1,chars:18-36,bytes:18-36'
const sourceWithoutDocumentId = 'e70e8400-e29b-41d4-a716-446655440014'
const versionWithoutDocumentId = 'e70e8400-e29b-41d4-a716-446655440015'
const datasetId = DatasetId.make('e70e8400-e29b-41d4-a716-446655440016')
const datasetFamilyId = 'e70e8400-e29b-41d4-a716-446655440017'
const datasetSnapshotId = DatasetSnapshotId.make(
  'e70e8400-e29b-41d4-a716-446655440018',
)
const queryResultId = QueryResultSnapshotId.make(
  'e70e8400-e29b-41d4-a716-446655440019',
)
const datasetCitationId = DatasetCitationId.make(
  'e70e8400-e29b-41d4-a716-446655440020',
)

describeIf('ResearchProjectionRepo integration', () => {
  const sql = postgres(DATABASE_URL ?? '', { max: 2, idle_timeout: 5 })
  const layer = Layer.provide(ResearchProjectionRepo.Default, SqlClientLive(sql))

  beforeAll(async () => {
    await sql.unsafe(`INSERT INTO workspaces (id, name) VALUES ($1, 'Projection')`, [workspaceId])
    await sql.unsafe(
      `INSERT INTO projects (id, workspace_id, name) VALUES ($1, $2, 'Projection')`,
      [projectId, workspaceId],
    )
    await sql.unsafe(
      `INSERT INTO sources (id, project_id, name, kind) VALUES ($1, $2, 'launch.txt', 'document')`,
      [sourceId, projectId],
    )
    await sql.unsafe(
      `INSERT INTO source_versions (id, source_id, version, artifact_ref, content_hash)
       VALUES ($1, $2, 1, 'artifact://projection', $3)`,
      [sourceVersionId, sourceId, `sha256:${'a'.repeat(64)}`],
    )
    await sql.unsafe(
      `INSERT INTO documents (
         id, workspace_id, project_id, source_id, source_version_id, format,
         normalized_text, content_hash, parser_version
       )
       VALUES (
         $1, $2, $3, $4, $5, 'text',
         'Normalized before\nLaunch is July 18.\nAfter',
         'sha256:normalized-projection', 'text-v1'
       )`,
      [documentId, workspaceId, projectId, sourceId, sourceVersionId],
    )
    await sql.unsafe(
      `INSERT INTO research_threads (id, project_id, title) VALUES ($1, $2, 'Launch')`,
      [threadId, projectId],
    )
    await sql.unsafe(
      `INSERT INTO research_runs (id, thread_id, question, status)
       VALUES ($1, $2, 'When?', 'completed')`,
      [runId, threadId],
    )
    await sql.unsafe(
      `INSERT INTO research_run_results (run_id, answer, citations)
       VALUES ($1, 'July 18.', '[]'::jsonb)`,
      [runId],
    )
    await sql.unsafe(
      `INSERT INTO dataset_assets (
         id, workspace_id, project_id, name, lifecycle_status
       ) VALUES ($1, $2, $3, 'Projection dataset', 'active')`,
      [datasetId, workspaceId, projectId],
    )
    await sql.unsafe(
      `INSERT INTO dataset_schema_families (
         id, dataset_id, workspace_id, project_id, schema_hash
       ) VALUES ($1, $2, $3, $4, $5)`,
      [
        datasetFamilyId,
        datasetId,
        workspaceId,
        projectId,
        `sha256:${'1'.repeat(64)}`,
      ],
    )
    await sql.unsafe(
      `INSERT INTO dataset_field_schemas (
         schema_family_id, ordinal, name, source_type, logical_type, nullable
       ) VALUES ($1, 0, 'value', 'integer', 'integer', false)`,
      [datasetFamilyId],
    )
    await sql.unsafe(
      `INSERT INTO dataset_snapshots (
         id, dataset_id, workspace_id, project_id, version,
         schema_family_id, content_hash
       ) VALUES ($1, $2, $3, $4, 1, $5, $6)`,
      [
        datasetSnapshotId,
        datasetId,
        workspaceId,
        projectId,
        datasetFamilyId,
        `sha256:${'2'.repeat(64)}`,
      ],
    )
    await sql.unsafe(
      `INSERT INTO dataset_snapshot_sources (
         snapshot_id, dataset_id, workspace_id, project_id, ordinal,
         source_id, source_version_id, content_hash
       ) VALUES ($1, $2, $3, $4, 0, $5, $6, $7)`,
      [
        datasetSnapshotId,
        datasetId,
        workspaceId,
        projectId,
        sourceId,
        sourceVersionId,
        `sha256:${'a'.repeat(64)}`,
      ],
    )
    await sql.unsafe(
      `INSERT INTO query_result_snapshots (
         id, workspace_id, project_id, request_hash, protocol_version,
         engine_version, engine_config_hash, canonical_sql, dataset_snapshots,
         schema_hash, result_hash, result_artifact_hash, columns, rows,
         row_count, truncated, executed_at
       ) VALUES (
         $1, $2, $3, $4, '1', 'duckdb-test', $5,
         'SELECT "value" FROM "records" LIMIT 1', $6::jsonb, $7, $8, $9,
         $10::jsonb, $11::jsonb, 1, false, NOW()
       )`,
      [
        queryResultId,
        workspaceId,
        projectId,
        `sha256:${'3'.repeat(64)}`,
        `sha256:${'4'.repeat(64)}`,
        JSON.stringify([{
          alias: 'records',
          datasetId,
          snapshotId: datasetSnapshotId,
          schemaHash: `sha256:${'1'.repeat(64)}`,
          parquetDigest: '5'.repeat(64),
        }]),
        `sha256:${'1'.repeat(64)}`,
        `sha256:${'6'.repeat(64)}`,
        `sha256:${'7'.repeat(64)}`,
        JSON.stringify([{ ordinal: 0, name: 'value', type: 'BIGINT' }]),
        JSON.stringify([['42']]),
      ],
    )
    await sql.unsafe(
      `INSERT INTO dataset_citations (
         id, query_result_snapshot_id, workspace_id, project_id,
         dataset_id, dataset_snapshot_id, schema_hash, parquet_digest,
         result_hash, result_artifact_hash, canonical_sql, selected_columns,
         row_start, row_end_exclusive
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
         'SELECT "value" FROM "records" LIMIT 1', '["value"]'::jsonb, 0, 1
       )`,
      [
        datasetCitationId,
        queryResultId,
        workspaceId,
        projectId,
        datasetId,
        datasetSnapshotId,
        `sha256:${'1'.repeat(64)}`,
        '5'.repeat(64),
        `sha256:${'6'.repeat(64)}`,
        `sha256:${'7'.repeat(64)}`,
      ],
    )
    await sql.unsafe(
      `INSERT INTO research_run_dataset_citations (
         run_id, dataset_citation_id, ordinal
       ) VALUES ($1, $2, 0)`,
      [runId, datasetCitationId],
    )
    await sql.unsafe(
      `INSERT INTO citations (id, run_id, source_version_id, locator, status)
       VALUES ($1, $2, $3, $4, 'validated')`,
      [citationId, runId, sourceVersionId, documentLocator],
    )
    await sql.unsafe(
      `INSERT INTO sources (id, project_id, name, kind)
       VALUES ($1, $2, 'missing-document.txt', 'document')`,
      [sourceWithoutDocumentId, projectId],
    )
    await sql.unsafe(
      `INSERT INTO source_versions (id, source_id, version, artifact_ref, content_hash)
       VALUES ($1, $2, 1, 'artifact://missing-document', 'sha256:missing-document')`,
      [versionWithoutDocumentId, sourceWithoutDocumentId],
    )
    await sql.unsafe(
      `INSERT INTO source_text_index (source_version_id, content)
       VALUES ($1, 'Text index must not satisfy a document locator.')`,
      [versionWithoutDocumentId],
    )
    await sql.unsafe(
      `INSERT INTO citations (id, run_id, source_version_id, locator, status)
       VALUES ($1, $2, $3, 'lines:1-1', 'validated')`,
      [lineCitationId, runId, versionWithoutDocumentId],
    )
    await sql.unsafe(
      `INSERT INTO citations (id, run_id, source_version_id, locator, status)
       VALUES ($1, $2, $3, 'document:chars:0-4,bytes:0-4', 'validated')`,
      [missingDocumentCitationId, runId, versionWithoutDocumentId],
    )
    await sql.unsafe(
      `INSERT INTO event_journal
         (id, workspace_id, entity_type, entity_id, event_type, payload)
       VALUES
         ('e70e8400-e29b-41d4-a716-446655440008', $1, 'research', $2, 'research-completed',
          jsonb_build_object('jobId', 'e70e8400-e29b-41d4-a716-446655440009', 'attempt', 1, 'citationCount', 1))`,
      [workspaceId, runId],
    )
  })

  afterAll(async () => {
    await sql.unsafe(`DELETE FROM event_journal WHERE workspace_id = $1`, [workspaceId])
    await sql.unsafe(`DELETE FROM research_threads WHERE project_id = $1`, [projectId])
    await sql.unsafe(
      `DELETE FROM query_result_snapshots WHERE workspace_id = $1`,
      [workspaceId],
    )
    await sql.unsafe(`DELETE FROM dataset_assets WHERE workspace_id = $1`, [workspaceId])
    await sql.unsafe(`DELETE FROM source_versions WHERE source_id = $1`, [sourceId])
    await sql.unsafe(`DELETE FROM sources WHERE id = $1`, [sourceId])
    await sql.unsafe(`DELETE FROM projects WHERE id = $1`, [projectId])
    await sql.unsafe(`DELETE FROM workspaces WHERE id = $1`, [workspaceId])
    await sql.end()
  })

  it('replays scoped events and resolves final answer plus stored citation context', async () => {
    const events = await Effect.runPromise(
      ResearchProjectionRepo.listEventsAfter(
        workspaceId,
        projectId,
        runId,
        0n,
        10,
      )
        .pipe(Effect.provide(layer)),
    )
    const exists = await Effect.runPromise(
      ResearchProjectionRepo.runExists(workspaceId, projectId, runId)
        .pipe(Effect.provide(layer)),
    )
    const completed = await Effect.runPromise(
      ResearchProjectionRepo.findCompleted(workspaceId, projectId, runId)
        .pipe(Effect.provide(layer)),
    )
    const citation = await Effect.runPromise(
      ResearchProjectionRepo.findCitation(projectId, threadId, citationId)
        .pipe(Effect.provide(layer)),
    )
    const lineCitation = await Effect.runPromise(
      ResearchProjectionRepo.findCitation(projectId, threadId, lineCitationId)
        .pipe(Effect.provide(layer)),
    )
    const missingDocumentCitation = await Effect.runPromiseExit(
      ResearchProjectionRepo.findCitation(
        projectId,
        threadId,
        missingDocumentCitationId,
      ).pipe(Effect.provide(layer)),
    )

    expect(exists).toBe(true)
    expect(events.map((event) => event.eventType)).toEqual(['research-completed'])
    expect(completed.answer).toBe('July 18.')
    expect(completed.citations).toContainEqual({
      id: citationId,
      sourceVersionId,
      locator: documentLocator,
    })
    expect(completed.datasetCitations).toHaveLength(1)
    expect(completed.datasetCitations[0]).toMatchObject({
      id: datasetCitationId,
      queryResultSnapshotId: queryResultId,
      datasetId,
      datasetSnapshotId,
      selectedColumns: ['value'],
      rowStart: 0,
      rowEndExclusive: 1,
    })
    expect(citation.content).toBe('Normalized before\nLaunch is July 18.\nAfter')
    expect(lineCitation.content).toBe(
      'Text index must not satisfy a document locator.',
    )
    expect(Exit.isFailure(missingDocumentCitation)).toBe(true)
  })

  it('does not expose a run through a different project scope', async () => {
    const otherProjectId =
      ProjectId.make('e70e8400-e29b-41d4-a716-446655440010')
    const exists = await Effect.runPromise(
      ResearchProjectionRepo.runExists(workspaceId, otherProjectId, runId)
        .pipe(Effect.provide(layer)),
    )
    const events = await Effect.runPromise(
      ResearchProjectionRepo.listEventsAfter(
        workspaceId,
        otherProjectId,
        runId,
        0n,
        10,
      ).pipe(Effect.provide(layer)),
    )
    const citation = await Effect.runPromiseExit(
      ResearchProjectionRepo.findCitation(otherProjectId, threadId, citationId)
        .pipe(Effect.provide(layer)),
    )
    expect(exists).toBe(false)
    expect(events).toEqual([])
    expect(Exit.isFailure(citation)).toBe(true)
  })
})
