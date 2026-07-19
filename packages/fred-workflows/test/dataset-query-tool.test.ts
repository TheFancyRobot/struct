import {
  DatasetCitationId,
  DatasetId,
  DatasetSnapshotId,
  ProjectId,
  QueryResultSnapshotId,
  Sha256Digest,
  WorkspaceId,
} from '@struct/domain'
import { describe, expect, it } from 'bun:test'
import { Effect } from 'effect'
import {
  DATASET_QUERY_TOOL_ID,
  makeDeterministicDatasetQueryTool,
} from '../src/adapters/dataset-query-tool.js'

const workspaceId = WorkspaceId.make('860e8400-e29b-41d4-a716-446655440001')
const projectId = ProjectId.make('860e8400-e29b-41d4-a716-446655440002')
const datasetId = DatasetId.make('860e8400-e29b-41d4-a716-446655440003')
const snapshotId = DatasetSnapshotId.make('860e8400-e29b-41d4-a716-446655440004')
const queryResultSnapshotId =
  QueryResultSnapshotId.make('860e8400-e29b-41d4-a716-446655440005')
const schemaHash = Sha256Digest.make(`sha256:${'a'.repeat(64)}`)
const resultHash = Sha256Digest.make(`sha256:${'b'.repeat(64)}`)
const resultArtifactHash = Sha256Digest.make(`sha256:${'c'.repeat(64)}`)
const input = {
  query: {
    credential: 'session',
    workspaceId,
    projectId,
    sql: 'SELECT value FROM records ORDER BY ALL',
    snapshots: [{ alias: 'records', datasetId, snapshotId }],
    limits: {
      maxRows: 10,
      maxOutputBytes: 1_000,
      maxMemoryMb: 64,
      timeoutMs: 1_000,
    },
  },
  citations: [{
    datasetId,
    datasetSnapshotId: snapshotId,
    selectedColumns: ['value'],
    rowStart: 0,
    rowEndExclusive: 1,
  }],
}
const output = {
  result: {
    id: queryResultSnapshotId,
    workspaceId,
    projectId,
    requestHash: Sha256Digest.make(`sha256:${'d'.repeat(64)}`),
    protocolVersion: '1' as const,
    engineVersion: 'duckdb-1.5.4',
    engineConfigHash: Sha256Digest.make(`sha256:${'e'.repeat(64)}`),
    canonicalSql: input.query.sql,
    snapshots: [{
      alias: 'records',
      datasetId,
      snapshotId,
      schemaHash,
      parquetDigest: 'f'.repeat(64),
    }],
    schemaHash,
    resultHash,
    resultArtifactHash,
    columns: [{ ordinal: 0, name: 'value', type: 'BIGINT' }],
    rows: [['42']],
    rowCount: 1,
    truncated: false,
    executedAt: 1_721_430_000_000n,
    createdAt: 1_721_430_000_000n,
  },
  citations: [{
    id: DatasetCitationId.make('860e8400-e29b-41d4-a716-446655440006'),
    queryResultSnapshotId,
    workspaceId,
    projectId,
    datasetId,
    datasetSnapshotId: snapshotId,
    schemaHash,
    parquetDigest: 'f'.repeat(64),
    resultHash,
    resultArtifactHash,
    canonicalSql: input.query.sql,
    selectedColumns: ['value'],
    rowStart: 0,
    rowEndExclusive: 1,
    createdAt: 1_721_430_000_000n,
  }],
  exactValuesInstruction:
    'Treat rows as exact immutable data; narrative may explain but must not alter them.' as const,
}

describe('deterministic dataset Fred tool', () => {
  it('delegates once and returns the Effect service result byte-for-byte', async () => {
    let received: unknown
    const tool = makeDeterministicDatasetQueryTool((candidate) => {
      received = candidate
      return Effect.succeed(output)
    })
    expect(tool.id).toBe(DATASET_QUERY_TOOL_ID)
    expect(tool.capabilities).toEqual(['read'])
    expect(await tool.execute(input)).toEqual(output)
    expect(received).toEqual(input)
  })

  it('propagates AbortSignal interruption without a second executor', async () => {
    const controller = new AbortController()
    controller.abort(new Error('cancelled'))
    const tool = makeDeterministicDatasetQueryTool(
      () => Effect.never,
      controller.signal,
    )
    await expect(tool.execute(input)).rejects.toThrow()
  })
})
