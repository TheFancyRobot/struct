import { Effect, Option, Schema } from 'effect'
import {
  ResearchEvent,
  RecursiveRunProgress,
} from '@struct/domain'
import type * as typeDomain from '@struct/domain'
import type * as typePersistence from '@struct/persistence'
import { QueryError } from '@struct/persistence'

const EVENT_PAGE_SIZE = 100
const MAX_RECURSIVE_EVENTS = 65_536

export interface RecursiveAnalysisReadDeps {
  readonly listEventsAfter: (
    workspaceId: typeDomain.WorkspaceId,
    projectId: typeDomain.ProjectId,
    runId: typeDomain.ResearchRunId,
    cursor: bigint,
    limit: number,
  ) => Effect.Effect<
    ReadonlyArray<typeof typeDomain.EventJournal.Type>,
    typePersistence.PersistenceError,
    never
  >
}

type RecursiveProgressEvent = Extract<
  typeDomain.ResearchEvent,
  {
    readonly type:
      | 'recursive-run-progress-committed'
      | 'recursive-partition-progress-committed'
      | 'recursive-result-progress-committed'
  }
>

function decodeRecursiveEvent(
  event: typeof typeDomain.EventJournal.Type,
  runId: typeDomain.ResearchRunId,
) {
  if (!event.eventType.startsWith('recursive-')) {
    return Effect.succeed(Option.none<RecursiveProgressEvent>())
  }
  return Schema.decodeUnknown(ResearchEvent)({
    id: event.id,
    cursor: event.cursor.toString(),
    runId,
    createdAt: Number(event.createdAt),
    type: event.eventType,
    data: event.payload,
  }).pipe(
    Effect.filterOrFail(
      (decoded): decoded is RecursiveProgressEvent =>
        decoded.type === 'recursive-run-progress-committed'
        || decoded.type === 'recursive-partition-progress-committed'
        || decoded.type === 'recursive-result-progress-committed',
      () => new QueryError({
        operation: 'findRecursiveAnalysis',
        entity: 'ResearchProjection',
        message: 'Recursive progress event type is invalid',
      }),
    ),
    Effect.map(Option.some),
    Effect.mapError(() => new QueryError({
      operation: 'findRecursiveAnalysis',
      entity: 'ResearchProjection',
      message: 'Recursive progress event data is invalid',
    })),
  )
}

function applyEvent(
  current: RecursiveRunProgress | undefined,
  event: RecursiveProgressEvent,
): Effect.Effect<RecursiveRunProgress, QueryError> {
  if (event.type === 'recursive-run-progress-committed') {
    if (
      current !== undefined
      && (
        current.workspaceId !== event.data.workspaceId
        || current.requestId !== event.data.requestId
        || current.planId !== event.data.planId
      )
    ) {
      return Effect.fail(new QueryError({
        operation: 'findRecursiveAnalysis',
        entity: 'ResearchProjection',
        message: 'Recursive progress identity changed within one run',
      }))
    }
    return Effect.succeed({
      runId: event.runId,
      ...event.data,
      partitions: current?.partitions ?? [],
      result: current?.result ?? null,
      updatedAt: event.createdAt,
    })
  }
  if (
    current === undefined
    || current.workspaceId !== event.data.workspaceId
    || current.requestId !== event.data.requestId
    || current.planId !== event.data.planId
  ) {
    return Effect.fail(new QueryError({
      operation: 'findRecursiveAnalysis',
      entity: 'ResearchProjection',
      message: 'Recursive progress delta is missing its committed run identity',
    }))
  }
  if (event.type === 'recursive-result-progress-committed') {
    return Effect.succeed({
      ...current,
      result: event.data.result,
      updatedAt: event.createdAt,
    })
  }
  const previous = current.partitions.find(
    (partition) => partition.id === event.data.partition.id,
  )
  const batches = previous === undefined
    ? event.data.partition.batches
    : previous.batches
        .filter((batch) =>
          !event.data.partition.batches.some((next) => next.id === batch.id))
        .concat(event.data.partition.batches)
        .sort((left, right) => left.id.localeCompare(right.id))
  const mergedPartition = {
    ...event.data.partition,
    batches,
    startedAt: previous?.startedAt ?? event.data.partition.startedAt,
  }
  const partitions = current.partitions.filter(
    (partition) => partition.id !== event.data.partition.id,
  )
  partitions.push(mergedPartition)
  partitions.sort((left, right) =>
    left.ordinal - right.ordinal || left.id.localeCompare(right.id))
  return Effect.succeed({
    ...current,
    partitions,
    updatedAt: event.createdAt,
  })
}

export const loadRecursiveAnalysis = Effect.fn(
  'RecursiveAnalysisRoute.load',
)(function* (
  workspaceId: typeDomain.WorkspaceId,
  projectId: typeDomain.ProjectId,
  runId: typeDomain.ResearchRunId,
  deps: RecursiveAnalysisReadDeps,
) {
  let cursor = 0n
  let loaded = 0
  let current: RecursiveRunProgress | undefined
  while (loaded <= MAX_RECURSIVE_EVENTS) {
    const remainingWithOverflowProbe = MAX_RECURSIVE_EVENTS - loaded + 1
    const limit = Math.min(EVENT_PAGE_SIZE, remainingWithOverflowProbe)
    const events = yield* deps.listEventsAfter(
      workspaceId,
      projectId,
      runId,
      cursor,
      limit,
    )
    for (const event of events) {
      const decoded = yield* decodeRecursiveEvent(event, runId)
      if (Option.isSome(decoded)) {
        if (decoded.value.data.workspaceId !== workspaceId) {
          return yield* new QueryError({
            operation: 'findRecursiveAnalysis',
            entity: 'ResearchProjection',
            message: 'Recursive progress payload is outside the authorized workspace',
          })
        }
        current = yield* applyEvent(current, decoded.value)
      }
      cursor = event.cursor
      loaded += 1
    }
    if (events.length < limit) break
  }
  if (loaded > MAX_RECURSIVE_EVENTS) {
    return yield* new QueryError({
      operation: 'findRecursiveAnalysis',
      entity: 'ResearchProjection',
      message: 'Recursive progress exceeds the bounded event read limit',
    })
  }
  if (current === undefined) return Option.none<RecursiveRunProgress>()
  return Option.some(
    yield* Schema.decodeUnknown(RecursiveRunProgress)(current).pipe(
      Effect.mapError(() => new QueryError({
        operation: 'findRecursiveAnalysis',
        entity: 'ResearchProjection',
        message: 'Recursive progress projection is invalid',
      })),
    ),
  )
})
