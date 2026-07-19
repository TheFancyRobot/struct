import { describe, it, expect } from 'bun:test'
import { Schema } from 'effect'
import {
  Workspace,
  Project,
  Source,
  SourceVersion,
  ResearchAnswer,
  ResearchThread,
  ResearchRun,
  Citation,
  Finding,
  Report,
} from './schemas'

describe('Domain Schemas', () => {
  describe('Workspace', () => {
    it('decodes a valid Workspace', () => {
      const input = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Test Workspace',
        createdAt: 1700000000000,
        updatedAt: 1700000000000,
      }
      const result = Schema.decodeUnknownSync(Workspace)(input)
      expect(String(result.id)).toBe('550e8400-e29b-41d4-a716-446655440000')
      expect(result.name).toBe('Test Workspace')
    })
  })

  describe('Project', () => {
    it('decodes a valid Project', () => {
      const input = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        workspaceId: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Test Project',
        createdAt: 1700000000000,
        updatedAt: 1700000000000,
      }
      const result = Schema.decodeUnknownSync(Project)(input)
      expect(String(result.id)).toBe('550e8400-e29b-41d4-a716-446655440001')
      expect(String(result.workspaceId)).toBe('550e8400-e29b-41d4-a716-446655440000')
    })
  })

  describe('Source', () => {
    it('decodes a valid Source with kind=document', () => {
      const input = {
        id: '550e8400-e29b-41d4-a716-446655440002',
        projectId: '550e8400-e29b-41d4-a716-446655440001',
        name: 'Test Source',
        kind: 'document',
        createdAt: 1700000000000,
        updatedAt: 1700000000000,
      }
      const result = Schema.decodeUnknownSync(Source)(input)
      expect(result.kind).toBe('document')
    })

    it('rejects invalid source kind', () => {
      const input = {
        id: '550e8400-e29b-41d4-a716-446655440002',
        projectId: '550e8400-e29b-41d4-a716-446655440001',
        name: 'Test Source',
        kind: 'invalid-kind',
        createdAt: 1700000000000,
        updatedAt: 1700000000000,
      }
      expect(() => Schema.decodeUnknownSync(Source)(input)).toThrow()
    })
  })

  describe('SourceVersion', () => {
    it('decodes a valid SourceVersion with content_hash', () => {
      const input = {
        id: '550e8400-e29b-41d4-a716-446655440003',
        sourceId: '550e8400-e29b-41d4-a716-446655440002',
        version: 1,
        artifactRef: 'artifacts/v1.pdf',
        contentHash: 'sha256:abc123def456',
        createdAt: 1700000000000,
      }
      const result = Schema.decodeUnknownSync(SourceVersion)(input)
      expect(String(result.id)).toBe('550e8400-e29b-41d4-a716-446655440003')
      expect(result.contentHash).toBe('sha256:abc123def456')
    })

    it('rejects SourceVersion without content_hash', () => {
      const input = {
        id: '550e8400-e29b-41d4-a716-446655440003',
        sourceId: '550e8400-e29b-41d4-a716-446655440002',
        version: 1,
        artifactRef: 'artifacts/v1.pdf',
        createdAt: 1700000000000,
      }
      expect(() => Schema.decodeUnknownSync(SourceVersion)(input)).toThrow()
    })
  })

  describe('ResearchAnswer', () => {
    it.each(['', ' ', '\n\t'])(
      'rejects an empty or whitespace-only answer before completion (%j)',
      (answer) => {
        expect(() =>
          Schema.decodeUnknownSync(ResearchAnswer)({
            answer,
            citations: [],
          }),
        ).toThrow()
      },
    )
  })

  describe('ResearchThread', () => {
    it('decodes a valid ResearchThread', () => {
      const input = {
        id: '550e8400-e29b-41d4-a716-446655440004',
        projectId: '550e8400-e29b-41d4-a716-446655440001',
        title: 'Test Thread',
        createdAt: 1700000000000,
        updatedAt: 1700000000000,
      }
      const result = Schema.decodeUnknownSync(ResearchThread)(input)
      expect(result.title).toBe('Test Thread')
    })
  })

  describe('ResearchRun', () => {
    it('decodes a valid ResearchRun', () => {
      const input = {
        id: '550e8400-e29b-41d4-a716-446655440005',
        threadId: '550e8400-e29b-41d4-a716-446655440004',
        question: 'What is the impact of X?',
        status: 'pending',
        createdAt: 1700000000000,
        updatedAt: 1700000000000,
      }
      const result = Schema.decodeUnknownSync(ResearchRun)(input)
      expect(result.status).toBe('pending')
    })

    it('rejects invalid ResearchRun status', () => {
      const input = {
        id: '550e8400-e29b-41d4-a716-446655440005',
        threadId: '550e8400-e29b-41d4-a716-446655440004',
        question: 'What is the impact of X?',
        status: 'unknown-status',
        createdAt: 1700000000000,
        updatedAt: 1700000000000,
      }
      expect(() => Schema.decodeUnknownSync(ResearchRun)(input)).toThrow()
    })
  })

  describe('Citation', () => {
    it('decodes a valid Citation referencing immutable source version', () => {
      const input = {
        id: '550e8400-e29b-41d4-a716-446655440006',
        runId: '550e8400-e29b-41d4-a716-446655440005',
        sourceVersionId: '550e8400-e29b-41d4-a716-446655440003',
        locator: 'page:5,para:2',
        status: 'validated',
        createdAt: 1700000000000,
      }
      const result = Schema.decodeUnknownSync(Citation)(input)
      expect(String(result.sourceVersionId)).toBe('550e8400-e29b-41d4-a716-446655440003')
      expect(result.status).toBe('validated')
    })
  })

  describe('Finding', () => {
    it('decodes a valid Finding', () => {
      const input = {
        id: '550e8400-e29b-41d4-a716-446655440007',
        projectId: '550e8400-e29b-41d4-a716-446655440001',
        title: 'Key Finding',
        content: 'Finding content here.',
        createdAt: 1700000000000,
        updatedAt: 1700000000000,
      }
      const result = Schema.decodeUnknownSync(Finding)(input)
      expect(result.title).toBe('Key Finding')
    })
  })

  describe('Report', () => {
    it('decodes a valid Report', () => {
      const input = {
        id: '550e8400-e29b-41d4-a716-446655440008',
        projectId: '550e8400-e29b-41d4-a716-446655440001',
        title: 'Research Report',
        content: 'Report body.',
        createdAt: 1700000000000,
        updatedAt: 1700000000000,
      }
      const result = Schema.decodeUnknownSync(Report)(input)
      expect(result.title).toBe('Research Report')
    })
  })
})
