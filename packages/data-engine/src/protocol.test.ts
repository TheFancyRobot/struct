import { describe, expect, it } from 'bun:test'
import { Schema } from 'effect'
import { MaterializeRequest, QueryRequest } from './protocol.js'

describe('data-engine protocol', () => {
  it('rejects protocol drift and non-contiguous inputs', async () => {
    const decoded = await Schema.decodeUnknownEither(MaterializeRequest)({
      protocolVersion: '2',
      operation: 'materialize',
      snapshotId: '550e8400-e29b-41d4-a716-446655440003',
      inputs: [],
      fields: [],
      limits: {
        maxInputBytes: 1,
        maxRows: 1,
        maxOutputBytes: 1,
        timeoutMs: 1,
      },
    })
    expect(decoded._tag).toBe('Left')
  })

  it('requires unique catalog aliases and bounded query limits', async () => {
    const decoded = await Schema.decodeUnknownEither(QueryRequest)({
      protocolVersion: '1',
      operation: 'query',
      workspaceId: '550e8400-e29b-41d4-a716-446655440001',
      projectId: '550e8400-e29b-41d4-a716-446655440002',
      sql: 'SELECT * FROM records ORDER BY id',
      snapshots: [
        {
          alias: 'records',
          datasetId: '550e8400-e29b-41d4-a716-446655440003',
          snapshotId: '550e8400-e29b-41d4-a716-446655440004',
          schemaHash: `sha256:${'a'.repeat(64)}`,
          parquetDigest: 'b'.repeat(64),
        },
        {
          alias: 'records',
          datasetId: '550e8400-e29b-41d4-a716-446655440005',
          snapshotId: '550e8400-e29b-41d4-a716-446655440006',
          schemaHash: `sha256:${'c'.repeat(64)}`,
          parquetDigest: 'd'.repeat(64),
        },
      ],
      limits: {
        maxRows: 100,
        maxOutputBytes: 1_024,
        maxMemoryMb: 64,
        timeoutMs: 1_000,
      },
    })
    expect(decoded._tag).toBe('Left')
  })
})
