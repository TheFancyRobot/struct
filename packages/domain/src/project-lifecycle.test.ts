import { describe, expect, it } from 'bun:test'
import { Schema } from 'effect'
import { ProjectId } from './branded-ids'
import {
  CreateProjectRequest,
  decodeProjectListCursor,
  encodeProjectListCursor,
  ProjectListCursor,
  ProjectListPage,
  ProjectSummary,
} from './project-lifecycle'

const projectId = ProjectId.make('550e8400-e29b-41d4-a716-446655440001')
const project = {
  id: projectId,
  name: 'Café roadmap',
  createdAt: 1,
  updatedAt: 2,
}

describe('project lifecycle contracts', () => {
  it('normalizes project names with trim and Unicode NFC', () => {
    const decoded = Schema.decodeUnknownSync(CreateProjectRequest)({
      name: '  Cafe\u0301 roadmap  ',
    })

    expect(decoded.name).toBe('Café roadmap')
  })

  it('rejects blank, control-character, and oversized project names', () => {
    for (const candidate of [
      '',
      '   ',
      'bad\u0000name',
      'x'.repeat(121),
    ]) {
      expect(() => Schema.decodeUnknownSync(CreateProjectRequest)({
        name: candidate,
      })).toThrow()
    }
  })

  it('accepts only canonical bounded project-list cursors', () => {
    const cursor = encodeProjectListCursor({
      updatedAt: 2,
      nameFolded: 'cafe roadmap',
      id: projectId,
    })
    const decoded = Schema.decodeUnknownSync(ProjectListCursor)(cursor)

    expect(decoded).toBe(cursor)
    expect(decodeProjectListCursor(cursor)).toEqual({
      updatedAt: 2,
      nameFolded: 'cafe roadmap',
      id: projectId,
    })

    const nonCanonical = btoa(JSON.stringify({
      id: projectId,
      nameFolded: 'cafe roadmap',
      updatedAt: 2,
    }))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/u, '')
    expect(() => Schema.decodeUnknownSync(ProjectListCursor)(nonCanonical)).toThrow()
    expect(() => Schema.decodeUnknownSync(ProjectListCursor)('garbage')).toThrow()
  })

  it('decodes bounded list pages without exposing workspace ids', () => {
    const decoded = Schema.decodeUnknownSync(ProjectListPage)({
      items: [project],
      nextCursor: null,
    })

    expect(decoded.items).toHaveLength(1)
    expect(decoded.items[0]?.id).toBe(projectId)
    expect(decoded.items[0]?.name).toBe(project.name)
    expect(decoded.items[0]).not.toHaveProperty('workspaceId')
    expect(decoded.nextCursor).toBeNull()
  })

  it('reuses the same summary shape for single-project reads', () => {
    const decoded = Schema.decodeUnknownSync(ProjectSummary)(project)

    expect(decoded.id).toBe(projectId)
    expect(decoded.createdAt).toBe(1n)
    expect(decoded.updatedAt).toBe(2n)
  })
})
