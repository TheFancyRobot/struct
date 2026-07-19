import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import {
  DatasetCitationId,
  DatasetId,
  DatasetSchemaFamilyId,
  DatasetSnapshotId,
  ProjectId,
  QueryResultSnapshotId,
  Sha256Digest,
  SourceId,
  SourceVersionId,
  WorkspaceId,
} from '@struct/domain'
import { Effect, Layer } from 'effect'
import postgres from 'postgres'
import type postgresTypes from 'postgres'
import {
  DatasetQueryEvidenceRepo,
  SqlClientLive,
} from '../index.js'

const DATABASE_URL = process.env['DATABASE_URL']
const describeIf = DATABASE_URL ? describe : describe.skip
const workspaceId = WorkspaceId.make('850e8400-e29b-41d4-a716-446655440001')
const projectId = ProjectId.make('850e8400-e29b-41d4-a716-446655440002')
const sourceId = SourceId.make('850e8400-e29b-41d4-a716-446655440003')
const versionId = SourceVersionId.make('850e8400-e29b-41d4-a716-446655440004')
const datasetId = DatasetId.make('850e8400-e29b-41d4-a716-446655440005')
const familyId = DatasetSchemaFamilyId.make('850e8400-e29b-41d4-a716-446655440006')
const datasetSnapshotId =
  DatasetSnapshotId.make('850e8400-e29b-41d4-a716-446655440007')
const joinedDatasetId =
  DatasetId.make('850e8400-e29b-41d4-a716-446655440014')
const joinedFamilyId =
  DatasetSchemaFamilyId.make('850e8400-e29b-41d4-a716-446655440015')
const joinedSnapshotId =
  DatasetSnapshotId.make('850e8400-e29b-41d4-a716-446655440016')
const resultId =
  QueryResultSnapshotId.make('850e8400-e29b-41d4-a716-446655440008')
const replayResultId =
  QueryResultSnapshotId.make('850e8400-e29b-41d4-a716-446655440009')
const citationId =
  DatasetCitationId.make('850e8400-e29b-41d4-a716-446655440010')
const replayCitationId =
  DatasetCitationId.make('850e8400-e29b-41d4-a716-446655440011')
const rollbackResultId =
  QueryResultSnapshotId.make('850e8400-e29b-41d4-a716-446655440012')
const schemaHash = Sha256Digest.make(`sha256:${'a'.repeat(64)}`)
const resultHash = Sha256Digest.make(`sha256:${'b'.repeat(64)}`)
const resultArtifactHash = Sha256Digest.make(`sha256:${'e'.repeat(64)}`)
const requestHash = Sha256Digest.make(`sha256:${'c'.repeat(64)}`)

describeIf('DatasetQueryEvidenceRepo (PostgreSQL)', () => {
  let sql: postgresTypes.Sql
  let layer: Layer.Layer<DatasetQueryEvidenceRepo>

  beforeAll(async () => {
    if (!DATABASE_URL) return
    sql = postgres(DATABASE_URL, { max: 4, idle_timeout: 5 })
    layer = Layer.provide(DatasetQueryEvidenceRepo.Default, SqlClientLive(sql))
    await sql.unsafe('DELETE FROM workspaces WHERE id = $1', [workspaceId])
    await sql.unsafe(
      `INSERT INTO workspaces (id, name) VALUES ($1, 'Query evidence')`,
      [workspaceId],
    )
    await sql.unsafe(
      `INSERT INTO projects (id, workspace_id, name)
       VALUES ($1, $2, 'Query evidence')`,
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
      [
        versionId,
        sourceId,
        `artifact://sha256/${'d'.repeat(64)}`,
        `sha256:${'d'.repeat(64)}`,
      ],
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
      [familyId, datasetId, workspaceId, projectId, schemaHash],
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
      [
        datasetSnapshotId,
        datasetId,
        workspaceId,
        projectId,
        familyId,
        `sha256:${'d'.repeat(64)}`,
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
        versionId,
        `sha256:${'d'.repeat(64)}`,
      ],
    )
    await sql.unsafe(
      `INSERT INTO dataset_assets (
         id, workspace_id, project_id, name, lifecycle_status
       ) VALUES ($1, $2, $3, 'Joined rows', 'active')`,
      [joinedDatasetId, workspaceId, projectId],
    )
    await sql.unsafe(
      `INSERT INTO dataset_schema_families (
         id, dataset_id, workspace_id, project_id, schema_hash
       ) VALUES ($1, $2, $3, $4, $5)`,
      [
        joinedFamilyId,
        joinedDatasetId,
        workspaceId,
        projectId,
        `sha256:${'7'.repeat(64)}`,
      ],
    )
    await sql.unsafe(
      `INSERT INTO dataset_field_schemas (
         schema_family_id, ordinal, name, source_type, logical_type, nullable
       ) VALUES ($1, 0, 'label', 'string', 'string', false)`,
      [joinedFamilyId],
    )
    await sql.unsafe(
      `INSERT INTO dataset_snapshots (
         id, dataset_id, workspace_id, project_id, version,
         schema_family_id, content_hash
       ) VALUES ($1, $2, $3, $4, 1, $5, $6)`,
      [
        joinedSnapshotId,
        joinedDatasetId,
        workspaceId,
        projectId,
        joinedFamilyId,
        `sha256:${'6'.repeat(64)}`,
      ],
    )
    await sql.unsafe(
      `INSERT INTO dataset_snapshot_sources (
         snapshot_id, dataset_id, workspace_id, project_id, ordinal,
         source_id, source_version_id, content_hash
       ) VALUES ($1, $2, $3, $4, 0, $5, $6, $7)`,
      [
        joinedSnapshotId,
        joinedDatasetId,
        workspaceId,
        projectId,
        sourceId,
        versionId,
        `sha256:${'d'.repeat(64)}`,
      ],
    )
  })

  afterAll(async () => {
    if (!sql) return
    await sql.unsafe('DELETE FROM workspaces WHERE id = $1', [workspaceId])
    await sql.end()
  })

  const result = (id = resultId, hash = requestHash) => ({
    id,
    workspaceId,
    projectId,
    requestHash: hash,
    protocolVersion: '1' as const,
    engineVersion: 'duckdb-1.5.4',
    engineConfigHash: Sha256Digest.make(`sha256:${'9'.repeat(64)}`),
    canonicalSql: 'SELECT id FROM records ORDER BY ALL',
    snapshots: [{
      alias: 'records',
      datasetId,
      snapshotId: datasetSnapshotId,
      schemaHash,
      parquetDigest: '8'.repeat(64),
    }],
    schemaHash,
    resultHash,
    resultArtifactHash,
    columns: [{ ordinal: 0, name: 'id', type: 'BIGINT' }],
    rows: [['1'], ['2']],
    rowCount: 2,
    truncated: false,
    executedAt: 1_721_430_000_000n,
    createdAt: 1_721_430_000_000n,
  })
  const citation = (
    id = citationId,
    queryResultSnapshotId = resultId,
  ) => ({
    id,
    queryResultSnapshotId,
    workspaceId,
    projectId,
    datasetId,
    datasetSnapshotId,
    schemaHash,
    parquetDigest: '8'.repeat(64),
    resultHash,
    resultArtifactHash,
    canonicalSql: 'SELECT id FROM records ORDER BY ALL',
    selectedColumns: ['id'],
    rowStart: 0,
    rowEndExclusive: 2,
    createdAt: 1_721_430_000_000n,
  })

  it('replays immutable identities and reopens the exact evidence', async () => {
    const first = await Effect.runPromise(
      DatasetQueryEvidenceRepo.record(
        result(),
        [citation()],
      ).pipe(Effect.provide(layer)),
    )
    const replay = await Effect.runPromise(
      DatasetQueryEvidenceRepo.record(
        {
          ...result(replayResultId),
          executedAt: 1_721_430_060_000n,
          createdAt: 1_721_430_060_000n,
        },
        [citation(replayCitationId, replayResultId)],
      ).pipe(Effect.provide(layer)),
    )
    expect(replay).toEqual(first)
    expect(replay.result.id).toBe(resultId)
    expect(replay.citations[0]?.id).toBe(citationId)

    const evidence = await Effect.runPromise(
      DatasetQueryEvidenceRepo.reopen(
        workspaceId,
        projectId,
        citationId,
      ).pipe(Effect.provide(layer)),
    )
    expect(evidence.rows).toEqual([['1'], ['2']])
    expect(evidence.columns.map((column) => column.name)).toEqual(['id'])
    expect(evidence.snapshot.resultHash).toBe(resultHash)

    const history = await Effect.runPromise(
      DatasetQueryEvidenceRepo.history(workspaceId, projectId, 25).pipe(
        Effect.provide(layer),
      ),
    )
    expect(history.map((entry) => entry.id)).toEqual([resultId])
  })

  it('hides foreign scopes and database triggers reject mutation', async () => {
    const foreign = await Effect.runPromiseExit(
      DatasetQueryEvidenceRepo.reopen(
        WorkspaceId.make('850e8400-e29b-41d4-a716-446655440099'),
        projectId,
        citationId,
      ).pipe(Effect.provide(layer)),
    )
    expect(String(foreign)).toContain('DatasetQueryEvidenceScopeError')

    let mutationRejected = false
    try {
      await sql.unsafe(
        `UPDATE query_result_snapshots SET result_hash = $1 WHERE id = $2`,
        [`sha256:${'e'.repeat(64)}`, resultId],
      )
    } catch (error) {
      mutationRejected = String(error).includes(
        'immutable dataset catalog rows cannot be updated',
      )
    }
    expect(mutationRejected).toBe(true)
  })

  it('rejects first-write and replay lineage mismatches without corrupting evidence', async () => {
    const mismatchedResultId =
      QueryResultSnapshotId.make('850e8400-e29b-41d4-a716-446655440019')
    const mismatchedHash = Sha256Digest.make(`sha256:${'1'.repeat(64)}`)
    const mismatch = await Effect.runPromiseExit(
      DatasetQueryEvidenceRepo.record(
        result(mismatchedResultId, mismatchedHash),
        [{
          ...citation(
            DatasetCitationId.make('850e8400-e29b-41d4-a716-446655440020'),
            mismatchedResultId,
          ),
          schemaHash: Sha256Digest.make(`sha256:${'0'.repeat(64)}`),
        }],
      ).pipe(Effect.provide(layer)),
    )
    expect(String(mismatch)).toContain('DatasetQueryEvidenceConflictError')
    expect(await sql.unsafe(
      'SELECT id FROM query_result_snapshots WHERE id = $1',
      [mismatchedResultId],
    )).toHaveLength(0)

    const replayMismatch = await Effect.runPromiseExit(
      DatasetQueryEvidenceRepo.record(
        result(replayResultId),
        [{
          ...citation(replayCitationId, replayResultId),
          parquetDigest: '0'.repeat(64),
        }],
      ).pipe(Effect.provide(layer)),
    )
    expect(String(replayMismatch)).toContain(
      'DatasetQueryEvidenceConflictError',
    )
    const original = await Effect.runPromise(
      DatasetQueryEvidenceRepo.reopen(
        workspaceId,
        projectId,
        citationId,
      ).pipe(Effect.provide(layer)),
    )
    expect(original.citation.parquetDigest).toBe('8'.repeat(64))
  })

  it('reopens one input citation when a join output has a different schema hash', async () => {
    const joinResultId =
      QueryResultSnapshotId.make('850e8400-e29b-41d4-a716-446655440017')
    const joinCitationId =
      DatasetCitationId.make('850e8400-e29b-41d4-a716-446655440018')
    const joinResultHash = Sha256Digest.make(`sha256:${'5'.repeat(64)}`)
    const joinArtifactHash = Sha256Digest.make(`sha256:${'4'.repeat(64)}`)
    const joinedResult = {
      ...result(
        joinResultId,
        Sha256Digest.make(`sha256:${'3'.repeat(64)}`),
      ),
      canonicalSql:
        'SELECT records.id, labels.label FROM records JOIN labels USING (id) ORDER BY ALL',
      snapshots: [
        result().snapshots[0]!,
        {
          alias: 'labels',
          datasetId: joinedDatasetId,
          snapshotId: joinedSnapshotId,
          schemaHash: Sha256Digest.make(`sha256:${'7'.repeat(64)}`),
          parquetDigest: '6'.repeat(64),
        },
      ],
      schemaHash: Sha256Digest.make(`sha256:${'2'.repeat(64)}`),
      resultHash: joinResultHash,
      resultArtifactHash: joinArtifactHash,
      columns: [
        { ordinal: 0, name: 'id', type: 'BIGINT' },
        { ordinal: 1, name: 'label', type: 'VARCHAR' },
      ],
      rows: [['1', 'one']],
      rowCount: 1,
    }
    const joinedCitation = {
      ...citation(joinCitationId, joinResultId),
      resultHash: joinResultHash,
      resultArtifactHash: joinArtifactHash,
      canonicalSql: joinedResult.canonicalSql,
      selectedColumns: ['id'],
      rowEndExclusive: 1,
    }
    await Effect.runPromise(
      DatasetQueryEvidenceRepo.record(joinedResult, [joinedCitation]).pipe(
        Effect.provide(layer),
      ),
    )
    const reopened = await Effect.runPromise(
      DatasetQueryEvidenceRepo.reopen(
        workspaceId,
        projectId,
        joinCitationId,
      ).pipe(Effect.provide(layer)),
    )
    expect(reopened.citation.schemaHash).toBe(schemaHash)
    expect(reopened.snapshot.schemaHash).toBe(joinedResult.schemaHash)
    expect(reopened.rows).toEqual([['1']])
  })

  it('rolls back the result when any citation cannot be persisted', async () => {
    const rollbackHash = Sha256Digest.make(`sha256:${'f'.repeat(64)}`)
    const duplicateCitationId =
      DatasetCitationId.make('850e8400-e29b-41d4-a716-446655440013')
    const firstCitation = {
      ...citation(duplicateCitationId, rollbackResultId),
      rowEndExclusive: 1,
    }
    const conflictingCitation = {
      ...citation(duplicateCitationId, rollbackResultId),
      rowStart: 1,
    }
    const exit = await Effect.runPromiseExit(
      DatasetQueryEvidenceRepo.record(
        result(rollbackResultId, rollbackHash),
        [firstCitation, conflictingCitation],
      ).pipe(Effect.provide(layer)),
    )
    expect(String(exit)).toContain('DatasetQueryEvidencePersistenceError')
    const rows = await sql.unsafe(
      'SELECT id FROM query_result_snapshots WHERE id = $1',
      [rollbackResultId],
    )
    expect(rows).toHaveLength(0)
  })
})
