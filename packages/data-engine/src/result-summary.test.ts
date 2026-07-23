import { describe, expect, it } from 'bun:test'
import {
  DatasetCitationId,
  DatasetId,
  DatasetSnapshotId,
  ProjectId,
  QueryResultSnapshotId,
  Sha256Digest,
  WorkspaceId,
  type DatasetCitationEvidence,
} from '@struct/domain'
import { Effect } from 'effect'
import {
  summarizeQueryResult,
  type ResultSummaryLimits,
} from './result-summary.js'
import {
  DATA_ENGINE_ADAPTER_VERSION,
  DATA_ENGINE_EXECUTION_POLICY_VERSION,
} from './protocol.js'

const workspaceId = WorkspaceId.make('780e8400-e29b-41d4-a716-446655440001')
const projectId = ProjectId.make('780e8400-e29b-41d4-a716-446655440002')
const datasetId = DatasetId.make('780e8400-e29b-41d4-a716-446655440003')
const datasetSnapshotId = DatasetSnapshotId.make(
  '780e8400-e29b-41d4-a716-446655440004',
)
const resultId = QueryResultSnapshotId.make(
  '780e8400-e29b-41d4-a716-446655440005',
)
const citationId = DatasetCitationId.make(
  '780e8400-e29b-41d4-a716-446655440006',
)
const schemaHash = Sha256Digest.make(`sha256:${'a'.repeat(64)}`)
const resultHash = Sha256Digest.make(`sha256:${'b'.repeat(64)}`)
const artifactHash = Sha256Digest.make(`sha256:${'c'.repeat(64)}`)
const columns = [
  { ordinal: 0, name: 'decimal_value', type: 'DECIMAL(38,4)' },
  { ordinal: 1, name: 'large_integer', type: 'HUGEINT' },
  { ordinal: 2, name: 'zero_value', type: 'INTEGER' },
  { ordinal: 3, name: 'nullable_value', type: 'VARCHAR' },
]
const rows = [[
  '1234567890.0042',
  '999999999999999999999999999999',
  '0',
  null,
]]
const canonicalSql =
  'SELECT decimal_value, large_integer, zero_value, nullable_value FROM metrics'

function evidence(
  patch: Partial<DatasetCitationEvidence['snapshot']> = {},
): DatasetCitationEvidence {
  const snapshot: DatasetCitationEvidence['snapshot'] = {
    id: resultId,
    workspaceId,
    projectId,
    requestHash: Sha256Digest.make(`sha256:${'d'.repeat(64)}`),
    protocolVersion: '1' as const,
    engineVersion: 'duckdb-1.5.4',
    engineAdapterVersion: DATA_ENGINE_ADAPTER_VERSION,
    executionPolicyVersion: DATA_ENGINE_EXECUTION_POLICY_VERSION,
    engineConfigHash: Sha256Digest.make(`sha256:${'e'.repeat(64)}`),
    canonicalSql,
    snapshots: [{
      alias: 'metrics',
      datasetId,
      snapshotId: datasetSnapshotId,
      schemaHash,
      parquetDigest: 'f'.repeat(64),
    }],
    schemaHash,
    resultHash,
    resultArtifactHash: artifactHash,
    columns,
    rows,
    rowCount: 1,
    truncated: false,
    executedAt: 1n,
    createdAt: 1n,
    ...patch,
  }
  return {
    citation: {
      id: citationId,
      queryResultSnapshotId: resultId,
      workspaceId,
      projectId,
      datasetId,
      datasetSnapshotId,
      schemaHash,
      parquetDigest: 'f'.repeat(64),
      resultHash,
      resultArtifactHash: artifactHash,
      canonicalSql,
      selectedColumns: columns.map((column) => column.name),
      rowStart: 0,
      rowEndExclusive: 1,
      createdAt: 1n,
    },
    snapshot,
    columns,
    rows,
  }
}

const limits: ResultSummaryLimits = {
  maximumRows: 10,
  maximumColumns: 10,
  maximumBytes: 32_768,
}

describe('bounded query result summary', () => {
  it('preserves exact decimals, large integers, zero, null, and provenance', async () => {
    const first = await Effect.runPromise(summarizeQueryResult(
      evidence(),
      limits,
    ))
    const replay = await Effect.runPromise(summarizeQueryResult(
      evidence(),
      limits,
    ))

    expect(replay).toEqual(first)
    expect(first).toMatchObject({
      queryResultSnapshotId: resultId,
      datasetCitationId: citationId,
      canonicalSql,
      resultHash,
      resultArtifactHash: artifactHash,
      rows,
      rowStart: 0,
      rowEndExclusive: 1,
      rowCount: 1,
      truncated: false,
    })
  })

  it('fails closed for truncated, altered, or oversized evidence', async () => {
    const truncated = await Effect.runPromise(Effect.either(
      summarizeQueryResult(evidence({ truncated: true }), limits),
    ))
    expect(truncated).toMatchObject({
      _tag: 'Left',
      left: { reason: 'truncated-result' },
    })

    const original = evidence()
    const altered = {
      ...original,
      rows: original.rows.map((row, rowIndex) =>
        row.map((value, columnIndex) =>
          rowIndex === 0 && columnIndex === 0
            ? '1234567890.0043'
            : value)),
    }
    const forged = await Effect.runPromise(Effect.either(
      summarizeQueryResult(altered, limits),
    ))
    expect(forged).toMatchObject({
      _tag: 'Left',
      left: { reason: 'invalid-lineage' },
    })

    const oversized = await Effect.runPromise(Effect.either(
      summarizeQueryResult(evidence(), { ...limits, maximumRows: 1, maximumBytes: 8 }),
    ))
    expect(oversized).toMatchObject({
      _tag: 'Left',
      left: { reason: 'result-too-large' },
    })
  })
})
