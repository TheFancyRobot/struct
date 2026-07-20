import type * as Domain from '@struct/domain'
import { EventJournalId } from '@struct/domain'
import { Effect, Schema } from 'effect'
import type * as Persistence from '@struct/persistence'

type OwnedRunProgress = Omit<
  Schema.Schema.Type<typeof Domain.RecursiveRunProgressCommittedData>,
  'jobId' | 'attempt' | 'workspaceId'
>
type OwnedPartitionProgress = Omit<
  Schema.Schema.Type<typeof Domain.RecursivePartitionProgressCommittedData>,
  'jobId' | 'attempt' | 'workspaceId'
>
type OwnedResultProgress = Omit<
  Schema.Schema.Type<typeof Domain.RecursiveResultProgressCommittedData>,
  'jobId' | 'attempt' | 'workspaceId'
>

export interface RecursiveProgressPublisher {
  readonly runCommitted: (
    progress: OwnedRunProgress,
  ) => Effect.Effect<void, Persistence.PersistenceError>
  readonly partitionCommitted: (
    progress: OwnedPartitionProgress,
  ) => Effect.Effect<void, Persistence.PersistenceError>
  readonly resultCommitted: (
    progress: OwnedResultProgress,
  ) => Effect.Effect<void, Persistence.PersistenceError>
}

export interface RecursiveProgressPublisherDeps {
  readonly now: () => bigint
  readonly appendInProgressEvent: (
    job: typeof Domain.JobQueue.Type,
    event: typeof Domain.EventJournal.Type,
  ) => Effect.Effect<void, Persistence.PersistenceError>
}

export function makeRecursiveProgressPublisher(
  job: typeof Domain.JobQueue.Type,
  deps: RecursiveProgressPublisherDeps,
): RecursiveProgressPublisher {
  const stableValue = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(stableValue)
    if (value !== null && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value)
          .filter(([key]) => key !== 'updatedAt' && key !== 'startedAt')
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, child]) => [key, stableValue(child)]),
      )
    }
    return value
  }
  const eventId = (
    eventType: string,
    payload: Readonly<Record<string, unknown>>,
  ) => {
    const digest = new Bun.CryptoHasher('sha256')
      .update(JSON.stringify(stableValue({
        eventType,
        runId: job.entityId,
        jobId: job.id,
        attempt: job.attempts,
        payload,
      })))
      .digest('hex')
    return EventJournalId.make(
      `${digest.slice(0, 8)}-${digest.slice(8, 12)}-5${digest.slice(13, 16)}-a${digest.slice(17, 20)}-${digest.slice(20, 32)}`,
    )
  }
  const append = (
    eventType:
      | 'recursive-run-progress-committed'
      | 'recursive-partition-progress-committed'
      | 'recursive-result-progress-committed',
    payload: Readonly<Record<string, unknown>>,
  ) => deps.appendInProgressEvent(job, {
    id: eventId(eventType, payload),
    workspaceId: job.workspaceId,
    entityType: 'research',
    entityId: job.entityId,
    eventType,
    payload: {
      jobId: job.id,
      attempt: job.attempts,
      workspaceId: job.workspaceId,
      ...payload,
    },
    cursor: 0n,
    createdAt: deps.now(),
  })

  return {
    runCommitted: (progress) =>
      append('recursive-run-progress-committed', progress),
    partitionCommitted: (progress) =>
      append('recursive-partition-progress-committed', progress),
    resultCommitted: (progress) =>
      append('recursive-result-progress-committed', progress),
  }
}
