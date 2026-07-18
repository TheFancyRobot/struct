import { describe, expect, it } from 'vitest'
import { Effect } from 'effect'
import type { FredClient, WorkflowIR } from '@fancyrobot/fred'
import {
  ProjectId,
  ResearchRunId,
  SourceVersionId,
  WorkspaceId,
} from '@struct/domain'
import {
  ANSWER_SYNTHESIZER_AGENT_ID,
  SEARCH_TEXT_TOOL_ID,
  answerSynthesizerAgent,
  makeSearchTextTool,
  makeWalkingSkeletonWorkflow,
} from '../src/graphs/walking-skeleton'
import { runFredWalkingSkeleton } from '../src/adapters/fred-runtime'
import { MockModelProvider } from './fixtures/mock-provider'

const input = {
  runId: ResearchRunId.make('c50e8400-e29b-41d4-a716-446655440000'),
  workspaceId: WorkspaceId.make('c50e8400-e29b-41d4-a716-446655440001'),
  projectId: ProjectId.make('c50e8400-e29b-41d4-a716-446655440002'),
  sourceVersionIds: [
    SourceVersionId.make('c50e8400-e29b-41d4-a716-446655440003'),
  ],
  question: 'When is launch?',
}

const evidence = [{
  sourceVersionId: input.sourceVersionIds[0],
  locator: 'lines:1-1',
  excerpt: 'Launch is July 18.',
  rank: 1,
}]

describe('Fred walking-skeleton workflow', () => {
  it('defines one deterministic search node, one answer agent, and one citation gate', () => {
    const workflow = makeWalkingSkeletonWorkflow({
      searchText: async () => evidence,
      validate: async (answer) => answer,
    })
    const searchTool = makeSearchTextTool(async () => evidence)
    const agent = answerSynthesizerAgent('mock-model-provider', 'fixed')

    expect(workflow.nodes.map((node) => [node.id, node.kind])).toEqual([
      ['searchText', 'function'],
      ['synthesize', 'agent'],
      ['validateCitations', 'function'],
    ])
    expect(workflow.edges).toHaveLength(2)
    expect(searchTool.id).toBe(SEARCH_TEXT_TOOL_ID)
    expect(searchTool.strict).toBe(true)
    expect(agent.id).toBe(ANSWER_SYNTHESIZER_AGENT_ID)
    expect(agent.tools).toBeUndefined()
    expect(agent.maxSteps).toBe(1)
  })

  it('runs with a fixed mock provider/client and no provider keys', async () => {
    const calls: string[] = []
    const finalOutput = {
      plan: { query: input.question, maxSteps: 5, maxToolCalls: 1, maxModelCalls: 1 },
      evidence,
      answer: {
        answer: 'Launch is July 18.',
        citations: [{
          sourceVersionId: input.sourceVersionIds[0],
          locator: 'lines:1-1',
        }],
      },
    }
    const client = {
      providers: {
        use: async () => {
          calls.push('provider')
          return MockModelProvider
        },
      },
      tools: { register: async () => { calls.push('tool') } },
      agents: { register: async () => { calls.push('agent') } },
      workflows: {
        define: async (workflow: WorkflowIR) => {
          calls.push(`workflow:${workflow.id}`)
        },
        run: async () => ({
          success: true,
          status: 'completed',
          context: { input, outputs: {}, history: [], metadata: {}, pipelineId: 'test' },
          outputs: {},
          executedNodes: ['searchText', 'synthesize', 'validateCitations'],
          finalOutput,
          runId: input.runId,
        }),
      },
      shutdown: async () => { calls.push('shutdown') },
    } as unknown as FredClient

    const result = await Effect.runPromise(
      runFredWalkingSkeleton(
        input,
        {
          searchText: async () => evidence,
          validate: async (answer) => answer,
        },
        { providerPackage: 'mock', model: 'fixed', maxElapsedMs: 1000 },
        { create: async () => client },
      ),
    )

    expect(result).toEqual(finalOutput)
    expect(calls).toEqual([
      'provider',
      'tool',
      'agent',
      'workflow:struct.walking-skeleton-research',
      'shutdown',
    ])
  })
})
