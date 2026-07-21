import { describe, expect, it } from 'bun:test'
import { reportReturnPath } from './citation-return'

async function withBaseUrl<T>(baseUrl: string | undefined, load: () => Promise<T>): Promise<T> {
  const env = import.meta.env as Record<string, string | undefined>
  const previousBaseUrl = env.BASE_URL
  env.BASE_URL = baseUrl
  try {
    return await load()
  } finally {
    env.BASE_URL = previousBaseUrl
  }
}

describe('report citation return path', () => {
  const projectId = 'b80e8400-e29b-41d4-a716-446655440001'

  it('accepts only this project notebook and its query context without a base path', async () => {
    const resolvedReportReturnPath = (value: string | undefined) =>
      withBaseUrl('/', async () => reportReturnPath(projectId, value))

    expect(await resolvedReportReturnPath(
      `/projects/${projectId}/notebook?workspaceId=workspace&reportId=report`,
    )).toContain(`/projects/${projectId}/notebook`)
    expect(await resolvedReportReturnPath(`/projects/${projectId}/notebook`))
      .toBe(`/projects/${projectId}/notebook`)
  })

  it('accepts notebook return paths that include the configured base path', async () => {
    const resolvedReportReturnPath = (value: string | undefined) =>
      withBaseUrl('/struct/', async () => reportReturnPath(projectId, value))

    expect(await resolvedReportReturnPath(
      `/struct/projects/${projectId}/notebook?workspaceId=workspace&reportId=report`,
    )).toBe(`/projects/${projectId}/notebook?workspaceId=workspace&reportId=report`)
  })

  it('rejects protocol-relative, cross-project, and unrelated return paths', async () => {
    const resolvedReportReturnPath = (value: string | undefined) =>
      withBaseUrl('/struct/', async () => reportReturnPath(projectId, value))

    expect(await resolvedReportReturnPath('//attacker.invalid')).toBeUndefined()
    expect(await resolvedReportReturnPath(
      '/struct/projects/b80e8400-e29b-41d4-a716-446655440002/notebook',
    )).toBeUndefined()
    expect(await resolvedReportReturnPath(
      `/struct/projects/${projectId}/research/thread/runs/run`,
    )).toBeUndefined()
  })
})
