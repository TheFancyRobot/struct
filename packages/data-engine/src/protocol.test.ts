import { describe, expect, it } from 'bun:test'
import { Schema } from 'effect'
import { MaterializeRequest } from './protocol.js'

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
})
