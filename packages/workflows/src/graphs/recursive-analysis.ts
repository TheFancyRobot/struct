import type * as Domain from '@struct/domain'
import { CorpusPartitioning } from '@struct/research-engine'
import { Effect } from 'effect'

export interface PreparedRecursiveAnalysis {
  readonly plan: Domain.RecursivePartitionPlan
  readonly scheduler: Domain.RecursiveSchedulerState
}

/**
 * Deterministic graph preparation only. Fred/model execution begins in later
 * Phase 06 steps after bounded partitions have been claimed.
 */
export const prepareRecursiveAnalysis = Effect.fn(
  'RecursiveAnalysisGraph.prepare',
)(function* (
  manifest: Domain.RecursiveCorpusManifest,
  request: Domain.RecursiveAnalysisRequest,
) {
  const plan = yield* CorpusPartitioning.plan(manifest, request)
  const scheduler = yield* CorpusPartitioning.initialState(plan)
  return { plan, scheduler } satisfies PreparedRecursiveAnalysis
})
