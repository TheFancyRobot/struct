import { describe, it, expect } from 'bun:test'
import { Effect } from 'effect'
import {
  decodeWorkspaceRow,
  decodeProjectRow,
  decodeSourceRow,
  decodeSourceVersionRow,
  decodeResearchRunRow,
  decodeCitationRow,
  DecodeError,
} from './decode'

/**
 * Tests for Fix #1: decoders must use Effect Schema decode, not type assertions.
 * Invalid DB values (bad UUIDs, invalid enums, wrong types) must fail loudly.
 */
describe('Repository Row Decoders (typed decode)', () => {
  describe('decodeWorkspaceRow', () => {
    it('decodes a valid workspace row with Date.getTime()→BigInt', async () => {
      const createdAt = new Date('2024-01-01T00:00:00Z')
      const updatedAt = new Date('2024-06-15T12:00:00Z')
      const row = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Test Workspace',
        created_at: createdAt,
        updated_at: updatedAt,
      }
      const result = await Effect.runPromise(decodeWorkspaceRow(row))
      expect(String(result.id)).toBe('550e8400-e29b-41d4-a716-446655440000')
      expect(result.name).toBe('Test Workspace')
      expect(result.createdAt).toBe(BigInt(createdAt.getTime()))
      expect(result.updatedAt).toBe(BigInt(updatedAt.getTime()))
    })

    it('fails on invalid UUID', async () => {
      const ts = new Date('2024-01-01T00:00:00Z')
      const row = {
        id: 'not-a-uuid',
        name: 'Test',
        created_at: ts,
        updated_at: ts,
      }
      const result = await Effect.runPromiseExit(decodeWorkspaceRow(row))
      expect(result._tag).toBe('Failure')
    })

    it('fails on missing name field', async () => {
      const ts = new Date('2024-01-01T00:00:00Z')
      const row = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: undefined,
        created_at: ts,
        updated_at: ts,
      }
      const result = await Effect.runPromiseExit(decodeWorkspaceRow(row as any))
      expect(result._tag).toBe('Failure')
    })
  })

  describe('decodeProjectRow', () => {
    it('decodes valid project row with workspace_id→workspaceId', async () => {
      const ts = new Date('2024-03-01T00:00:00Z')
      const row = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        workspace_id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Test Project',
        created_at: ts,
        updated_at: ts,
      }
      const result = await Effect.runPromise(decodeProjectRow(row))
      expect(String(result.workspaceId)).toBe('550e8400-e29b-41d4-a716-446655440000')
      expect(result.createdAt).toBe(BigInt(ts.getTime()))
    })

    it('fails on invalid workspace_id UUID', async () => {
      const ts = new Date('2024-03-01T00:00:00Z')
      const row = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        workspace_id: 'bad-uuid',
        name: 'Test',
        created_at: ts,
        updated_at: ts,
      }
      const result = await Effect.runPromiseExit(decodeProjectRow(row))
      expect(result._tag).toBe('Failure')
    })
  })

  describe('decodeSourceRow', () => {
    it('decodes valid source row with kind enum', async () => {
      const ts = new Date('2024-03-01T00:00:00Z')
      const row = {
        id: '550e8400-e29b-41d4-a716-446655440002',
        project_id: '550e8400-e29b-41d4-a716-446655440001',
        name: 'Test Source',
        kind: 'document',
        created_at: ts,
        updated_at: ts,
      }
      const result = await Effect.runPromise(decodeSourceRow(row))
      expect(result.kind).toBe('document')
    })

    it('fails on invalid source kind', async () => {
      const ts = new Date('2024-03-01T00:00:00Z')
      const row = {
        id: '550e8400-e29b-41d4-a716-446655440002',
        project_id: '550e8400-e29b-41d4-a716-446655440001',
        name: 'Test',
        kind: 'invalid-kind',
        created_at: ts,
        updated_at: ts,
      }
      const result = await Effect.runPromiseExit(decodeSourceRow(row))
      expect(result._tag).toBe('Failure')
    })
  })

  describe('decodeSourceVersionRow', () => {
    it('decodes valid source version with content_hash', async () => {
      const ts = new Date('2024-03-01T00:00:00Z')
      const row = {
        id: '550e8400-e29b-41d4-a716-446655440003',
        source_id: '550e8400-e29b-41d4-a716-446655440002',
        version: 1,
        artifact_ref: 'artifacts/v1.pdf',
        content_hash: 'sha256:abc123',
        created_at: ts,
      }
      const result = await Effect.runPromise(decodeSourceVersionRow(row))
      expect(result.contentHash).toBe('sha256:abc123')
      expect(result.version).toBe(1)
    })

    it('fails on missing content_hash', async () => {
      const ts = new Date('2024-03-01T00:00:00Z')
      const row = {
        id: '550e8400-e29b-41d4-a716-446655440003',
        source_id: '550e8400-e29b-41d4-a716-446655440002',
        version: 1,
        artifact_ref: 'artifacts/v1.pdf',
        created_at: ts,
      }
      const result = await Effect.runPromiseExit(decodeSourceVersionRow(row as any))
      expect(result._tag).toBe('Failure')
    })
  })

  describe('decodeResearchRunRow', () => {
    it('decodes valid research run with status enum', async () => {
      const ts = new Date('2024-03-01T00:00:00Z')
      const row = {
        id: '550e8400-e29b-41d4-a716-446655440005',
        thread_id: '550e8400-e29b-41d4-a716-446655440004',
        question: 'What is X?',
        status: 'in-progress',
        created_at: ts,
        updated_at: ts,
      }
      const result = await Effect.runPromise(decodeResearchRunRow(row))
      expect(result.status).toBe('in-progress')
    })

    it('fails on invalid research run status', async () => {
      const ts = new Date('2024-03-01T00:00:00Z')
      const row = {
        id: '550e8400-e29b-41d4-a716-446655440005',
        thread_id: '550e8400-e29b-41d4-a716-446655440004',
        question: 'What is X?',
        status: 'unknown-status',
        created_at: ts,
        updated_at: ts,
      }
      const result = await Effect.runPromiseExit(decodeResearchRunRow(row))
      expect(result._tag).toBe('Failure')
    })
  })

  describe('decodeCitationRow', () => {
    it('decodes valid citation with source_version_id reference', async () => {
      const ts = new Date('2024-03-01T00:00:00Z')
      const row = {
        id: '550e8400-e29b-41d4-a716-446655440006',
        run_id: '550e8400-e29b-41d4-a716-446655440005',
        source_version_id: '550e8400-e29b-41d4-a716-446655440003',
        locator: 'page:5,para:2',
        status: 'validated',
        created_at: ts,
      }
      const result = await Effect.runPromise(decodeCitationRow(row))
      expect(String(result.sourceVersionId)).toBe('550e8400-e29b-41d4-a716-446655440003')
      expect(result.status).toBe('validated')
    })

    it('fails on invalid citation status', async () => {
      const ts = new Date('2024-03-01T00:00:00Z')
      const row = {
        id: '550e8400-e29b-41d4-a716-446655440006',
        run_id: '550e8400-e29b-41d4-a716-446655440005',
        source_version_id: '550e8400-e29b-41d4-a716-446655440003',
        locator: 'page:5',
        status: 'bogus',
        created_at: ts,
      }
      const result = await Effect.runPromiseExit(decodeCitationRow(row))
      expect(result._tag).toBe('Failure')
    })

    it('fails on invalid source_version_id UUID', async () => {
      const ts = new Date('2024-03-01T00:00:00Z')
      const row = {
        id: '550e8400-e29b-41d4-a716-446655440006',
        run_id: '550e8400-e29b-41d4-a716-446655440005',
        source_version_id: 'not-a-uuid',
        locator: 'page:5',
        status: 'validated',
        created_at: ts,
      }
      const result = await Effect.runPromiseExit(decodeCitationRow(row))
      expect(result._tag).toBe('Failure')
    })
  })

  describe('DecodeError', () => {
    it('is a Schema.TaggedError with entity and cause fields', () => {
      const err = new DecodeError({
        entity: 'Workspace',
        field: 'id',
        reason: 'Invalid UUID',
        message: 'Failed to decode Workspace: Invalid UUID',
      })
      expect(err._tag).toBe('DecodeError')
      expect(err.entity).toBe('Workspace')
      expect(err.field).toBe('id')
    })
  })
})
