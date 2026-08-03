import { describe, expect, it } from 'bun:test'
import { WorkspaceId } from '@struct/domain'
import { configuredWorkspaceId } from './workspace-scope'

describe('configuredWorkspaceId', () => {
  it('accepts the build-time public workspace scope', () => {
    const workspaceId = WorkspaceId.make('590e8400-e29b-41d4-a716-446655440000')

    expect(configuredWorkspaceId(workspaceId)).toBe(workspaceId)
  })

  it('rejects an invalid workspace scope before artifact routes use it', () => {
    expect(() => configuredWorkspaceId('not-a-workspace-id')).toThrow()
  })
})
