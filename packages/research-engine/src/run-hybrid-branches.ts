/* eslint-disable no-unused-vars -- Babel's parser does not mark type-only imports as used. */
import type {
  ResearchPlan,
  ResearchPlanNode,
  ResearchPlanNodeId,
} from '@struct/domain'
/* eslint-enable no-unused-vars */
import { Effect, Schema } from 'effect'

export class HybridBranchSchedulingFailure extends Schema.TaggedError<HybridBranchSchedulingFailure>()(
  'HybridBranchSchedulingFailure',
  {
    message: Schema.String,
  },
) {}

export interface HybridBranchExecution {
  readonly completedNodeIds: ReadonlyArray<ResearchPlanNodeId>
}

/**
 * Coordinates the existing research-node executor. This owns readiness and
 * bounded concurrency only; action execution, durability, and replay remain
 * with the caller's production executor.
 */
export const runHybridBranches = Effect.fn('HybridResearch.runBranches')(
  function* <E, R>(
    plan: ResearchPlan,
    initial: HybridBranchExecution,
    execute: (
      node: ResearchPlanNode,
    ) => Effect.Effect<void, E, R>,
  ) {
    const planNodeIds = new Set(plan.nodes.map((node) => node.id))
    const unknownCompletedNode = initial.completedNodeIds.find(
      (nodeId) => !planNodeIds.has(nodeId),
    )
    if (unknownCompletedNode !== undefined) {
      return yield* new HybridBranchSchedulingFailure({
        message: 'Checkpoint contains a node outside the research plan',
      })
    }
    const completed = new Set(initial.completedNodeIds)
    const pending = new Map(
      plan.nodes
        .filter((node) => !completed.has(node.id))
        .map((node) => [node.id, node] as const),
    )

    while (pending.size > 0) {
      const ready = [...pending.values()]
        .filter((node) =>
          node.dependencies.every((dependency) => completed.has(dependency))
        )
        .sort((left, right) => left.id.localeCompare(right.id))
      if (ready.length === 0) {
        return yield* new HybridBranchSchedulingFailure({
          message: 'Research plan has no dependency-ready node',
        })
      }

      const completedWave = yield* Effect.forEach(
        ready,
        (node) => execute(node).pipe(
          Effect.interruptible,
          Effect.disconnect,
          Effect.as(node.id),
        ),
        { concurrency: plan.budget.maximumFanOut },
      )
      for (const nodeId of completedWave) {
        completed.add(nodeId)
        pending.delete(nodeId)
      }
    }

    return [...completed].sort()
  },
)
