import { Effect, Option, Schema } from 'effect'
import {
  logWalkingSlice,
  withWalkingSliceSpan,
} from '@struct/observability'
import {
  DatasetId,
  DatasetSchemaFamilyId,
  DatasetSnapshotId,
  EventJournalId,
  isCanonicalStagedArtifactRef,
  isSupportedDatasetUpload,
  JobQueueId,
  ProjectId,
  Sha256Digest,
  SourceVersionId,
  ValidationError,
  type DatasetFieldSchema,
  type JobQueue,
  type SourceId,
  type SourceVersion,
  type StructuredSourceFormat,
} from '@struct/domain'
import {
  IngestionJobOwnershipLostError,
  type PersistenceError,
} from '@struct/persistence'
import type { ArtifactRef, StagedArtifactRef } from '@struct/source-storage'

export interface WorkerIngestionResult {
  readonly rawRef: ArtifactRef
  readonly normalizedRef: ArtifactRef
  readonly manifestRef: ArtifactRef
  readonly contentHash: `sha256:${string}`
  readonly byteLength: number
  readonly normalizedText: string
}

export interface WorkerStructuredIngestionResult {
  readonly artifactRef: ArtifactRef
  readonly contentHash: `sha256:${string}`
  readonly byteLength: number
}

type EventJournalType = typeof import('@struct/domain').EventJournal.Type

export interface IngestionWorkerDeps {
  readonly now: () => bigint
  readonly randomSourceVersionId: () => typeof SourceVersionId.Type
  readonly staleAfterMs: number
  readonly heartbeatIntervalMs: number
  readonly jobs: {
    readonly recoverStaleIngestionJobs: (staleAfterMs: number) => Effect.Effect<{ readonly requeued: ReadonlyArray<typeof JobQueue.Type>; readonly failed: ReadonlyArray<typeof JobQueue.Type> }, unknown, never>
    readonly claimNextIngestionJob: () => Effect.Effect<Option.Option<typeof JobQueue.Type>, unknown, never>
    readonly renewLease: (job: typeof JobQueue.Type) => Effect.Effect<void, PersistenceError, never>
    readonly appendInProgressEvent: (job: typeof JobQueue.Type, event: EventJournalType) => Effect.Effect<void, PersistenceError, never>
    readonly markCompleted: (job: typeof JobQueue.Type, event: EventJournalType) => Effect.Effect<void, PersistenceError, never>
    readonly markPending: (job: typeof JobQueue.Type, event: EventJournalType) => Effect.Effect<void, PersistenceError, never>
    readonly markFailed: (job: typeof JobQueue.Type, event: EventJournalType) => Effect.Effect<void, PersistenceError, never>
  }
  readonly sourceVersions: {
    readonly findBySourceId: (sourceId: SourceId) => Effect.Effect<ReadonlyArray<typeof SourceVersion.Type>, unknown, never>
    readonly createForIngestionAttempt: (
      job: typeof JobQueue.Type,
      version: typeof SourceVersion.Type,
    ) => Effect.Effect<typeof SourceVersion.Type, PersistenceError, never>
  }
  readonly textIndex: {
    readonly indexText: (input: {
      readonly workspaceId: typeof JobQueue.Type['workspaceId']
      readonly projectId: import('@struct/domain').ProjectId
      readonly sourceVersionId: typeof SourceVersion.Type['id']
      readonly content: string
    }) => Effect.Effect<unknown, unknown, never>
  }
  readonly ingestion: {
    readonly ingestTextSource: (input: { readonly stagedRef: StagedArtifactRef; readonly name: string; readonly mediaType: string }) => Effect.Effect<WorkerIngestionResult, unknown, never>
    readonly ingestStructuredSource?: (input: { readonly stagedRef: StagedArtifactRef; readonly name: string; readonly mediaType: string }) => Effect.Effect<WorkerStructuredIngestionResult, unknown, never>
  }
  readonly datasets?: {
    readonly inspect: (input: {
      readonly artifactRef: ArtifactRef
      readonly contentHash: `sha256:${string}`
      readonly format: StructuredSourceFormat
    }) => Effect.Effect<ReadonlyArray<DatasetFieldSchema>, unknown, never>
    readonly createDataset: (
      dataset: import('@struct/domain').DatasetAsset,
    ) => Effect.Effect<unknown, unknown, never>
    readonly createSchemaFamily: (
      family: import('@struct/domain').DatasetSchemaFamily,
    ) => Effect.Effect<unknown, unknown, never>
    readonly createSnapshot: (
      snapshot: import('@struct/domain').DatasetSnapshot,
    ) => Effect.Effect<unknown, unknown, never>
    readonly enqueueMaterialization: (
      input: import('@struct/persistence').DatasetMaterializationEnqueueInput,
    ) => Effect.Effect<unknown, unknown, never>
  }
  readonly calls?: {
    readonly events: string[]
    readonly completed: string[]
    readonly pending: string[]
    readonly failed: string[]
    readonly versions: unknown[]
  }
}

export interface ProcessOneResult {
  readonly processed: boolean
  readonly jobId?: string
}

interface IngestionPayload {
  readonly stagedRef: StagedArtifactRef
  readonly name: string
  readonly mediaType: string
  readonly projectId: import('@struct/domain').ProjectId | null
  readonly sourceKind: 'document' | 'dataset'
  readonly structuredFormat: StructuredSourceFormat | null
}

class IngestionLeaseHeartbeatError
  extends Schema.TaggedError<IngestionLeaseHeartbeatError>()(
    'IngestionLeaseHeartbeatError',
    {
      cause: Schema.Unknown,
      message: Schema.String,
    },
  ) {}

/**
 * Explicit escape hatch for adapters that can prove a failure is transient.
 * Unknown errors fail closed as terminal; callers must not infer retryability
 * from an arbitrary message.
 */
export class DeclaredRetryableIngestionError
  extends Schema.TaggedError<DeclaredRetryableIngestionError>()(
    'DeclaredRetryableIngestionError',
    {
      cause: Schema.Unknown,
      reason: Schema.String,
      message: Schema.String,
    },
  ) {}

export type IngestionFailureDisposition = 'retryable' | 'terminal'

const retryableFailureTags = new Set([
  'DeclaredRetryableIngestionError',
  'JobClaimError',
  'QueryError',
  'RetrievalQueryError',
  'StorageReadError',
  'StorageWriteError',
])

const retryableIngestionFailureReasons = new Set([
  'QueryError',
  'StorageReadError',
  'StorageWriteError',
])

function taggedFailure(error: unknown): {
  readonly _tag?: unknown
  readonly reason?: unknown
} | undefined {
  return typeof error === 'object' && error !== null
    ? error as { readonly _tag?: unknown; readonly reason?: unknown }
    : undefined
}

/**
 * Retry only failures whose type explicitly denotes transient infrastructure.
 * Validation, authorization, unsupported input, path/ref, schema, hash,
 * integrity, conflict, and unknown failures are terminal by default.
 */
export function classifyIngestionFailure(
  error: unknown,
): IngestionFailureDisposition {
  const tagged = taggedFailure(error)
  if (typeof tagged?._tag !== 'string') return 'terminal'
  if (retryableFailureTags.has(tagged._tag)) return 'retryable'
  if (
    tagged._tag === 'IngestionFailureError'
    && typeof tagged.reason === 'string'
    && retryableIngestionFailureReasons.has(tagged.reason)
  ) {
    return 'retryable'
  }
  return 'terminal'
}

function decodePayload(
  payload: Record<string, unknown>,
): Effect.Effect<IngestionPayload, ValidationError, never> {
  const stagedRef = payload['stagedRef']
  const name = payload['name']
  const mediaType = payload['mediaType']
  const projectId = payload['projectId']
  const sourceKind = payload['sourceKind'] ?? 'document'
  const structuredFormat = payload['structuredFormat'] ?? null
  if (!isCanonicalStagedArtifactRef(stagedRef)) {
    return Effect.fail(new ValidationError({ field: 'payload.stagedRef', reason: 'invalid', message: 'Ingestion payload stagedRef is invalid' }))
  }
  if (
    typeof name !== 'string'
    || typeof mediaType !== 'string'
    || (sourceKind !== 'document' && sourceKind !== 'dataset')
    || (
      sourceKind === 'dataset'
      && !isSupportedDatasetUpload(name, mediaType, structuredFormat)
    )
    || (sourceKind === 'document' && structuredFormat !== null)
  ) {
    return Effect.fail(new ValidationError({ field: 'payload', reason: 'invalid', message: 'Ingestion payload is missing source metadata' }))
  }
  return Effect.gen(function* () {
    const decodedProjectId = projectId === null
      ? null
      : yield* Effect.try({
          try: () => Schema.decodeUnknownSync(ProjectId)(projectId),
          catch: () =>
            new ValidationError({
              field: 'payload.projectId',
              reason: 'invalid',
              message: 'Ingestion payload projectId is invalid',
            }),
        })
    return {
      stagedRef: stagedRef as StagedArtifactRef,
      name,
      mediaType,
      projectId: decodedProjectId,
      sourceKind,
      structuredFormat: structuredFormat as StructuredSourceFormat | null,
    }
  })
}

function sanitizedFailurePayload(
  reason: unknown,
  retryable: boolean,
): Record<string, unknown> {
  const candidate = typeof reason === 'object'
    && reason !== null
    && '_tag' in reason
    ? String(reason._tag)
    : 'IngestionFailure'
  const tag = /^[A-Za-z][A-Za-z0-9]{0,99}$/.test(candidate)
    ? candidate
    : 'IngestionFailure'
  return { errorTag: tag, message: 'Ingestion failed', retryable }
}

function makeEvent(
  deps: IngestionWorkerDeps,
  job: typeof JobQueue.Type,
  eventType: string,
  payload: Record<string, unknown>,
): EventJournalType {
  return {
    id: EventJournalId.make(crypto.randomUUID()),
    workspaceId: job.workspaceId,
    entityType: 'ingestion',
    entityId: job.entityId,
    eventType,
    payload: {
      ...payload,
      jobId: job.id,
      attempt: job.attempts,
    },
    cursor: 0n,
    createdAt: deps.now(),
  }
}

function appendOwnedEvent(
  deps: IngestionWorkerDeps,
  job: typeof JobQueue.Type,
  eventType: string,
  payload: Record<string, unknown>,
): Effect.Effect<void, PersistenceError, never> {
  return deps.jobs.appendInProgressEvent(job, makeEvent(deps, job, eventType, payload))
}

function deterministicUuid(seed: string, purpose: string): string {
  const digest = new Bun.CryptoHasher('sha256')
    .update(`${seed}\0${purpose}`)
    .digest('hex')
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-5${digest.slice(13, 16)}-a${digest.slice(17, 20)}-${digest.slice(20, 32)}`
}

function completeDataset(
  deps: IngestionWorkerDeps,
  job: typeof JobQueue.Type,
  payload: IngestionPayload,
  sourceVersion: typeof SourceVersion.Type,
  artifactResult: WorkerStructuredIngestionResult,
): Effect.Effect<{
  readonly datasetId?: typeof DatasetId.Type
  readonly snapshotId?: typeof DatasetSnapshotId.Type
  readonly materializationJobId?: typeof import('@struct/domain').JobQueueId.Type
}, unknown, never> {
  return Effect.gen(function* () {
    if (payload.projectId === null) return {}
    if (
      deps.datasets === undefined
      || payload.structuredFormat === null
    ) {
      return yield* new ValidationError({
        field: 'dataset',
        reason: 'dataset-pipeline-unavailable',
        message: 'Dataset ingestion pipeline is unavailable',
      })
    }
    const fields = yield* deps.datasets.inspect({
      artifactRef: artifactResult.artifactRef,
      contentHash: artifactResult.contentHash,
      format: payload.structuredFormat,
    })
    const datasetId = DatasetId.make(deterministicUuid(job.entityId, 'dataset'))
    const schemaHash = Sha256Digest.make(
      `sha256:${new Bun.CryptoHasher('sha256')
        .update(`${JSON.stringify(fields)}\n`)
        .digest('hex')}`,
    )
    const familyId = DatasetSchemaFamilyId.make(
      deterministicUuid(datasetId, schemaHash),
    )
    const snapshotId = DatasetSnapshotId.make(
      deterministicUuid(sourceVersion.id, 'snapshot'),
    )
    yield* deps.datasets.createDataset({
      id: datasetId,
      workspaceId: job.workspaceId,
      projectId: payload.projectId,
      name: payload.name,
      lifecycleStatus: 'active',
      createdAt: sourceVersion.createdAt,
    })
    yield* deps.datasets.createSchemaFamily({
      id: familyId,
      datasetId,
      workspaceId: job.workspaceId,
      projectId: payload.projectId,
      schemaHash,
      fields: [...fields],
      createdAt: sourceVersion.createdAt,
    })
    yield* deps.datasets.createSnapshot({
      id: snapshotId,
      datasetId,
      workspaceId: job.workspaceId,
      projectId: payload.projectId,
      version: 1,
      schemaFamilyId: familyId,
      previousSnapshotId: Option.none(),
      contentHash: Sha256Digest.make(artifactResult.contentHash),
      sources: [{
        ordinal: 0,
        sourceId: job.entityId as SourceId,
        sourceVersionId: sourceVersion.id,
        contentHash: Sha256Digest.make(artifactResult.contentHash),
      }],
      createdAt: sourceVersion.createdAt,
    })
    const materializationId = JobQueueId.make(
      deterministicUuid(snapshotId, 'materialization'),
    )
    yield* deps.datasets.enqueueMaterialization({
      jobId: materializationId,
      workspaceId: job.workspaceId,
      snapshotId,
      sourceFormats: [payload.structuredFormat],
      maxAttempts: 3,
    })
    return { datasetId, snapshotId, materializationJobId: materializationId }
  })
}

function completeJob(
  deps: IngestionWorkerDeps,
  job: typeof JobQueue.Type,
  payload: IngestionPayload,
): Effect.Effect<void, unknown, never> {
  return Effect.gen(function* () {
    const artifactResult = payload.sourceKind === 'dataset'
      ? yield* (
          deps.ingestion.ingestStructuredSource?.(payload)
          ?? Effect.fail(new ValidationError({
            field: 'dataset',
            reason: 'dataset-pipeline-unavailable',
            message: 'Dataset ingestion pipeline is unavailable',
          }))
        )
      : yield* deps.ingestion.ingestTextSource(payload)
    const sourceArtifactRef = payload.sourceKind === 'dataset'
      ? (artifactResult as WorkerStructuredIngestionResult).artifactRef
      : (artifactResult as WorkerIngestionResult).manifestRef
    const existing = yield* deps.sourceVersions.findBySourceId(job.entityId as SourceId)
    const reusableVersion = job.attempts > 1
      ? existing.find((version) =>
          version.artifactRef === sourceArtifactRef
          && version.contentHash === artifactResult.contentHash)
      : undefined
    const sourceVersion = reusableVersion ?? (yield* Effect.gen(function* () {
      const nextVersion = existing.reduce((max, version) => Math.max(max, version.version), 0) + 1
      const candidate: typeof SourceVersion.Type = {
        id: deps.randomSourceVersionId(),
        sourceId: job.entityId as SourceId,
        version: nextVersion,
        artifactRef: sourceArtifactRef,
        contentHash: artifactResult.contentHash,
        createdAt: deps.now(),
      }
      return yield* deps.sourceVersions.createForIngestionAttempt(job, candidate)
    }))
    let completionPayload: Record<string, unknown>
    if (payload.sourceKind === 'dataset') {
      const dataset = yield* completeDataset(
        deps,
        job,
        payload,
        sourceVersion,
        artifactResult as WorkerStructuredIngestionResult,
      )
      yield* appendOwnedEvent(deps, job, 'dataset-materialization-enqueued', {
        sourceVersionId: sourceVersion.id,
        artifactRef: sourceVersion.artifactRef,
        contentHash: artifactResult.contentHash,
        byteLength: artifactResult.byteLength,
        ...dataset,
      })
      completionPayload = {
        sourceVersionId: sourceVersion.id,
        artifactRef: sourceVersion.artifactRef,
        contentHash: artifactResult.contentHash,
        ...dataset,
      }
    } else {
      const document = artifactResult as WorkerIngestionResult
      if (payload.projectId !== null) {
        yield* deps.textIndex.indexText({
          workspaceId: job.workspaceId,
          projectId: payload.projectId,
          sourceVersionId: sourceVersion.id,
          content: document.normalizedText,
        })
      }
      yield* appendOwnedEvent(deps, job, 'file-processed', {
        sourceVersionId: sourceVersion.id,
        manifestRef: sourceVersion.artifactRef,
        contentHash: document.contentHash,
        byteLength: document.byteLength,
      })
      completionPayload = {
        sourceVersionId: sourceVersion.id,
        manifestRef: document.manifestRef,
        contentHash: document.contentHash,
      }
    }
    const completionEvent = makeEvent(
      deps,
      job,
      'ingestion-completed',
      completionPayload,
    )
    yield* deps.jobs.markCompleted(job, completionEvent)
  })
}

function failJob(deps: IngestionWorkerDeps, job: typeof JobQueue.Type, reason: unknown): Effect.Effect<void, unknown, never> {
  const disposition = classifyIngestionFailure(reason)
  const retryable = disposition === 'retryable'
  const willRetry = retryable && job.attempts < job.maxAttempts
  const failurePayload = sanitizedFailurePayload(reason, retryable)
  const failureEvent = makeEvent(
    deps,
    job,
    'ingestion-failed',
    failurePayload,
  )
  return Effect.gen(function* () {
    if (
      willRetry
    ) {
      yield* deps.jobs.markPending(job, failureEvent)
    } else {
      yield* deps.jobs.markFailed(job, failureEvent)
    }
    yield* logWalkingSlice({
      event: willRetry
        ? 'source.ingestion.retry-scheduled'
        : 'source.ingestion.failed',
      identity: {
        workspaceId: job.workspaceId,
        sourceId: job.entityId,
        jobId: job.id,
      },
      errorTag: String(failurePayload['errorTag']),
    })
  }).pipe(
    Effect.catchTag('IngestionJobOwnershipLostError', () => Effect.void),
  )
}

function isOwnershipLost(error: unknown): boolean {
  return error instanceof IngestionJobOwnershipLostError
    || (
      typeof error === 'object'
      && error !== null
      && '_tag' in error
      && error._tag === 'IngestionJobOwnershipLostError'
    )
}

export const processOneIngestionJob = (
  deps: IngestionWorkerDeps,
): Effect.Effect<ProcessOneResult, unknown, never> =>
  Effect.gen(function* () {
    yield* deps.jobs.recoverStaleIngestionJobs(deps.staleAfterMs)
    const claimed = yield* deps.jobs.claimNextIngestionJob()
    if (Option.isNone(claimed)) {
      return { processed: false }
    }

    const job = claimed.value
    const executeClaimedJob = withWalkingSliceSpan(
      'worker-job',
      {
        workspaceId: job.workspaceId,
        sourceId: job.entityId,
        jobId: job.id,
      },
      Effect.gen(function* () {
        const payloadResult = yield* Effect.either(
          decodePayload(job.payload),
        )
        if (payloadResult._tag === 'Left') {
          yield* failJob(deps, job, payloadResult.left)
          return
        }
        const completed = yield* Effect.either(
          completeJob(deps, job, payloadResult.right),
        )
        if (completed._tag === 'Left') {
          if (isOwnershipLost(completed.left)) return
          yield* failJob(deps, job, completed.left)
        }
      }),
    )
    const renewLease = Effect.gen(function* () {
      while (true) {
        yield* deps.jobs.renewLease(job)
        yield* Effect.sleep(`${deps.heartbeatIntervalMs} millis`)
      }
    }).pipe(
      Effect.mapError((cause) =>
        new IngestionLeaseHeartbeatError({
          cause,
          message: 'Ingestion lease heartbeat failed',
        }),
      ),
    )
    const executed = yield* Effect.raceFirst(
      executeClaimedJob,
      renewLease,
    ).pipe(Effect.either)

    if (executed._tag === 'Left') {
      if (executed.left instanceof IngestionLeaseHeartbeatError) {
        if (isOwnershipLost(executed.left.cause)) {
          return { processed: true, jobId: job.id }
        }
        return yield* Effect.fail(executed.left.cause)
      }
      if (isOwnershipLost(executed.left)) {
        return { processed: true, jobId: job.id }
      }
      return yield* Effect.fail(executed.left)
    }
    return { processed: true, jobId: job.id }
  })
