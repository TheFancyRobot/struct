import {
  JobClaimError,
  NotFoundError,
  type RecursivePartitionPlan,
  type RecursiveSchedulerState,
} from '@struct/domain'
import { CorpusPartitioning } from '@struct/research-engine'
import { prepareRecursiveAnalysis } from '@struct/workflows'
import { Effect, Option } from 'effect'
/* eslint-disable no-unused-vars -- Type-only import is consumed by TypeScript. */
import type {
  RecursiveProgressPublisher as typeRecursiveProgressPublisher,
} from './recursive-progress.js'
/* eslint-enable no-unused-vars */

export type PartitionAnalysisJournalEvent =
  | {
      readonly type: 'partition-analysis-enqueued'
      readonly planId: string
    }
  | {
      readonly type: 'partition-analysis-resumed'
      readonly planId: string
    }
  | {
      readonly type: 'partition-analysis-claimed'
      readonly planId: string
      readonly partitionIds: ReadonlyArray<string>
    }

export interface DurablePartitionAnalysis {
  readonly plan: RecursivePartitionPlan
  readonly scheduler: RecursiveSchedulerState
  readonly recoveryCount: number
}

export interface PartitionAnalysisJournal {
  readonly load: (
    planId: string,
  ) => Effect.Effect<
    Option.Option<DurablePartitionAnalysis>,
    JobClaimError
  >
  /**
   * Atomically creates the candidate and its event or returns the already
   * durable value when another worker won the same stable identity.
   */
  readonly createOrLoad: (
    candidate: DurablePartitionAnalysis,
    event: PartitionAnalysisJournalEvent,
  ) => Effect.Effect<DurablePartitionAnalysis, JobClaimError>
  /**
   * Atomically persists `next` and its event only when the durable value still
   * equals `expected`. Implementations must perform one transactional
   * compare-and-swap; returning false means another worker won the race.
   */
  readonly compareAndSwap: (
    expected: DurablePartitionAnalysis,
    next: DurablePartitionAnalysis,
    event: PartitionAnalysisJournalEvent,
  ) => Effect.Effect<boolean, JobClaimError>
}

function missing(planId: string): NotFoundError {
  return new NotFoundError({
    entityType: 'recursive-partition-plan',
    entityId: planId,
    message: 'Recursive partition analysis was not found',
  })
}

export const makePartitionAnalysisJob = (
  journal: PartitionAnalysisJournal,
) => {
  const enqueue = Effect.fn('PartitionAnalysisJob.enqueue')(function* (
    manifest: import('@struct/domain').RecursiveCorpusManifest,
    request: import('@struct/domain').RecursiveAnalysisRequest,
  ) {
    const prepared = yield* prepareRecursiveAnalysis(manifest, request)
    const candidate = { ...prepared, recoveryCount: 0 }
    const durable = yield* journal.createOrLoad(candidate, {
      type: 'partition-analysis-enqueued',
      planId: prepared.plan.id,
    })
    yield* CorpusPartitioning.validate(durable.plan, durable.scheduler)
    if (
      durable.plan.manifestDigest !== prepared.plan.manifestDigest
      || durable.plan.request.id !== prepared.plan.request.id
    ) {
      return yield* new JobClaimError({
        operation: 'partition-analysis-enqueue',
        reason: 'idempotency-conflict',
        message: 'Existing partition analysis does not match the stable plan identity',
      })
    }
    return durable
  })

  const monitor = Effect.fn('PartitionAnalysisJob.monitor')(function* (
    planId: string,
  ) {
    const durable = yield* journal.load(planId)
    if (Option.isNone(durable)) return yield* missing(planId)
    yield* CorpusPartitioning.validate(
      durable.value.plan,
      durable.value.scheduler,
    )
    return durable.value
  })

  const resume = Effect.fn('PartitionAnalysisJob.resume')(function* (
    planId: string,
  ) {
    const durable = yield* monitor(planId)
    const scheduler = yield* CorpusPartitioning.resume(
      durable.plan,
      durable.scheduler,
    )
    const resumed = {
      plan: durable.plan,
      scheduler,
      recoveryCount: durable.recoveryCount + 1,
    }
    const saved = yield* journal.compareAndSwap(durable, resumed, {
      type: 'partition-analysis-resumed',
      planId,
    })
    if (!saved) {
      return yield* new JobClaimError({
        operation: 'partition-analysis-resume',
        reason: 'stale-scheduler-state',
        message: 'Partition analysis changed before resume could commit',
      })
    }
    return resumed
  })

  const claim = Effect.fn('PartitionAnalysisJob.claim')(function* (
    planId: string,
    elapsedMilliseconds: number,
  ) {
    const durable = yield* monitor(planId)
    const claimed = yield* CorpusPartitioning.claim(
      durable.plan,
      durable.scheduler,
      elapsedMilliseconds,
    )
    const next = {
      plan: durable.plan,
      scheduler: claimed.state,
      recoveryCount: durable.recoveryCount,
    }
    const saved = yield* journal.compareAndSwap(durable, next, {
      type: 'partition-analysis-claimed',
      planId,
      partitionIds: claimed.claims.map((item) => item.partition.id),
    })
    if (!saved) {
      return yield* new JobClaimError({
        operation: 'partition-analysis-claim',
        reason: 'stale-scheduler-state',
        message: 'Partition analysis changed before claims could commit',
      })
    }
    return { ...next, claims: claimed.claims }
  })

  return { enqueue, monitor, resume, claim } as const
}

function publishedRunStatus(
  status: RecursiveSchedulerState['status'],
): 'queued' | 'running' | 'partial' | 'completed' | 'failed' | 'cancelled' {
  return status === 'paused' ? 'running' : status
}

export const makeObservablePartitionAnalysisJob = (
  journal: PartitionAnalysisJournal,
  publisher: typeRecursiveProgressPublisher,
  now: () => number,
) => {
  const base = makePartitionAnalysisJob(journal)
  const publish = (
    durable: DurablePartitionAnalysis,
  ) => publisher.runCommitted({
    requestId: durable.plan.request.id,
    planId: durable.plan.id,
    status: publishedRunStatus(durable.scheduler.status),
    cancellation: durable.scheduler.status === 'cancelled'
      ? 'acknowledged'
      : 'none',
    recoveryCount: durable.recoveryCount,
    expectedPartitions: durable.plan.partitions.length,
    committedPartitions: durable.scheduler.progress.filter(
      (item) => item.status === 'completed',
    ).length,
    failedPartitions: durable.scheduler.progress.filter(
      (item) => item.status === 'failed',
    ).length,
  })

  return {
    enqueue: Effect.fn('ObservablePartitionAnalysisJob.enqueue')(
      function* (
        manifest: import('@struct/domain').RecursiveCorpusManifest,
        request: import('@struct/domain').RecursiveAnalysisRequest,
      ) {
        const durable = yield* base.enqueue(manifest, request)
        yield* publish(durable)
        return durable
      },
    ),
    resume: Effect.fn('ObservablePartitionAnalysisJob.resume')(
      function* (planId: string) {
        const durable = yield* base.resume(planId)
        yield* publish(durable)
        return durable
      },
    ),
    claim: Effect.fn('ObservablePartitionAnalysisJob.claim')(
      function* (planId: string, elapsedMilliseconds: number) {
        const claimed = yield* base.claim(planId, elapsedMilliseconds)
        yield* publish(claimed)
        const committedAt = now()
        yield* Effect.forEach(claimed.claims, (claim) =>
          publisher.partitionCommitted({
            requestId: claimed.plan.request.id,
            planId: claimed.plan.id,
            partition: {
              id: claim.partition.id,
              nodeId: claim.partition.nodeId,
              ordinal: claim.partition.ordinal,
              status: 'running',
              attempt: claim.lease.attempt,
              batches: [],
              failureTag: null,
              startedAt: committedAt,
              updatedAt: committedAt,
            },
          }), { discard: true })
        return claimed
      },
    ),
    monitor: base.monitor,
  } as const
}
