import { describe, expect, it } from 'bun:test'
import { Schema } from 'effect'
import {
  ProjectId,
  ResearchPlanNodeId,
  ResearchRunId,
  ResearchToolAuthorizationError,
  ResearchToolFailure,
  WorkspaceId,
} from './index.js'

describe('research tool failures', () => {
  it('round-trips a specific serializable authorization failure', () => {
    const failure = new ResearchToolAuthorizationError({
      toolId: 'hybrid-retrieval',
      capability: 'document:retrieve',
      nodeId: ResearchPlanNodeId.make('750e8400-e29b-41d4-a716-446655440000'),
      runId: ResearchRunId.make('750e8400-e29b-41d4-a716-446655440001'),
      workspaceId: WorkspaceId.make('750e8400-e29b-41d4-a716-446655440002'),
      projectId: ProjectId.make('750e8400-e29b-41d4-a716-446655440003'),
      detail: 'workspace-project-scope',
      message: 'Research tool scope is not authorized',
    })

    expect(Schema.decodeUnknownSync(ResearchToolFailure)(
      Schema.encodeSync(ResearchToolFailure)(failure),
    )).toEqual(failure)
  })
})

