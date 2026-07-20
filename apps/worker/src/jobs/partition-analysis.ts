import {
  JobClaimError,
  NotFoundError,
  type RecursivePartitionPlan,
  type RecursiveSchedulerState,
} from '@struct/domain'
import { CorpusPartitioning } from '@struct/research-engine'
import { prepareRecursiveAnalysis } from '@struct/workflows'
import { Effect, Option } from 'effect'

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
}

export interface PartitionAnalysisJournal {
  readonly load: (
    planId: string,
  ) => Effect.Effect<
    Option.Option<DurablePartitionAnalysis>,
    JobClaimError
  >
  readonly create: (
    value: DurablePartitionAnalysis,
    event: PartitionAnalysisJournalEvent,
  ) => Effect.Effect<void, JobClaimError>
  readonly save: (
    value: DurablePartitionAnalysis,
    event: PartitionAnalysisJournalEvent,
  ) => Effect.Effect<void, JobClaimError>
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
    const durable = yield* journal.load(prepared.plan.id)
    if (Option.isSome(durable)) {
      yield* CorpusPartitioning.validate(
        durable.value.plan,
        durable.value.scheduler,
      )
      if (
        durable.value.plan.manifestDigest !== prepared.plan.manifestDigest
        || durable.value.plan.request.id !== prepared.plan.request.id
      ) {
        return yield* new JobClaimError({
          operation: 'partition-analysis-enqueue',
          reason: 'idempotency-conflict',
          message: 'Existing partition analysis does not match the stable plan identity',
        })
      }
      return durable.value
    }
    yield* journal.create(prepared, {
      type: 'partition-analysis-enqueued',
      planId: prepared.plan.id,
    })
    return prepared
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
    const resumed = { plan: durable.plan, scheduler }
    yield* journal.save(resumed, {
      type: 'partition-analysis-resumed',
      planId,
    })
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
    const next = { plan: durable.plan, scheduler: claimed.state }
    yield* journal.save(next, {
      type: 'partition-analysis-claimed',
      planId,
      partitionIds: claimed.claims.map((item) => item.partition.id),
    })
    return { ...next, claims: claimed.claims }
  })

  return { enqueue, monitor, resume, claim } as const
}
