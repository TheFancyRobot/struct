import { describe, expect, it } from 'bun:test'
import { reportReturnPath } from './citation-return'

describe('report citation return path', () => {
  const projectId = 'b80e8400-e29b-41d4-a716-446655440001'

  it('accepts only this project notebook and its query context', () => {
    expect(reportReturnPath(
      projectId,
      `/projects/${projectId}/notebook?workspaceId=workspace&reportId=report`,
    )).toContain(`/projects/${projectId}/notebook`)
    expect(reportReturnPath(projectId, `/projects/${projectId}/notebook`))
      .toBe(`/projects/${projectId}/notebook`)
  })

  it('rejects protocol-relative, cross-project, and unrelated return paths', () => {
    expect(reportReturnPath(projectId, '//attacker.invalid')).toBeUndefined()
    expect(reportReturnPath(
      projectId,
      '/projects/b80e8400-e29b-41d4-a716-446655440002/notebook',
    )).toBeUndefined()
    expect(reportReturnPath(
      projectId,
      `/projects/${projectId}/research/thread/runs/run`,
    )).toBeUndefined()
  })
})
