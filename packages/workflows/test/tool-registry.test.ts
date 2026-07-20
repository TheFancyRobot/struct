import { describe, expect, it } from 'bun:test'
import {
  ProjectId,
  ResearchPlanNodeId,
  ResearchRunId,
  WorkspaceId,
} from '@struct/domain'
import { Effect, Schema } from 'effect'
import {
  makeResearchToolRegistry,
  type ResearchToolDefinition,
  type ResearchToolTrace,
} from '../src/tools/registry.js'

const context = {
  workspaceId: WorkspaceId.make('770e8400-e29b-41d4-a716-446655440000'),
  projectId: ProjectId.make('770e8400-e29b-41d4-a716-446655440001'),
  runId: ResearchRunId.make('770e8400-e29b-41d4-a716-446655440002'),
  nodeId: ResearchPlanNodeId.make('770e8400-e29b-41d4-a716-446655440003'),
  capability: 'document:retrieve' as const,
  attempt: 1,
  idempotencyKey: 'run:node',
  signal: new AbortController().signal,
}

function definition(
  authorize = true,
  calls: unknown[] = [],
): ResearchToolDefinition {
  return {
    toolId: 'hybrid-retrieval',
    capability: 'document:retrieve',
    input: Schema.Struct({ query: Schema.String }),
    output: Schema.Struct({ count: Schema.Number }),
    timeoutMilliseconds: 100,
    idempotent: true,
    authorize: () => Effect.succeed(authorize),
    execute: (input) => Effect.sync(() => {
      calls.push(input)
      return { count: 1 }
    }),
  }
}

describe('typed research tool registry', () => {
  it('schema-validates and authorizes before dispatch with secret-safe traces', async () => {
    const traces: ResearchToolTrace[] = []
    const calls: unknown[] = []
    const registry = makeResearchToolRegistry([definition(true, calls)], {
      trace: (entry) => Effect.sync(() => {
        traces.push(entry)
      }),
    })

    expect(await Effect.runPromise(
      registry.dispatch('hybrid-retrieval', {
        query: 'launch',
        secret: 'not-retained',
      }, context),
    )).toEqual({ count: 1 })
    expect(calls).toEqual([{ query: 'launch' }])
    expect(traces.map((entry) => entry.outcome)).toEqual([
      'started',
      'succeeded',
    ])
    expect(JSON.stringify(traces)).not.toContain('not-retained')
  })

  it('rejects unknown, unauthorized, and invalid requests before dispatch', async () => {
    const calls: unknown[] = []
    const registry = makeResearchToolRegistry([definition(false, calls)], {
      trace: () => Effect.void,
    })
    const unauthorized = await Effect.runPromiseExit(
      registry.dispatch('hybrid-retrieval', { query: 'launch' }, context),
    )
    const unknown = await Effect.runPromiseExit(
      registry.dispatch('citation-validation', {}, {
        ...context,
        capability: 'citation:validate',
      }),
    )
    const invalidRegistry = makeResearchToolRegistry(
      [definition(true, calls)],
      { trace: () => Effect.void },
    )
    const invalid = await Effect.runPromiseExit(
      invalidRegistry.dispatch('hybrid-retrieval', { query: 1 }, context),
    )

    expect(String(unauthorized)).toContain('ResearchToolAuthorizationError')
    expect(String(unknown)).toContain('ResearchToolUnknownError')
    expect(String(invalid)).toContain('ResearchToolInputValidationError')
    expect(calls).toEqual([])
  })
})

