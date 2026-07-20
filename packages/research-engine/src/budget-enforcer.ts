// eslint-disable-next-line no-unused-vars -- Type-only imports are consumed by TypeScript.
import type { ResearchBudget, ResearchPlan } from '@struct/domain'
import { Effect } from 'effect'
import {
  // eslint-disable-next-line no-unused-vars -- Type-only imports are consumed by TypeScript.
  type ResearchAction,
  // eslint-disable-next-line no-unused-vars -- Type-only imports are consumed by TypeScript.
  type ResearchActionResult,
  // eslint-disable-next-line no-unused-vars -- Type-only imports are consumed by TypeScript.
  type ResearchExecutionPolicy,
  ResearchExecutionStopped,
  // eslint-disable-next-line no-unused-vars -- Type-only imports are consumed by TypeScript.
  type ResearchGraphState,
  // eslint-disable-next-line no-unused-vars -- Type-only imports are consumed by TypeScript.
  type ResearchStopReason,
} from './execution-policy.js'

function stop(
  reason: ResearchStopReason,
): ResearchExecutionStopped {
  return new ResearchExecutionStopped({
    reason,
    message: `Research execution stopped: ${reason.kind}`,
  })
}

function attemptedUsage(action: ResearchAction, state: ResearchGraphState) {
  return {
    steps: state.steps + 1,
    modelCalls: state.modelCalls + (action.kind === 'model' ? 1 : 0),
    toolCalls: state.toolCalls + (action.kind === 'tool' ? 1 : 0),
    estimatedCostMicros:
      state.estimatedCostMicros + action.estimatedCostMicros,
  }
}

function budgetReason(
  budget: ResearchBudget,
  state: ResearchGraphState,
  action: ResearchAction,
  nowMilliseconds: number,
): ResearchStopReason | undefined {
  const attempted = attemptedUsage(action, state)
  const elapsed = Math.max(0, nowMilliseconds - state.startedAtMilliseconds)
  if (attempted.steps > budget.maximumSteps) {
    return {
      kind: 'step-budget',
      limit: budget.maximumSteps,
      attempted: attempted.steps,
    }
  }
  if (attempted.modelCalls > budget.maximumModelCalls) {
    return {
      kind: 'model-budget',
      limit: budget.maximumModelCalls,
      attempted: attempted.modelCalls,
    }
  }
  if (attempted.toolCalls > budget.maximumToolCalls) {
    return {
      kind: 'tool-budget',
      limit: budget.maximumToolCalls,
      attempted: attempted.toolCalls,
    }
  }
  if (
    attempted.estimatedCostMicros > budget.maximumEstimatedCostMicros
  ) {
    return {
      kind: 'cost-budget',
      limit: budget.maximumEstimatedCostMicros,
      attempted: attempted.estimatedCostMicros,
    }
  }
  if (elapsed > budget.maximumElapsedMilliseconds) {
    return {
      kind: 'time-budget',
      limit: budget.maximumElapsedMilliseconds,
      attempted: elapsed,
    }
  }
  if (state.activeConcurrency + 1 > budget.maximumFanOut) {
    return {
      kind: 'concurrency-budget',
      limit: budget.maximumFanOut,
      attempted: state.activeConcurrency + 1,
    }
  }
  return undefined
}

function declarationReason(
  plan: ResearchPlan,
  state: ResearchGraphState,
  action: ResearchAction,
): ResearchStopReason | undefined {
  if (action.kind !== 'tool') return undefined
  const toolGrants = plan.toolPolicy.grants.filter(
    (grant) => grant.toolId === action.toolId,
  )
  if (toolGrants.length === 0) {
    return { kind: 'undeclared-tool', toolId: action.toolId }
  }
  if (
    !toolGrants.some((grant) => grant.capability === action.capability)
  ) {
    return {
      kind: 'undeclared-capability',
      toolId: action.toolId,
      capability: action.capability,
    }
  }
  const grant = toolGrants.find(
    (candidate) => candidate.capability === action.capability,
  )
  const callsForGrant = state.toolGrantUsage.find(
    (usage) =>
      usage.toolId === action.toolId
      && usage.capability === action.capability,
  )?.count ?? 0
  if (grant !== undefined && callsForGrant + 1 > grant.maximumCalls) {
    return {
      kind: 'tool-budget',
      limit: grant.maximumCalls,
      attempted: callsForGrant + 1,
    }
  }
  return undefined
}

export const beginResearchAction = Effect.fn('ResearchExecution.beginAction')(
  function* (
    plan: ResearchPlan,
    policy: ResearchExecutionPolicy,
    state: ResearchGraphState,
    action: ResearchAction,
    nowMilliseconds: number,
  ) {
    const declared = declarationReason(plan, state, action)
    if (declared !== undefined) return yield* stop(declared)
    const overBudget = budgetReason(
      plan.budget,
      state,
      action,
      nowMilliseconds,
    )
    if (overBudget !== undefined) return yield* stop(overBudget)
    const duplicateCount = state.actionFingerprints.filter(
      (fingerprint) => fingerprint === action.fingerprint,
    ).length
    if (duplicateCount >= policy.maximumDuplicateActions) {
      return yield* stop({
        kind: 'duplicate-action',
        fingerprint: action.fingerprint,
        limit: policy.maximumDuplicateActions,
      })
    }
    if (state.noProgressCount >= policy.maximumNoProgressActions) {
      return yield* stop({
        kind: 'no-progress',
        fingerprint: state.lastProgressFingerprint,
        limit: policy.maximumNoProgressActions,
      })
    }
    return {
      ...state,
      status: 'running' as const,
      elapsedMilliseconds: Math.max(
        0,
        nowMilliseconds - state.startedAtMilliseconds,
      ),
      activeConcurrency: state.activeConcurrency + 1,
    }
  },
)

export const completeResearchAction = Effect.fn(
  'ResearchExecution.completeAction',
)((
  plan: ResearchPlan,
  state: ResearchGraphState,
  action: ResearchAction,
  result: ResearchActionResult,
  nowMilliseconds: number,
) => {
  const elapsedMilliseconds = Math.max(
    0,
    nowMilliseconds - state.startedAtMilliseconds,
  )
  if (elapsedMilliseconds > plan.budget.maximumElapsedMilliseconds) {
    return Effect.fail(stop({
      kind: 'time-budget',
      limit: plan.budget.maximumElapsedMilliseconds,
      attempted: elapsedMilliseconds,
    }))
  }
  const usage = attemptedUsage(action, state)
  const madeProgress =
    state.lastProgressFingerprint !== result.progressFingerprint
  const toolGrantUsage = action.kind === 'tool'
    ? (() => {
      const existing = state.toolGrantUsage.find(
        (usage) =>
          usage.toolId === action.toolId
          && usage.capability === action.capability,
      )
      return existing === undefined
        ? [...state.toolGrantUsage, {
          toolId: action.toolId,
          capability: action.capability,
          count: 1,
        }]
        : state.toolGrantUsage.map((usage) =>
          usage === existing
            ? { ...usage, count: usage.count + 1 }
            : usage
        )
    })()
    : state.toolGrantUsage
  return Effect.succeed({
    ...state,
    status: 'ready' as const,
    elapsedMilliseconds,
    ...usage,
    activeConcurrency: Math.max(0, state.activeConcurrency - 1),
    duplicateActionCount: state.actionFingerprints.filter(
      (fingerprint) => fingerprint === action.fingerprint,
    ).length,
    noProgressCount: madeProgress ? 0 : state.noProgressCount + 1,
    lastProgressFingerprint: result.progressFingerprint,
    actionFingerprints: [...state.actionFingerprints, action.fingerprint],
    toolGrantUsage,
    completedNodeIds: [...state.completedNodeIds, action.nodeId],
    artifacts: [...state.artifacts, ...result.artifacts],
  })
})
