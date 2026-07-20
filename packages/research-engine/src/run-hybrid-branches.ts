/* eslint-disable no-unused-vars -- Babel's parser does not mark type-only imports as used. */
import type {
  ResearchPlan,
  ResearchPlanNode,
  ResearchPlanNodeId,
} from '@struct/domain'
/* eslint-enable no-unused-vars */
import { Effect, Exit, Fiber, Queue, Schema } from 'effect'

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
    const running = new Map<
      ResearchPlanNodeId,
      Fiber.RuntimeFiber<void, E>
    >()
    const completions = yield* Queue.unbounded<{
      readonly exit: Exit.Exit<void, E>
      readonly nodeId: ResearchPlanNodeId
    }>()

    while (pending.size > 0 || running.size > 0) {
      while (running.size < plan.budget.maximumFanOut) {
        const next = [...pending.values()]
          .filter((node) =>
            node.dependencies.every((dependency) => completed.has(dependency))
          )
          .sort((left, right) => left.id.localeCompare(right.id))[0]
        if (next === undefined) break

        pending.delete(next.id)
        const fiber = yield* execute(next).pipe(
          Effect.interruptible,
          Effect.onExit((exit) =>
            Queue.offer(completions, { exit, nodeId: next.id })
          ),
          Effect.fork,
        )
        running.set(next.id, fiber)
      }

      if (running.size === 0) {
        return yield* new HybridBranchSchedulingFailure({
          message: 'Research plan has no dependency-ready node',
        })
      }

      const settled = yield* Queue.take(completions)
      running.delete(settled.nodeId)
      if (Exit.isFailure(settled.exit)) {
        yield* Fiber.interruptAll([...running.values()])
        return yield* Effect.failCause(settled.exit.cause)
      }
      completed.add(settled.nodeId)
    }

    return [...completed].sort()
  },
)
