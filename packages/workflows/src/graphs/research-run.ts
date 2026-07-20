import type * as Fred from '@fancyrobot/fred'
import {
  // eslint-disable-next-line no-unused-vars -- Type-only imports are consumed by TypeScript.
  type ResearchPlan,
  type ResearchPlanNode,
  // eslint-disable-next-line no-unused-vars -- Type-only imports are consumed by TypeScript.
  type ResearchToolCapability,
  // eslint-disable-next-line no-unused-vars -- Type-only imports are consumed by TypeScript.
  type ResearchToolId,
} from '@struct/domain'
import {
  beginResearchAction,
  completeResearchAction,
  // eslint-disable-next-line no-unused-vars -- Type-only imports are consumed by TypeScript.
  type ResearchAction,
  type ResearchActionResult,
  // eslint-disable-next-line no-unused-vars -- Type-only imports are consumed by TypeScript.
  type ResearchExecutionPolicy,
  ResearchExecutionStopped,
  ResearchGraphState,
  // eslint-disable-next-line no-unused-vars -- Type-only imports are consumed by TypeScript.
  type ResearchModelRole,
  ResearchProviderFailure,
} from '@struct/research-engine'
import { Cause, Effect, Exit, Option, Schema } from 'effect'
import {
  type IncompatibleModelRoute,
  // eslint-disable-next-line no-unused-vars -- Type-only imports are consumed by TypeScript.
  type ResearchModelRoutingPolicy,
  // eslint-disable-next-line no-unused-vars -- Type-only imports are consumed by TypeScript.
  type ResolvedModelRoute,
  resolveModelRoute,
} from '../model-routing.js'

export const RESEARCH_RUN_WORKFLOW_ID = 'struct.research-run'

export interface ResearchToolExecutor {
  readonly execute: (
    node: ResearchPlanNode,
    signal: AbortSignal,
  ) => Effect.Effect<
    ResearchActionResult,
    ResearchProviderFailure,
    never
  >
}

export interface ResearchToolResolver {
  readonly resolve: (
    toolId: ResearchToolId,
    capability: ResearchToolCapability,
  ) => Effect.Effect<
    ResearchToolExecutor,
    ResearchProviderFailure,
    never
  >
}

export interface ResearchModelExecutor {
  readonly execute: (
    node: ResearchPlanNode,
    signal: AbortSignal,
  ) => Effect.Effect<
    ResearchActionResult,
    ResearchProviderFailure,
    never
  >
}

export interface ResearchModelResolver {
  readonly resolve: (
    route: ResolvedModelRoute,
  ) => Effect.Effect<
    ResearchModelExecutor,
    ResearchProviderFailure,
    never
  >
}

export interface ResearchRunGraphDependencies {
  readonly tools: ResearchToolResolver
  readonly models: ResearchModelResolver
  readonly now: () => number
  readonly estimatedCostMicros: (node: ResearchPlanNode) => number
}

const toolByNodeKind: Readonly<
  Partial<Record<
    ResearchPlanNode['kind'],
    {
      readonly toolId: ResearchToolId
      readonly capability: ResearchToolCapability
    }
  >>
> = {
  'document-retrieval': {
    toolId: 'hybrid-retrieval',
    capability: 'document:retrieve',
  },
  'dataset-query': {
    toolId: 'dataset-query',
    capability: 'dataset:query',
  },
  'citation-validation': {
    toolId: 'citation-validation',
    capability: 'citation:validate',
  },
}

const roleByNodeKind: Readonly<
  Partial<Record<ResearchPlanNode['kind'], ResearchModelRole>>
> = {
  'evidence-evaluation': 'critique',
  'answer-synthesis': 'synthesis',
}

function interrupted(): ResearchExecutionStopped {
  return new ResearchExecutionStopped({
    reason: {
      kind: 'interrupted',
      message: 'Research execution was interrupted',
    },
    message: 'Research execution was interrupted',
  })
}

function providerStopped(
  role: ResearchModelRole | null,
): ResearchExecutionStopped {
  const providerKind = role === null ? 'Tool' : `${role} model`
  return new ResearchExecutionStopped({
    reason: {
      kind: 'provider-failure',
      role,
      message: `${providerKind} provider failed`,
    },
    message: 'Research execution provider failed',
  })
}

function timeBudgetStopped(
  limit: number,
  attempted: number,
): ResearchExecutionStopped {
  return new ResearchExecutionStopped({
    reason: {
      kind: 'time-budget',
      limit,
      attempted,
    },
    message: 'Research execution stopped: time-budget',
  })
}

function actionForNode(
  node: ResearchPlanNode,
  estimatedCostMicros: number,
): ResearchAction {
  const tool = toolByNodeKind[node.kind]
  if (tool !== undefined) {
    return {
      kind: 'tool',
      nodeId: node.id,
      ...tool,
      fingerprint: `${node.id}:${tool.toolId}:${tool.capability}`,
      estimatedCostMicros,
    }
  }
  const role = roleByNodeKind[node.kind]
  if (role === undefined) {
    throw new Error(`Unsupported research plan node kind: ${node.kind}`)
  }
  return {
    kind: 'model',
    nodeId: node.id,
    role,
    fingerprint: `${node.id}:${role}`,
    estimatedCostMicros,
  }
}

function topologicalNodes(plan: ResearchPlan): ReadonlyArray<ResearchPlanNode> {
  const pending = new Map(plan.nodes.map((node) => [node.id, node]))
  const completed = new Set<ResearchPlanNode['id']>()
  const ordered: ResearchPlanNode[] = []
  while (pending.size > 0) {
    const ready = [...pending.values()]
      .filter((node) =>
        node.dependencies.every((dependency) => completed.has(dependency))
      )
      .sort((left, right) => left.id.localeCompare(right.id))
    if (ready.length === 0) {
      throw new Error('Validated research plan has no executable node')
    }
    for (const node of ready) {
      ordered.push(node)
      completed.add(node.id)
      pending.delete(node.id)
    }
  }
  return ordered
}

function executionEffect(
  plan: ResearchPlan,
  routing: ResearchModelRoutingPolicy,
  policy: ResearchExecutionPolicy,
  deps: ResearchRunGraphDependencies,
  node: ResearchPlanNode,
  state: typeof ResearchGraphState.Type,
  signal: AbortSignal,
) {
  return Effect.gen(function* () {
    if (signal.aborted) return yield* interrupted()
    const action = actionForNode(node, deps.estimatedCostMicros(node))
    const begun = yield* beginResearchAction(
      plan,
      policy,
      state,
      action,
      deps.now(),
    )
    const elapsedBeforeProvider = Math.max(
      0,
      deps.now() - begun.startedAtMilliseconds,
    )
    const remainingMilliseconds =
      plan.budget.maximumElapsedMilliseconds - elapsedBeforeProvider
    if (remainingMilliseconds <= 0) {
      return yield* timeBudgetStopped(
        plan.budget.maximumElapsedMilliseconds,
        elapsedBeforeProvider,
      )
    }
    const providerEffect = action.kind === 'tool'
      ? Effect.gen(function* () {
        const executor = yield* deps.tools.resolve(
          action.toolId,
          action.capability,
        )
        return yield* executor.execute(node, signal)
      }).pipe(
        Effect.catchTag(
          'ResearchProviderFailure',
          () => providerStopped(null),
        ),
      )
      : Effect.gen(function* () {
        const route = yield* resolveModelRoute(routing, action.role)
        const executor = yield* deps.models.resolve(route)
        return yield* executor.execute(node, signal)
      }).pipe(
        Effect.catchTag(
          'ResearchProviderFailure',
          () => providerStopped(action.role),
        ),
      )
    const result = yield* providerEffect.pipe(
      Effect.timeoutFail({
        duration: remainingMilliseconds,
        onTimeout: () => timeBudgetStopped(
          plan.budget.maximumElapsedMilliseconds,
          plan.budget.maximumElapsedMilliseconds + 1,
        ),
      }),
    )
    if (signal.aborted) return yield* interrupted()
    const completed = yield* completeResearchAction(
      plan,
      begun,
      action,
      result,
      deps.now(),
    )
    return completed.completedNodeIds.length === plan.nodes.length
      ? { ...completed, status: 'completed' as const }
      : completed
  })
}

export const compileResearchRunWorkflow = Effect.fn(
  'ResearchRunGraph.compile',
)(function* (
  plan: ResearchPlan,
  routing: ResearchModelRoutingPolicy,
  policy: ResearchExecutionPolicy,
  deps: ResearchRunGraphDependencies,
  signal: AbortSignal = new AbortController().signal,
) {
  yield* Effect.forEach(
    ['classification', 'planning', 'critique', 'synthesis'] as const,
    (role) => resolveModelRoute(routing, role),
    { discard: true },
  )
  const orderedNodes = topologicalNodes(plan)
  const nodes: Fred.WorkflowIR['nodes'] = orderedNodes.map((node) => ({
    id: node.id,
    kind: 'function',
    fn: async (context) => {
      const state = Schema.decodeUnknownSync(ResearchGraphState)(context.input)
      const outcome = await Effect.runPromiseExit(
        executionEffect(plan, routing, policy, deps, node, state, signal),
        { signal },
      )
      if (Exit.isSuccess(outcome)) return outcome.value
      if (signal.aborted || Cause.isInterrupted(outcome.cause)) {
        throw interrupted()
      }
      const failure = Option.getOrUndefined(
        Cause.failureOption(outcome.cause),
      )
      if (failure !== undefined) throw failure
      throw Cause.squash(outcome.cause)
    },
  }))
  const edges: Fred.WorkflowIR['edges'] = orderedNodes.slice(1).map(
    (node, index) => ({
      from: orderedNodes[index]!.id,
      to: node.id,
    }),
  )
  return {
    id: RESEARCH_RUN_WORKFLOW_ID,
    source: 'native',
    entry: orderedNodes[0]!.id,
    input: ResearchGraphState,
    output: ResearchGraphState,
    nodes,
    edges,
  } satisfies Fred.WorkflowIR
})

export type ResearchRunCompilationFailure = IncompatibleModelRoute
