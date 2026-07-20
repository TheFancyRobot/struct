import { describe, expect, it } from 'bun:test'
import { Schema } from 'effect'
import {
  ProjectId,
  ResearchPlanNodeId,
  ResearchRunId,
  ResearchToolAuthorizationError,
  ResearchToolCancelledError,
  ResearchToolFailure,
  ResearchToolInputValidationError,
  ResearchToolLeaseLostError,
  ResearchToolOutputValidationError,
  ResearchToolProviderUnavailableError,
  ResearchToolRetrySafetyError,
  ResearchToolSidecarUnavailableError,
  ResearchToolTimeoutError,
  ResearchToolTransportError,
  ResearchToolUnknownError,
  WorkspaceId,
} from './index.js'

describe('research tool failures', () => {
  it('round-trips every specific serializable failure variant', () => {
    const identity = {
      toolId: 'hybrid-retrieval',
      capability: 'document:retrieve',
      nodeId: ResearchPlanNodeId.make('750e8400-e29b-41d4-a716-446655440000'),
      runId: ResearchRunId.make('750e8400-e29b-41d4-a716-446655440001'),
    } as const
    const failures = [
      new ResearchToolUnknownError({
        toolId: 'hybrid-retrieval',
        message: 'Research tool is unknown',
      }),
      new ResearchToolAuthorizationError({
        ...identity,
      workspaceId: WorkspaceId.make('750e8400-e29b-41d4-a716-446655440002'),
      projectId: ProjectId.make('750e8400-e29b-41d4-a716-446655440003'),
      detail: 'workspace-project-scope',
      message: 'Research tool scope is not authorized',
      }),
      new ResearchToolInputValidationError({
        ...identity,
        message: 'Research tool input is invalid',
      }),
      new ResearchToolOutputValidationError({
        ...identity,
        message: 'Research tool output is invalid',
      }),
      new ResearchToolCancelledError({
        ...identity,
        message: 'Research tool was cancelled',
      }),
      new ResearchToolTimeoutError({
        ...identity,
        timeoutMilliseconds: 1_000,
        message: 'Research tool timed out',
      }),
      new ResearchToolProviderUnavailableError({
        ...identity,
        message: 'Research tool provider is unavailable',
      }),
      new ResearchToolTransportError({
        ...identity,
        message: 'Research tool transport failed',
      }),
      new ResearchToolLeaseLostError({
        ...identity,
        message: 'Research tool lease was lost',
      }),
      new ResearchToolSidecarUnavailableError({
        ...identity,
        message: 'Research tool sidecar is unavailable',
      }),
      new ResearchToolRetrySafetyError({
        ...identity,
        message: 'Research tool retry is unsafe',
      }),
    ]

    expect(failures.map((failure) =>
      Schema.decodeUnknownSync(ResearchToolFailure)(
        Schema.encodeSync(ResearchToolFailure)(failure),
      )
    )).toEqual(failures)
  })
})
