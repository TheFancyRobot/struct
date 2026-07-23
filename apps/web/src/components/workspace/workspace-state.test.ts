import { describe, expect, it } from 'bun:test'
import {
  createWorkspaceState,
  workspaceProjectId,
} from './workspace-state'

describe('workspace state', () => {
  it('preserves same-project state and resets only project-scoped selections on project change', () => {
    const state = createWorkspaceState('project-a')
    state.setDraft('question in progress')
    state.setSelectedEvidence('citation-a')
    state.setNavigationCollapsed(true)

    state.setProjectScope('project-a')
    expect(state.draft()).toBe('question in progress')
    expect(state.selectedEvidence()).toBe('citation-a')

    state.setProjectScope('project-b')
    expect(state.draft()).toBe('')
    expect(state.selectedEvidence()).toBeNull()
    expect(state.navigationCollapsed()).toBe(true)
  })

  it('derives project scope from canonical and nested routes', () => {
    expect(workspaceProjectId('/')).toBeNull()
    expect(workspaceProjectId('/projects/project-a')).toBe('project-a')
    expect(workspaceProjectId('/projects/project-a/research/thread-a')).toBe('project-a')
    expect(workspaceProjectId('/struct/projects/project-a', '/struct')).toBe('project-a')
    expect(workspaceProjectId('/other/projects/project-a', '/struct')).toBeNull()
  })
})
