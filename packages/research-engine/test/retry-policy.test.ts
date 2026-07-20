import { describe, expect, it } from 'bun:test'
import {
  ProjectId,
  ResearchPlanNodeId,
  ResearchRunId,
  ResearchToolAuthorizationError,
  ResearchToolTransportError,
  WorkspaceId,
} from '@struct/domain'
import { Effect } from 'effect'
import {
  executeResearchToolWithRetry,
  type ResearchRetryAttempt,
  type ResearchRetryContext,
} from '../src/retry-policy.js'

const context: ResearchRetryContext = {
  toolId: 'hybrid-retrieval',
  capability: 'document:retrieve',
  nodeId: ResearchPlanNodeId.make('760e8400-e29b-41d4-a716-446655440000'),
  runId: ResearchRunId.make('760e8400-e29b-41d4-a716-446655440001'),
  idempotent: true,
  idempotencyKey: 'run:node',
  signal: new AbortController().signal,
}
const policy = {
  maximumAttempts: 3,
  initialBackoffMilliseconds: 10,
  maximumBackoffMilliseconds: 100,
} as const

describe('research retry policy', () => {
  it('retries only a transient failure with bounded history and backoff', async () => {
    const history: unknown[] = []
    const sleeps: number[] = []
    let calls = 0
    const result = await Effect.runPromise(executeResearchToolWithRetry(
      context,
      policy,
      {
        sleep: (milliseconds) => Effect.sync(() => {
          sleeps.push(milliseconds)
        }),
        onAttempt: (attempt) => Effect.sync(() => {
          history.push(attempt)
        }),
      },
      () => Effect.suspend(() => {
        calls += 1
        return calls < 3
          ? Effect.fail(new ResearchToolTransportError({
              toolId: context.toolId,
              capability: context.capability,
              nodeId: context.nodeId,
              runId: context.runId,
              message: 'Research tool transport failed',
            }))
          : Effect.succeed('done')
      }),
    ))

    expect(result).toBe('done')
    expect(calls).toBe(3)
    expect(sleeps).toEqual([10, 20])
    expect(history).toHaveLength(2)
  })

  it('never retries authorization failures', async () => {
    let calls = 0
    const exit = await Effect.runPromiseExit(executeResearchToolWithRetry(
      context,
      policy,
      {
        sleep: () => Effect.void,
        onAttempt: () => Effect.void,
      },
      () => {
        calls += 1
        return Effect.fail(new ResearchToolAuthorizationError({
          toolId: context.toolId,
          capability: context.capability,
          nodeId: context.nodeId,
          runId: context.runId,
          workspaceId:
            WorkspaceId.make('760e8400-e29b-41d4-a716-446655440002'),
          projectId:
            ProjectId.make('760e8400-e29b-41d4-a716-446655440003'),
          detail: 'workspace-project-scope',
          message: 'Research tool scope is not authorized',
        }))
      },
    ))
    expect(String(exit)).toContain('ResearchToolAuthorizationError')
    expect(calls).toBe(1)
  })

  it('records transient exhaustion separately from permanent failure', async () => {
    const history: ResearchRetryAttempt[] = []
    let calls = 0
    const exit = await Effect.runPromiseExit(executeResearchToolWithRetry(
      context,
      policy,
      {
        sleep: () => Effect.void,
        onAttempt: (attempt) => Effect.sync(() => {
          history.push(attempt)
        }),
      },
      () => {
        calls += 1
        return Effect.fail(new ResearchToolTransportError({
          toolId: context.toolId,
          capability: context.capability,
          nodeId: context.nodeId,
          runId: context.runId,
          message: 'Research tool transport failed',
        }))
      },
    ))

    expect(String(exit)).toContain('ResearchToolTransportError')
    expect(calls).toBe(3)
    expect(history).toEqual([
      {
        attempt: 1,
        errorTag: 'ResearchToolTransportError',
        retryable: true,
        willRetry: true,
        stopReason: null,
        backoffMilliseconds: 10,
      },
      {
        attempt: 2,
        errorTag: 'ResearchToolTransportError',
        retryable: true,
        willRetry: true,
        stopReason: null,
        backoffMilliseconds: 20,
      },
      {
        attempt: 3,
        errorTag: 'ResearchToolTransportError',
        retryable: true,
        willRetry: false,
        stopReason: 'exhausted',
        backoffMilliseconds: 0,
      },
    ])
  })

  it('rejects automatic retries without idempotency protection', async () => {
    const exit = await Effect.runPromiseExit(executeResearchToolWithRetry(
      { ...context, idempotent: false, idempotencyKey: null },
      policy,
      {
        sleep: () => Effect.void,
        onAttempt: () => Effect.void,
      },
      () => Effect.succeed('must-not-run'),
    ))
    expect(String(exit)).toContain('ResearchToolRetrySafetyError')
  })
})
