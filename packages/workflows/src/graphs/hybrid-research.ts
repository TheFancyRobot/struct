/* eslint-disable no-unused-vars -- Babel's parser does not mark type-only imports as used. */
import type * as Fred from '@fancyrobot/fred'
import type { ResearchPlan, ResearchPlanNode } from '@struct/domain'
import {
  beginResearchAction,
  completeResearchAction,
  type ResearchAction,
  type ResearchExecutionPolicy,
  ResearchExecutionStopped,
  ResearchGraphState,
  runHybridBranches,
} from '@struct/research-engine'
import { Cause, Effect, Exit, Option, Ref, Schema } from 'effect'
import {
  type ResearchModelRoutingPolicy,
  resolveModelRoute,
} from '../model-routing.js'
import {
  executeResearchNodeProvider,
  researchActionForNode,
  type ResearchRunGraphDependencies,
} from './research-run.js'
/* eslint-enable no-unused-vars */

export const HYBRID_RESEARCH_WORKFLOW_ID = 'struct.hybrid-research'
const HYBRID_RESEARCH_NODE_ID = 'struct.hybrid-research.run-branches'

const branchKinds = new Set<ResearchPlanNode['kind']>([
  'document-retrieval',
  'dataset-query',
  'recursive-analysis',
])

export function requiresHybridBranchExecution(plan: ResearchPlan): boolean {
  return new Set(
    plan.nodes
      .filter((node) => branchKinds.has(node.kind))
      .map((node) => node.kind),
  ).size > 1
}

function stopped(
  reason: typeof ResearchExecutionStopped.Type['reason'],
  message: string,
): ResearchExecutionStopped {
  return new ResearchExecutionStopped({ reason, message })
}

function canonicalState(
  state: typeof ResearchGraphState.Type,
  progressByNode?: ReadonlyMap<ResearchPlanNode['id'], string>,
): typeof ResearchGraphState.Type {
  const completedNodeIds = [...new Set(state.completedNodeIds)].sort()
  const progress = completedNodeIds.flatMap((nodeId) => {
    const fingerprint = progressByNode?.get(nodeId)
    return fingerprint === undefined ? [] : [fingerprint]
  })
  const lastProgressFingerprint = progress.at(-1)
    ?? state.lastProgressFingerprint
  let noProgressCount = 0
  if (progress.length > 1) {
    for (let index = progress.length - 2; index >= 0; index -= 1) {
      if (progress[index] !== lastProgressFingerprint) break
      noProgressCount += 1
    }
  }
  const artifacts = new Map(
    state.artifacts.map((artifact) => [
      `${artifact.digest}\u0000${artifact.mediaType}\u0000${artifact.byteLength}`,
      artifact,
    ]),
  )
  return {
    ...state,
    completedNodeIds,
    artifacts: [...artifacts.values()].sort((left, right) =>
      left.digest.localeCompare(right.digest)
      || left.mediaType.localeCompare(right.mediaType)
      || left.byteLength - right.byteLength
    ),
    actionFingerprints: [...state.actionFingerprints].sort(),
    toolGrantUsage: [...state.toolGrantUsage].sort((left, right) =>
      left.toolId.localeCompare(right.toolId)
      || left.capability.localeCompare(right.capability)
    ),
    lastProgressFingerprint,
    noProgressCount: progress.length === completedNodeIds.length
      ? noProgressCount
      : state.noProgressCount,
  }
}

function stateWithReservations(
  state: typeof ResearchGraphState.Type,
  reservations: ReadonlyArray<ResearchAction>,
): typeof ResearchGraphState.Type {
  const toolGrantUsage = [...state.toolGrantUsage]
  for (const action of reservations) {
    if (action.kind !== 'tool') continue
    const index = toolGrantUsage.findIndex((usage) =>
      usage.toolId === action.toolId
      && usage.capability === action.capability
    )
    if (index === -1) {
      toolGrantUsage.push({
        toolId: action.toolId,
        capability: action.capability,
        count: 1,
      })
    } else {
      const usage = toolGrantUsage[index]!
      toolGrantUsage[index] = { ...usage, count: usage.count + 1 }
    }
  }
  return {
    ...state,
    steps: state.steps + reservations.length,
    modelCalls: state.modelCalls
      + reservations.filter((action) => action.kind === 'model').length,
    toolCalls: state.toolCalls
      + reservations.filter((action) => action.kind === 'tool').length,
    estimatedCostMicros: state.estimatedCostMicros
      + reservations.reduce(
        (total, action) => total + action.estimatedCostMicros,
        0,
      ),
    actionFingerprints: [
      ...state.actionFingerprints,
      ...reservations.map((action) => action.fingerprint),
    ],
    toolGrantUsage,
  }
}

export const runHybridResearchGraph = Effect.fn(
  'HybridResearchGraph.run',
)(function* (
  plan: ResearchPlan,
  initialState: typeof ResearchGraphState.Type,
  routing: ResearchModelRoutingPolicy,
  policy: ResearchExecutionPolicy,
  deps: ResearchRunGraphDependencies,
  signal: AbortSignal,
) {
  for (const field of ['runId', 'planId', 'workspaceId', 'projectId'] as const) {
    const expected = field === 'planId' ? plan.id : plan[field]
    if (initialState[field] !== expected) {
      return yield* stopped(
        { kind: 'state-mismatch', field },
        `Research execution state does not match plan ${field}`,
      )
    }
  }
  const stateRef = yield* Ref.make(canonicalState(initialState))
  const reservationsRef = yield* Ref.make<ReadonlyArray<ResearchAction>>([])
  const progressByNode = yield* Ref.make(
    new Map<ResearchPlanNode['id'], string>(),
  )
  const stateMutex = yield* Effect.makeSemaphore(1)

  const execute = Effect.fn('HybridResearchGraph.executeNode')(
    function* (node: ResearchPlanNode) {
      const begun = yield* stateMutex.withPermits(1)(Effect.gen(function* () {
        if (signal.aborted) {
          return yield* stopped(
            { kind: 'interrupted', message: 'Research execution was interrupted' },
            'Research execution was interrupted',
          )
        }
        if (
          deps.isCancellationRequested !== undefined
          && (yield* deps.isCancellationRequested())
        ) {
          return yield* stopped(
            { kind: 'interrupted', message: 'Research execution was cancelled' },
            'Research execution was cancelled',
          )
        }
        const current = yield* Ref.get(stateRef)
        const action = researchActionForNode(
          node,
          deps.estimatedCostMicros(node),
        )
        const reservations = yield* Ref.get(reservationsRef)
        const checked = yield* beginResearchAction(
          plan,
          policy,
          stateWithReservations(current, reservations),
          action,
          deps.now(),
        )
        const next = {
          ...current,
          status: checked.status,
          elapsedMilliseconds: checked.elapsedMilliseconds,
          activeConcurrency: checked.activeConcurrency,
        }
        yield* Ref.set(stateRef, next)
        yield* Ref.set(reservationsRef, [...reservations, action])
        return { action, state: next }
      }))

      const elapsed = Math.max(
        0,
        deps.now() - begun.state.startedAtMilliseconds,
      )
      const remaining = plan.budget.maximumElapsedMilliseconds - elapsed
      if (remaining <= 0) {
        return yield* stopped(
          {
            kind: 'time-budget',
            limit: plan.budget.maximumElapsedMilliseconds,
            attempted: elapsed,
          },
          'Research execution stopped: time-budget',
        )
      }
      const result = yield* executeResearchNodeProvider(
        node,
        begun.action,
        routing,
        deps,
        signal,
      ).pipe(
        Effect.timeoutFail({
          duration: remaining,
          onTimeout: () => stopped(
            {
              kind: 'time-budget',
              limit: plan.budget.maximumElapsedMilliseconds,
              attempted: plan.budget.maximumElapsedMilliseconds + 1,
            },
            'Research execution stopped: time-budget',
          ),
        }),
      )

      yield* stateMutex.withPermits(1)(Effect.gen(function* () {
        const current = yield* Ref.get(stateRef)
        yield* Ref.update(reservationsRef, (reservations) =>
          reservations.filter(
            (action) => action.fingerprint !== begun.action.fingerprint,
          )
        )
        yield* Ref.update(progressByNode, (value) =>
          new Map(value).set(node.id, result.progressFingerprint)
        )
        const completed = yield* completeResearchAction(
          plan,
          current,
          begun.action,
          result,
          deps.now(),
        )
        const hasCompletedPlan = plan.nodes.every((candidate) =>
          completed.completedNodeIds.includes(candidate.id)
        )
        const progress = yield* Ref.get(progressByNode)
        const canonical = canonicalState({
          ...completed,
          status: hasCompletedPlan ? 'completed' : 'ready',
        }, progress)
        yield* Ref.set(stateRef, canonical)
        if (deps.onStateCommitted !== undefined) {
          yield* deps.onStateCommitted(canonical)
        }
      }))
    },
  )

  yield* runHybridBranches(
    plan,
    { completedNodeIds: initialState.completedNodeIds },
    execute,
  )
  return yield* Ref.get(stateRef)
})

export const compileHybridResearchWorkflow = Effect.fn(
  'HybridResearchGraph.compile',
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
  const node: Fred.WorkflowIR['nodes'][number] = {
    id: HYBRID_RESEARCH_NODE_ID,
    kind: 'function',
    fn: async (context) => {
      const state = Schema.decodeUnknownSync(ResearchGraphState)(context.input)
      const outcome = await Effect.runPromiseExit(
        runHybridResearchGraph(
          plan,
          state,
          routing,
          policy,
          deps,
          signal,
        ),
        { signal },
      )
      if (Exit.isSuccess(outcome)) return outcome.value
      if (signal.aborted || Cause.isInterrupted(outcome.cause)) {
        throw stopped(
          { kind: 'interrupted', message: 'Research execution was interrupted' },
          'Research execution was interrupted',
        )
      }
      const failure = Option.getOrUndefined(Cause.failureOption(outcome.cause))
      if (failure !== undefined) throw failure
      throw Cause.squash(outcome.cause)
    },
  }
  const workflow: Fred.WorkflowIR = {
    id: HYBRID_RESEARCH_WORKFLOW_ID,
    source: 'native',
    entry: HYBRID_RESEARCH_NODE_ID,
    input: ResearchGraphState,
    output: ResearchGraphState,
    nodes: [node],
    edges: [],
  }
  return workflow
})
