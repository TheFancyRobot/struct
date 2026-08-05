import { describe, expect, it } from 'bun:test'
import { pageTitle } from './page-title'

describe('BUG-0072 workspace page titles', () => {
  it.each([
    ['/', 'Projects — Struct'],
    ['/settings', 'Settings — Struct'],
    ['/sources', 'Sources — Struct'],
    ['/projects/project-1', 'Conversation — Struct'],
    ['/projects/project-1/sources', 'Sources — Struct'],
    ['/projects/project-1/notes', 'Notes — Struct'],
    ['/projects/project-1/notes/note-1', 'Notes — Struct'],
    ['/projects/project-1/research/thread-1', 'Research — Struct'],
    ['/projects/project-1/research/thread-1/runs/run-1', 'Research — Struct'],
    ['/projects/project-1/research/thread-1/citation/citation-1', 'Citation — Struct'],
    ['/projects/project-1/notebook', 'Notebook — Struct'],
    ['/does-not-exist', 'Page Not Found — Struct'],
  ])('uses %s for %s', (pathname, title) => {
    expect(pageTitle(pathname, '')).toBe(title)
  })

  it('supports a deployed base path', () => {
    expect(pageTitle('/struct/sources', '/struct')).toBe('Sources — Struct')
  })

  it('uses the generic title outside the deployed base path', () => {
    expect(pageTitle('/sources', '/struct')).toBe('Struct — Research Workspace')
  })
})
