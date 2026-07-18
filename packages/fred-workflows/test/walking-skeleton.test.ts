import { describe, expect, it } from 'vitest'
import { Effect, Exit, Schema } from 'effect'
import type {
  FredClient,
  WorkflowExecutionResult,
  WorkflowIR,
} from '@fancyrobot/fred'
import {
  ProjectId,
  ResearchRunId,
  SourceVersionId,
  WorkspaceId,
} from '@struct/domain'
import {
  ANSWER_SYNTHESIZER_AGENT_ID,
  AnswerSynthesizerInput,
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
      onRetrievalCompleted: async () => undefined,
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
    expect(
      Schema.decodeUnknownSync(AnswerSynthesizerInput)({
        input,
        question: input.question,
        evidence,
        instruction: 'Use exact citations.',
      }),
    ).toMatchObject({ question: input.question, evidence })
  })

  it('preserves EvidenceInsufficientError when deterministic search is empty', async () => {
    const completed: Array<ReadonlyArray<(typeof evidence)[number]>> = []
    const workflow = makeWalkingSkeletonWorkflow({
      searchText: async () => [],
      onRetrievalCompleted: async (retrieved) => {
        completed.push([...retrieved])
      },
      validate: async (answer) => answer,
    })
    const searchNode = workflow.nodes.find((node) => node.id === 'searchText')
    if (!searchNode || searchNode.kind !== 'function') {
      throw new Error('searchText function node was not defined')
    }

    let failure: unknown
    try {
      await searchNode.fn({
        input,
        outputs: {},
        history: [],
        metadata: {},
        pipelineId: workflow.id,
      } as never)
    } catch (error) {
      failure = error
    }
    expect(failure).toBeInstanceOf(Error)
    expect((failure as Error).name).toContain('EvidenceInsufficientError')
    expect(completed).toEqual([[]])
  })

  it('does not report retrieval completion when deterministic search fails', async () => {
    let completionCalls = 0
    const workflow = makeWalkingSkeletonWorkflow({
      searchText: async () => {
        throw new Error('retrieval failed')
      },
      onRetrievalCompleted: async () => {
        completionCalls += 1
      },
      validate: async (answer) => answer,
    })
    const searchNode = workflow.nodes.find((node) => node.id === 'searchText')
    if (!searchNode || searchNode.kind !== 'function') {
      throw new Error('searchText function node was not defined')
    }

    await expect(
      searchNode.fn({
        input,
        outputs: {},
        history: [],
        metadata: {},
        pipelineId: workflow.id,
      } as never),
    ).rejects.toThrow('retrieval failed')
    expect(completionCalls).toBe(0)
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
          onRetrievalCompleted: async () => undefined,
          validate: async (answer) => answer,
        },
        { providerPackage: 'mock', model: 'fixed', maxElapsedMs: 1000 },
        {
          create: async () => client,
          execute: async () => ({
            success: true,
            status: 'completed',
            context: { input, outputs: {}, history: [], metadata: {}, pipelineId: 'test' },
            outputs: {},
            executedNodes: ['searchText', 'synthesize', 'validateCitations'],
            finalOutput,
            runId: input.runId,
          }),
        },
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

  it('interrupts retrieval before callbacks or model work and shuts down on timeout', async () => {
    let shutdownCalls = 0
    let retrievalInterrupts = 0
    let retrievalCallbacks = 0
    let modelWork = 0
    const client = {
      providers: { use: async () => MockModelProvider },
      tools: { register: async () => undefined },
      agents: { register: async () => undefined },
      workflows: {
        define: async () => undefined,
        run: async () => Effect.runPromise(Effect.never),
      },
      shutdown: async () => {
        shutdownCalls += 1
      },
    } as unknown as FredClient

    const result = await Effect.runPromiseExit(
      runFredWalkingSkeleton(
        input,
        {
          searchText: async (_input, signal) =>
            await new Promise<ReadonlyArray<(typeof evidence)[number]>>(
              (_resolve, reject) => {
                signal.addEventListener('abort', () => {
                  retrievalInterrupts += 1
                  reject(signal.reason)
                }, { once: true })
              },
            ),
          onRetrievalCompleted: async () => {
            retrievalCallbacks += 1
          },
          validate: async (answer) => answer,
        },
        { providerPackage: 'mock', model: 'fixed', maxElapsedMs: 10 },
        {
          create: async () => client,
          execute: async (_fred, workflow) => {
            const searchNode = workflow.nodes.find((node) => node.id === 'searchText')
            if (!searchNode || searchNode.kind !== 'function') {
              throw new Error('searchText function node was not defined')
            }
            await searchNode.fn({
              input,
              outputs: {},
              history: [],
              metadata: {},
              pipelineId: workflow.id,
            } as never)
            modelWork += 1
            throw new Error('timeout failed to interrupt workflow')
          },
        },
      ),
    )

    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(Exit.isFailure(result)).toBe(true)
    expect(retrievalInterrupts).toBe(1)
    expect(retrievalCallbacks).toBe(0)
    expect(modelWork).toBe(0)
    expect(shutdownCalls).toBeGreaterThanOrEqual(1)
  })

  it('does not continue registration when provider setup resolves after timeout', async () => {
    const calls: string[] = []
    const client = {
      providers: {
        use: async () => {
          await new Promise((resolve) => setTimeout(resolve, 30))
          calls.push('provider-resolved')
          return MockModelProvider
        },
      },
      tools: { register: async () => { calls.push('tool') } },
      agents: { register: async () => { calls.push('agent') } },
      workflows: {
        define: async () => { calls.push('workflow') },
        run: async () => {
          calls.push('non-cancellable-run')
          throw new Error('non-cancellable execution must never be used')
        },
      },
      shutdown: async () => {
        calls.push('shutdown')
        await new Promise<never>(() => undefined)
      },
    } as unknown as FredClient
    const startedAt = Date.now()

    const exit = await Effect.runPromiseExit(
      runFredWalkingSkeleton(
        input,
        {
          searchText: async () => evidence,
          onRetrievalCompleted: async () => undefined,
          validate: async (answer) => answer,
        },
        { providerPackage: 'delayed', model: 'fixed', maxElapsedMs: 5 },
        {
          create: async () => client,
          execute: async () => {
            calls.push('execute')
            throw new Error('execution must not start')
          },
        },
      ),
    )
    const elapsedMs = Date.now() - startedAt

    await new Promise((resolve) => setTimeout(resolve, 45))
    expect(Exit.isFailure(exit)).toBe(true)
    expect(elapsedMs).toBeLessThan(100)
    expect(calls).toContain('provider-resolved')
    expect(calls).toContain('shutdown')
    expect(calls).not.toContain('tool')
    expect(calls).not.toContain('agent')
    expect(calls).not.toContain('workflow')
    expect(calls).not.toContain('execute')
    expect(calls).not.toContain('non-cancellable-run')
  })

  it('releases a client created after timeout without starting provider setup', async () => {
    const calls: string[] = []
    const client = {
      providers: { use: async () => { calls.push('provider') } },
      tools: { register: async () => undefined },
      agents: { register: async () => undefined },
      workflows: {
        define: async () => undefined,
        run: async () => {
          calls.push('non-cancellable-run')
          throw new Error('non-cancellable execution must never be used')
        },
      },
      shutdown: async () => { calls.push('shutdown') },
    } as unknown as FredClient
    const startedAt = Date.now()

    const exit = await Effect.runPromiseExit(
      runFredWalkingSkeleton(
        input,
        {
          searchText: async () => evidence,
          onRetrievalCompleted: async () => undefined,
          validate: async (answer) => answer,
        },
        { providerPackage: 'mock', model: 'fixed', maxElapsedMs: 5 },
        {
          create: async () => {
            await new Promise((resolve) => setTimeout(resolve, 30))
            calls.push('created')
            return client
          },
          execute: async () => {
            calls.push('execute')
            throw new Error('execution must not start')
          },
        },
      ),
    )
    const elapsedMs = Date.now() - startedAt

    expect(Exit.isFailure(exit)).toBe(true)
    expect(elapsedMs).toBeLessThan(100)
    await new Promise((resolve) => setTimeout(resolve, 45))
    expect(calls).toEqual(['created', 'shutdown'])
  })

  it('stops after a non-abortable delayed retrieval resolves post-timeout', async () => {
    const calls: string[] = []
    const client = {
      providers: { use: async () => MockModelProvider },
      tools: { register: async () => undefined },
      agents: { register: async () => undefined },
      workflows: {
        define: async () => undefined,
        run: async () => {
          calls.push('non-cancellable-run')
          throw new Error('non-cancellable execution must never be used')
        },
      },
      shutdown: async () => { calls.push('shutdown') },
    } as unknown as FredClient

    const exit = await Effect.runPromiseExit(
      runFredWalkingSkeleton(
        input,
        {
          searchText: async () => {
            await new Promise((resolve) => setTimeout(resolve, 30))
            calls.push('retrieval-resolved')
            return evidence
          },
          onRetrievalCompleted: async () => { calls.push('retrieval-event') },
          validate: async (answer) => {
            calls.push('validation')
            return answer
          },
        },
        { providerPackage: 'mock', model: 'fixed', maxElapsedMs: 5 },
        {
          create: async () => client,
          execute: async (_fred, workflow) => {
            const searchNode = workflow.nodes.find((node) => node.id === 'searchText')
            if (!searchNode || searchNode.kind !== 'function') {
              throw new Error('searchText function node was not defined')
            }
            await searchNode.fn({
              input,
              outputs: {},
              history: [],
              metadata: {},
              pipelineId: workflow.id,
            } as never)
            calls.push('model')
            throw new Error('aborted graph continued to model work')
          },
        },
      ),
    )

    await new Promise((resolve) => setTimeout(resolve, 45))
    expect(Exit.isFailure(exit)).toBe(true)
    expect(calls).toContain('retrieval-resolved')
    expect(calls).toContain('shutdown')
    expect(calls).not.toContain('retrieval-event')
    expect(calls).not.toContain('model')
    expect(calls).not.toContain('validation')
    expect(calls).not.toContain('non-cancellable-run')
  })

  it('interrupts delayed model execution and prevents workflow continuation', async () => {
    const calls: string[] = []
    const client = {
      providers: { use: async () => MockModelProvider },
      tools: { register: async () => undefined },
      agents: { register: async () => undefined },
      workflows: {
        define: async () => undefined,
        run: async () => {
          calls.push('non-cancellable-run')
          throw new Error('non-cancellable execution must never be used')
        },
      },
      shutdown: async () => { calls.push('shutdown') },
    } as unknown as FredClient

    const exit = await Effect.runPromiseExit(
      runFredWalkingSkeleton(
        input,
        {
          searchText: async () => evidence,
          onRetrievalCompleted: async () => { calls.push('retrieval-event') },
          validate: async (answer) => {
            calls.push('validation')
            return answer
          },
        },
        { providerPackage: 'mock', model: 'fixed', maxElapsedMs: 10 },
        {
          create: async () => client,
          execute: async (_fred, workflow, _workflowInput, _maxElapsedMs, signal) => {
            const searchNode = workflow.nodes.find((node) => node.id === 'searchText')
            if (!searchNode || searchNode.kind !== 'function') {
              throw new Error('searchText function node was not defined')
            }
            await searchNode.fn({
              input,
              outputs: {},
              history: [],
              metadata: {},
              pipelineId: workflow.id,
            } as never)
            calls.push('model-started')
            await new Promise<void>((resolve, reject) => {
              const timeout = setTimeout(resolve, 50)
              signal.addEventListener('abort', () => {
                clearTimeout(timeout)
                reject(signal.reason)
              }, { once: true })
            })
            calls.push('model-completed')
            return {} as WorkflowExecutionResult
          },
        },
      ),
    )

    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(Exit.isFailure(exit)).toBe(true)
    expect(calls).toContain('retrieval-event')
    expect(calls).toContain('model-started')
    expect(calls).toContain('shutdown')
    expect(calls).not.toContain('model-completed')
    expect(calls).not.toContain('validation')
    expect(calls).not.toContain('non-cancellable-run')
  })
})
