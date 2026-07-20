import { describe, expect, it } from 'bun:test'
import {
  DurableArtifactConflictError,
  resolveArtifactIdentityCollision,
} from './durable-artifacts'

describe('durable artifact concurrent insert resolution', () => {
  it('returns only an exact committed winner snapshot', () => {
    const snapshot = { revision: 0 }
    expect(resolveArtifactIdentityCollision(
      'finding',
      'finding-id',
      'same-key',
      'same-hash',
      {
        idempotency_key: 'same-key',
        payload_hash: 'same-hash',
        snapshot,
      },
    )).toBe(snapshot)
  })

  it('maps absent or different winners to typed conflicts', () => {
    for (const row of [
      undefined,
      {
        idempotency_key: 'other-key',
        payload_hash: 'same-hash',
        snapshot: {},
      },
      {
        idempotency_key: 'same-key',
        payload_hash: 'other-hash',
        snapshot: {},
      },
    ]) {
      expect(() => resolveArtifactIdentityCollision(
        'report',
        'report-id',
        'same-key',
        'same-hash',
        row,
      )).toThrow(DurableArtifactConflictError)
    }
  })
})
