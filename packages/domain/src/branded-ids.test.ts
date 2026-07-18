import { describe, it, expect } from 'vitest'
import { WorkspaceId, ProjectId } from './branded-ids'
import { Schema } from 'effect'

describe('Branded IDs', () => {
  it('decodes a valid UUID into WorkspaceId', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000'
    const result = Schema.decodeUnknownSync(WorkspaceId)(uuid)
    expect(result).toBe(uuid)
  })

  it('decodes a valid UUID into ProjectId', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440001'
    const result = Schema.decodeUnknownSync(ProjectId)(uuid)
    expect(result).toBe(uuid)
  })

  it('rejects an invalid UUID', () => {
    const invalid = 'not-a-uuid'
    expect(() => Schema.decodeUnknownSync(WorkspaceId)(invalid)).toThrow()
  })
})
