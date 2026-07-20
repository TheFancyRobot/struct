import { describe, expect, it } from 'bun:test'
import { createFred } from '@fancyrobot/fred'
import {
  ProjectId,
  ResearchPlanId,
  ResearchPlanNodeId,
  ResearchRunId,
  SourceVersionId,
  WorkspaceId,
  type ResearchPlan,
} from '@struct/domain'
import {
  initialResearchGraphState,
  type ResearchActionResult,
  type ResearchExecutionPolicy,
  ResearchGraphState,
  ResearchProviderFailure,
} from '@struct/research-engine'
import { Effect, Either, Schema } from 'effect'
import {
  compileResearchRunWorkflow,
  RESEARCH_RUN_WORKFLOW_ID,
  type ResearchModelResolver,
  type ResearchRunGraphDependencies,
  type ResearchToolResolver,
} from '../src/graphs/research-run.js'
import type { ResearchModelRoutingPolicy } from '../src/model-routing.js'

const ids = {
  run: ResearchRunId.make('920e8400-e29b-41d4-a716-446655440000'),
  plan: ResearchPlanId.make('920e8400-e29b-41d4-a716-446655440001'),
  workspace: WorkspaceId.make('920e8400-e29b-41d4-a716-446655440002'),
  project: ProjectId.make('920e8400-e29b-41d4-a716-446655440003'),
  source: SourceVersionId.make('920e8400-e29b-41d4-a716-446655440004'),
  retrieve: ResearchPlanNodeId.make('920e8400-e29b-41d4-a716-446655440005'),
  critique: ResearchPlanNodeId.make('920e8400-e29b-41d4-a716-446655440006'),
  synthesize: ResearchPlanNodeId.make('920e8400-e29b-41d4-a716-446655440007'),
  validate: ResearchPlanNodeId.make('920e8400-e29b-41d4-a716-446655440008'),
}

const plan: ResearchPlan = {
  version: '1',
  id: ids.plan,
  runId: ids.run,
  workspaceId: ids.workspace,
  projectId: ids.project,
  objective: 'Answer from retrieved evidence.',
  sourceScopes: [{ kind: 'document', sourceVersionId: ids.source }],
  nodes: [
    {
      id: ids.retrieve,
      kind: 'document-retrieval',
      goal: 'Retrieve evidence.',
      dependencies: [],
      inputRefs: [{ kind: 'source-version', sourceVersionId: ids.source }],
      evidenceRefs: [],
    },
    {
      id: ids.critique,
      kind: 'evidence-evaluation',
      goal: 'Evaluate evidence.',
      dependencies: [ids.retrieve],
      inputRefs: [{ kind: 'node-output', nodeId: ids.retrieve }],
      evidenceRefs: [],
    },
    {
      id: ids.synthesize,
      kind: 'answer-synthesis',
      goal: 'Synthesize the answer.',
      dependencies: [ids.critique],
      inputRefs: [{ kind: 'node-output', nodeId: ids.critique }],
      evidenceRefs: [],
    },
  ],
  evidenceRequirements: [],
  toolPolicy: {
    grants: [{
      toolId: 'hybrid-retrieval',
      capability: 'document:retrieve',
      maximumCalls: 1,
    }],
  },
  budget: {
    maximumSteps: 3,
    maximumModelCalls: 2,
    maximumToolCalls: 1,
    maximumTokens: 10_000,
    maximumElapsedMilliseconds: 10_000,
    maximumEstimatedCostMicros: 100,
    maximumFanOut: 1,
    maximumRevisions: 0,
  },
}

const routing: ResearchModelRoutingPolicy = {
  classification: {
    primary: {
      platform: 'mock-a',
      model: 'classifier',
      maxSteps: 1,
      outputContract: 'question-classification.v1',
    },
    fallback: null,
  },
  planning: {
    primary: {
      platform: 'mock-a',
      model: 'planner',
      maxSteps: 1,
      outputContract: 'research-plan.v1',
    },
    fallback: null,
  },
  critique: {
    primary: {
      platform: 'mock-b',
      model: 'critic',
      maxSteps: 1,
      outputContract: 'evidence-assessment.v1',
    },
    fallback: {
      platform: 'mock-c',
      model: 'critic-fallback',
      maxSteps: 1,
      outputContract: 'evidence-assessment.v1',
    },
  },
  synthesis: {
    primary: {
      platform: 'mock-b',
      model: 'synthesizer',
      maxSteps: 1,
      outputContract: 'research-answer.v1',
    },
    fallback: null,
  },
}

const policy: ResearchExecutionPolicy = {
  maximumDuplicateActions: 1,
  maximumNoProgressActions: 2,
}

const result: ResearchActionResult = {
  progressFingerprint: 'progress:one',
  artifacts: [],
}

function initialState() {
  return initialResearchGraphState({
    runId: ids.run,
    planId: ids.plan,
    workspaceId: ids.workspace,
    projectId: ids.project,
  }, 1_000)
}

function dependencies(
  tools: ResearchToolResolver,
  models: ResearchModelResolver,
): ResearchRunGraphDependencies {
  let now = 1_000
  return {
    tools,
    models,
    now: () => ++now,
    estimatedCostMicros: () => 1,
  }
}

const succeedingTools: ResearchToolResolver = {
  resolve: () => Effect.succeed({
    execute: () => Effect.succeed(result),
  }),
}
const succeedingModels: ResearchModelResolver = {
  resolve: () => Effect.succeed({
    execute: () => Effect.succeed(result),
  }),
}

async function workflow(
  deps = dependencies(succeedingTools, succeedingModels),
  signal?: AbortSignal,
) {
  return Effect.runPromise(
    compileResearchRunWorkflow(plan, routing, policy, deps, signal),
  )
}

function functionNode(
  graph: Awaited<ReturnType<typeof workflow>>,
  id: string,
) {
  const node = graph.nodes.find((candidate) => candidate.id === id)
  if (node?.kind !== 'function') throw new Error(`Missing function node ${id}`)
  return node
}

function context(input: unknown, workflowId = RESEARCH_RUN_WORKFLOW_ID) {
  return {
    input,
    outputs: {},
    history: [],
    metadata: {},
    pipelineId: workflowId,
  }
}

describe('bounded research run graph', () => {
  it('compiles a deterministic dependency-respecting serialized order and resolves exact declared actions', async () => {
    const toolResolutions: unknown[] = []
    const modelResolutions: unknown[] = []
    const graph = await workflow(dependencies(
      {
        resolve: (toolId, capability) => {
          toolResolutions.push({ toolId, capability })
          return Effect.succeed({ execute: () => Effect.succeed(result) })
        },
      },
      {
        resolve: (route) => {
          modelResolutions.push(route)
          return Effect.succeed({ execute: () => Effect.succeed(result) })
        },
      },
    ))

    expect(graph.id).toBe(RESEARCH_RUN_WORKFLOW_ID)
    expect(graph.nodes.map((node) => node.id)).toEqual(plan.nodes.map((node) => node.id))
    expect(graph.edges).toEqual([
      { from: ids.retrieve, to: ids.critique },
      { from: ids.critique, to: ids.synthesize },
    ])

    const afterTool = await functionNode(graph, ids.retrieve).fn(
      context(initialState()),
    )
    const afterCritique = await functionNode(graph, ids.critique).fn(
      context(afterTool),
    )
    const completed = await functionNode(graph, ids.synthesize).fn(
      context(afterCritique),
    )
    expect(completed).toMatchObject({
      status: 'completed',
      steps: 3,
      toolCalls: 1,
      modelCalls: 2,
    })
    expect(toolResolutions).toEqual([{
      toolId: 'hybrid-retrieval',
      capability: 'document:retrieve',
    }])
    expect(modelResolutions).toMatchObject([
      { role: 'critique', primary: { model: 'critic' } },
      { role: 'synthesis', primary: { model: 'synthesizer' } },
    ])
  })

  it('changes model providers without changing the serialized graph contract', async () => {
    const alternate: ResearchModelRoutingPolicy = {
      ...routing,
      critique: {
        primary: {
          ...routing.critique.primary,
          platform: 'alternate',
          model: 'alternate-critic',
        },
        fallback: null,
      },
    }
    const first = await workflow()
    const second = await Effect.runPromise(compileResearchRunWorkflow(
      plan,
      alternate,
      policy,
      dependencies(succeedingTools, succeedingModels),
    ))
    expect(second.nodes.map(({ id, kind }) => ({ id, kind }))).toEqual(
      first.nodes.map(({ id, kind }) => ({ id, kind })),
    )
    expect(second.edges).toEqual(first.edges)
  })

  it('derives dependency order instead of trusting canonical node-id order', async () => {
    const reversedPlan: ResearchPlan = {
      ...plan,
      nodes: [...plan.nodes].reverse(),
    }
    const graph = await Effect.runPromise(compileResearchRunWorkflow(
      reversedPlan,
      routing,
      policy,
      dependencies(succeedingTools, succeedingModels),
    ))
    expect(graph.nodes.map((node) => node.id)).toEqual([
      ids.retrieve,
      ids.critique,
      ids.synthesize,
    ])
    expect(graph.entry).toBe(ids.retrieve)
  })

  it('intentionally serializes a branching plan while respecting every dependency', async () => {
    const branchingPlan: ResearchPlan = {
      ...plan,
      nodes: [
        {
          ...plan.nodes[2]!,
          dependencies: [ids.critique, ids.validate],
          inputRefs: [
            { kind: 'node-output', nodeId: ids.critique },
            { kind: 'node-output', nodeId: ids.validate },
          ],
        },
        {
          id: ids.validate,
          kind: 'citation-validation',
          goal: 'Validate retrieved citations.',
          dependencies: [ids.retrieve],
          inputRefs: [{ kind: 'node-output', nodeId: ids.retrieve }],
          evidenceRefs: [],
        },
        plan.nodes[0]!,
        plan.nodes[1]!,
      ],
      toolPolicy: {
        grants: [
          ...plan.toolPolicy.grants,
          {
            toolId: 'citation-validation',
            capability: 'citation:validate',
            maximumCalls: 1,
          },
        ],
      },
      budget: {
        ...plan.budget,
        maximumSteps: 4,
        maximumToolCalls: 2,
      },
    }
    const graph = await Effect.runPromise(compileResearchRunWorkflow(
      branchingPlan,
      routing,
      policy,
      dependencies(succeedingTools, succeedingModels),
    ))

    expect(graph.nodes.map((node) => node.id)).toEqual([
      ids.retrieve,
      ids.critique,
      ids.validate,
      ids.synthesize,
    ])
    expect(graph.edges).toEqual([
      { from: ids.retrieve, to: ids.critique },
      { from: ids.critique, to: ids.validate },
      { from: ids.validate, to: ids.synthesize },
    ])
  })

  it('runs the compiled sequential graph through providerless core Fred', async () => {
    const fred = await createFred()
    try {
      const graph = await workflow()
      await fred.workflows.define(graph)
      const execution = await fred.workflows.run(
        RESEARCH_RUN_WORKFLOW_ID,
        initialState(),
      )

      expect(execution.success).toBe(true)
      if (!('finalOutput' in execution)) {
        throw new Error('Core Fred did not return a terminal pipeline result')
      }
      expect(
        Schema.decodeUnknownSync(ResearchGraphState)(execution.finalOutput),
      ).toMatchObject({
        status: 'completed',
        steps: 3,
        toolCalls: 1,
        modelCalls: 2,
      })
      expect(execution.executedNodes).toEqual([
        ids.retrieve,
        ids.critique,
        ids.synthesize,
      ])
    } finally {
      await fred.shutdown()
    }
  })

  it('rejects an incompatible fallback before compiling the graph', async () => {
    const incompatible: ResearchModelRoutingPolicy = {
      ...routing,
      critique: {
        ...routing.critique,
        fallback: {
          platform: 'mock',
          model: 'wrong-contract',
          maxSteps: 1,
          outputContract: 'research-answer.v1',
        },
      },
    }
    const compilation = await Effect.runPromise(Effect.either(
      compileResearchRunWorkflow(
      plan,
      incompatible,
      policy,
      dependencies(succeedingTools, succeedingModels),
      ),
    ))
    expect(Either.isLeft(compilation)).toBe(true)
    if (Either.isRight(compilation)) throw new Error('Expected route rejection')
    expect(compilation.left).toMatchObject({
      _tag: 'IncompatibleModelRoute',
      role: 'critique',
    })
  })

  it('does not resolve a provider when the pre-action budget gate stops', async () => {
    let resolutions = 0
    const graph = await workflow(dependencies(
      {
        resolve: () => {
          resolutions += 1
          return Effect.succeed({ execute: () => Effect.succeed(result) })
        },
      },
      succeedingModels,
    ))
    await expect(functionNode(graph, ids.retrieve).fn(context({
      ...initialState(),
      toolCalls: plan.budget.maximumToolCalls,
    }))).rejects.toMatchObject({
      _tag: 'ResearchExecutionStopped',
      reason: { kind: 'tool-budget' },
    })
    expect(resolutions).toBe(0)
  })

  it('maps provider failures to stable typed stops without provider text', async () => {
    const secret = 'api-key=super-secret request=confidential'
    const graph = await workflow(dependencies(
      {
        resolve: () => Effect.fail(new ResearchProviderFailure({
          message: secret,
        })),
      },
      succeedingModels,
    ))
    let failure: unknown
    try {
      await functionNode(graph, ids.retrieve).fn(context(initialState()))
    } catch (error) {
      failure = error
    }
    expect(failure).toMatchObject({
      _tag: 'ResearchExecutionStopped',
      reason: {
        kind: 'provider-failure',
        role: null,
        message: 'Tool provider failed',
      },
    })
    expect(JSON.stringify(failure)).not.toContain(secret)
  })

  it('checks interruption before resolution and does not commit a mid-action result', async () => {
    const preController = new AbortController()
    preController.abort()
    let resolutions = 0
    const preGraph = await workflow(dependencies(
      {
        resolve: () => {
          resolutions += 1
          return Effect.succeed({ execute: () => Effect.succeed(result) })
        },
      },
      succeedingModels,
    ), preController.signal)
    await expect(
      functionNode(preGraph, ids.retrieve).fn(context(initialState())),
    ).rejects.toMatchObject({
      reason: { kind: 'interrupted' },
    })
    expect(resolutions).toBe(0)

    const midController = new AbortController()
    const midGraph = await workflow(dependencies(
      {
        resolve: () => Effect.succeed({
          execute: () => Effect.sync(() => {
            midController.abort()
            return result
          }),
        }),
      },
      succeedingModels,
    ), midController.signal)
    const starting = initialState()
    await expect(
      functionNode(midGraph, ids.retrieve).fn(context(starting)),
    ).rejects.toMatchObject({
      reason: { kind: 'interrupted' },
    })
    expect(starting.steps).toBe(0)
    expect(starting.completedNodeIds).toEqual([])
  })

  it('normalizes asynchronous Effect interruption and cancels without committing', async () => {
    const controller = new AbortController()
    let markStarted: () => void = () => undefined
    const started = new Promise<void>((resolve) => {
      markStarted = resolve
    })
    let cancelled = false
    const graph = await workflow(dependencies(
      {
        resolve: () => Effect.succeed({
          execute: () => Effect.async<ResearchActionResult, ResearchProviderFailure>(
            () => {
              markStarted()
              return Effect.sync(() => {
                cancelled = true
              })
            },
          ),
        }),
      },
      succeedingModels,
    ), controller.signal)
    const starting = initialState()
    const running = functionNode(graph, ids.retrieve).fn(context(starting))
    await started
    controller.abort()

    await expect(running).rejects.toMatchObject({
      _tag: 'ResearchExecutionStopped',
      reason: { kind: 'interrupted' },
    })
    expect(cancelled).toBe(true)
    expect(starting.steps).toBe(0)
    expect(starting.completedNodeIds).toEqual([])
  })
})
