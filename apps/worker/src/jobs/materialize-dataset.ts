import {
  DataEngineOperationError,
  DataEngineTransportError,
  type DataEngineClientShape,
  type MaterializationLimits,
  materializeDataset,
} from '@struct/data-engine'
import {
  type DatasetSchemaFamily,
  type DatasetSnapshot,
  Sha256Digest,
} from '@struct/domain'
import {
  DatasetMaterialization,
  type DatasetMaterializationJob,
} from '@struct/persistence'
import { type ArtifactStoreShape } from '@struct/source-storage'
import { Effect, Option, Schema } from 'effect'

export class DatasetMaterializationCatalogError
  extends Schema.TaggedError<DatasetMaterializationCatalogError>()(
    'DatasetMaterializationCatalogError',
    { entity: Schema.Literal('snapshot', 'schema-family'), message: Schema.String },
  ) {}

export class DatasetMaterializationLeaseHeartbeatError
  extends Schema.TaggedError<DatasetMaterializationLeaseHeartbeatError>()(
    'DatasetMaterializationLeaseHeartbeatError',
    { cause: Schema.Unknown, message: Schema.String },
  ) {}

export interface DatasetMaterializationWorkerDeps {
  readonly leaseMs: number
  readonly heartbeatIntervalMs: number
  readonly limits: MaterializationLimits
  readonly jobs: {
    readonly recoverExpired: () => Effect.Effect<number, unknown>
    readonly claimNext: (
      leaseMs: number,
    ) => Effect.Effect<Option.Option<DatasetMaterializationJob>, unknown>
    readonly renewLease: (
      job: DatasetMaterializationJob,
      leaseMs: number,
    ) => Effect.Effect<void, unknown>
    readonly complete: (
      job: DatasetMaterializationJob,
      materialization: typeof DatasetMaterialization.Type,
    ) => Effect.Effect<void, unknown>
    readonly recordFailure: (
      job: DatasetMaterializationJob,
      retryable: boolean,
      errorCode: string,
    ) => Effect.Effect<void, unknown>
  }
  readonly catalog: {
    readonly listSnapshots: (
      job: DatasetMaterializationJob,
    ) => Effect.Effect<ReadonlyArray<typeof DatasetSnapshot.Type>, unknown>
    readonly getSchemaFamily: (
      job: DatasetMaterializationJob,
      familyId: typeof DatasetSchemaFamily.Type['id'],
    ) => Effect.Effect<Option.Option<typeof DatasetSchemaFamily.Type>, unknown>
  }
  readonly client: DataEngineClientShape
  readonly store: Pick<ArtifactStoreShape, 'writeObject'>
}

function tagged(error: unknown): string {
  return typeof error === 'object'
    && error !== null
    && '_tag' in error
    && typeof error._tag === 'string'
    ? error._tag
    : 'materialization-failed'
}

function retryable(error: unknown): boolean {
  if (error instanceof DataEngineTransportError) return true
  if (error instanceof DataEngineOperationError) {
    return error.code === 'engine' || error.code === 'cancelled'
  }
  return tagged(error) === 'StorageWriteError'
}

function errorCode(error: unknown): string {
  if (error instanceof DataEngineOperationError) return error.code
  const candidate = tagged(error)
    .replaceAll(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
  return /^[a-z][a-z0-9-]{0,99}$/.test(candidate)
    ? candidate
    : 'materialization-failed'
}

function ownershipLost(error: unknown): boolean {
  return tagged(error) === 'DatasetMaterializationOwnershipLostError'
}

const processClaimed = Effect.fn('processClaimedDatasetMaterialization')(
  function* (
    deps: DatasetMaterializationWorkerDeps,
    job: DatasetMaterializationJob,
  ) {
    const snapshots = yield* deps.catalog.listSnapshots(job)
    const snapshot = snapshots.find((candidate) => candidate.id === job.snapshotId)
    if (snapshot === undefined) {
      return yield* new DatasetMaterializationCatalogError({
        entity: 'snapshot',
        message: 'Claimed dataset snapshot was not found in its catalog scope',
      })
    }
    const family = yield* deps.catalog.getSchemaFamily(job, snapshot.schemaFamilyId)
    if (Option.isNone(family)) {
      return yield* new DatasetMaterializationCatalogError({
        entity: 'schema-family',
        message: 'Dataset schema family was not found in its catalog scope',
      })
    }
    const result = yield* materializeDataset(
      { client: deps.client, store: deps.store },
      {
        snapshot,
        schemaFamily: family.value,
        sourceFormats: job.sourceFormats,
        limits: deps.limits,
      },
    )
    const materialization = yield* Schema.decodeUnknown(DatasetMaterialization)({
      snapshotId: snapshot.id,
      workspaceId: snapshot.workspaceId,
      projectId: snapshot.projectId,
      datasetId: snapshot.datasetId,
      parquetRef: result.parquet.ref,
      parquetHash: Sha256Digest.make(result.parquet.hash),
      parquetByteLength: result.parquet.byteLength,
      profileRef: result.profile.ref,
      profileHash: Sha256Digest.make(result.profile.hash),
      profile: result.profileValue,
    })
    yield* deps.jobs.complete(job, materialization)
    return snapshot.id
  },
)

export const processOneDatasetMaterialization = Effect.fn(
  'processOneDatasetMaterialization',
)(function* (deps: DatasetMaterializationWorkerDeps) {
  yield* deps.jobs.recoverExpired()
  const claimed = yield* deps.jobs.claimNext(deps.leaseMs)
  if (Option.isNone(claimed)) return { processed: false as const }
  const job = claimed.value
  const heartbeat = Effect.gen(function* () {
    while (true) {
      yield* deps.jobs.renewLease(job, deps.leaseMs)
      yield* Effect.sleep(`${deps.heartbeatIntervalMs} millis`)
    }
  }).pipe(
    Effect.mapError((cause) =>
      new DatasetMaterializationLeaseHeartbeatError({
        cause,
        message: 'Dataset materialization lease heartbeat failed',
      }),
    ),
  )
  const execute = processClaimed(deps, job).pipe(
    Effect.matchEffect({
      onFailure: (error) =>
        ownershipLost(error)
          ? Effect.succeed(job.snapshotId)
          : deps.jobs.recordFailure(
              job,
              retryable(error),
              errorCode(error),
            ).pipe(
              Effect.catchIf(ownershipLost, () => Effect.void),
              Effect.as(job.snapshotId),
            ),
      onSuccess: Effect.succeed,
    }),
  )
  const executed = yield* Effect.raceFirst(
    execute,
    heartbeat,
  ).pipe(Effect.either)
  if (executed._tag === 'Left') {
    if (executed.left instanceof DatasetMaterializationLeaseHeartbeatError) {
      if (ownershipLost(executed.left.cause)) {
        return { processed: true as const, snapshotId: job.snapshotId }
      }
      return yield* Effect.fail(executed.left.cause)
    }
    if (ownershipLost(executed.left)) {
      return { processed: true as const, snapshotId: job.snapshotId }
    }
    return yield* Effect.fail(executed.left)
  }
  return { processed: true as const, snapshotId: executed.right }
})
