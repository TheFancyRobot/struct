import { describe, expect, it } from 'bun:test'
import { Schema } from 'effect'
import {
  DatasetQueryHistoryItem,
  QueryResultSnapshot,
} from './dataset-query-evidence.js'

const hash = (character: string) => `sha256:${character.repeat(64)}`
const digest = (character: string) => character.repeat(64)

const snapshot = {
  id: '550e8400-e29b-41d4-a716-446655440009',
  workspaceId: '550e8400-e29b-41d4-a716-446655440000',
  projectId: '550e8400-e29b-41d4-a716-446655440001',
  requestHash: hash('a'),
  protocolVersion: '1' as const,
  engineVersion: 'duckdb-fake',
  engineAdapterVersion: '@duckdb/node-api@1.5.4-r.1' as const,
  executionPolicyVersion: 1 as const,
  engineConfigHash: hash('b'),
  canonicalSql: 'SELECT total FROM evidence',
  snapshots: [{
    alias: 'evidence',
    datasetId: '550e8400-e29b-41d4-a716-446655440007',
    snapshotId: '550e8400-e29b-41d4-a716-446655440008',
    schemaHash: hash('c'),
    parquetDigest: digest('d'),
  }],
  schemaHash: hash('e'),
  resultHash: hash('f'),
  resultArtifactHash: hash('1'),
  columns: [{ ordinal: 0, name: 'total', type: 'BIGINT' }],
  rows: [['42']],
  rowCount: 1,
  truncated: false,
  executedAt: 1,
  createdAt: 1,
}

describe('dataset query evidence contracts', () => {
  it('requires the exact pinned engine version on persisted query snapshots', async () => {
    const decoded = await Schema.decodeUnknownEither(QueryResultSnapshot)(snapshot)
    expect(decoded._tag).toBe('Left')
  })

  it('requires the exact pinned engine version on query history items', async () => {
    const decoded = await Schema.decodeUnknownEither(DatasetQueryHistoryItem)({
      id: snapshot.id,
      workspaceId: snapshot.workspaceId,
      projectId: snapshot.projectId,
      requestHash: snapshot.requestHash,
      protocolVersion: snapshot.protocolVersion,
      engineVersion: snapshot.engineVersion,
      engineAdapterVersion: snapshot.engineAdapterVersion,
      executionPolicyVersion: snapshot.executionPolicyVersion,
      engineConfigHash: snapshot.engineConfigHash,
      canonicalSql: snapshot.canonicalSql,
      snapshots: snapshot.snapshots,
      schemaHash: snapshot.schemaHash,
      resultHash: snapshot.resultHash,
      resultArtifactHash: snapshot.resultArtifactHash,
      rowCount: snapshot.rowCount,
      truncated: snapshot.truncated,
      executedAt: snapshot.executedAt,
      createdAt: snapshot.createdAt,
    })
    expect(decoded._tag).toBe('Left')
  })
})
