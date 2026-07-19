import {
  DatasetSchemaFamily,
  DatasetSnapshot,
  Sha256Digest,
} from '@struct/domain'
import {
  type ArtifactObject,
  type ArtifactStoreShape,
} from '@struct/source-storage'
import { Effect, Schema } from 'effect'
import {
  DataEngineProtocolError,
  type DataEngineMaterializationClientShape,
} from './client.js'
import {
  DATA_ENGINE_PROTOCOL_VERSION,
  MaterializeRequest,
  type DatasetProfile,
} from './protocol.js'

export interface MaterializationLimits {
  readonly maxInputBytes: number
  readonly maxRows: number
  readonly maxOutputBytes: number
  readonly timeoutMs: number
}

export interface MaterializeDatasetInput {
  readonly snapshot: typeof DatasetSnapshot.Type
  readonly schemaFamily: typeof DatasetSchemaFamily.Type
  readonly sourceFormats: ReadonlyArray<'json' | 'jsonl' | 'csv'>
  readonly limits: MaterializationLimits
}

export interface MaterializedDataset {
  readonly parquet: ArtifactObject
  readonly profile: ArtifactObject
  readonly profileValue: DatasetProfile
}

export interface MaterializeDatasetDependencies {
  readonly client: DataEngineMaterializationClientShape
  readonly store: Pick<ArtifactStoreShape, 'writeObject'>
}

const encoder = new TextEncoder()

function canonicalProfile(profile: DatasetProfile): Uint8Array {
  return encoder.encode(`${JSON.stringify(profile)}\n`)
}

export const materializeDataset = Effect.fn('materializeDataset')(
  function* (
    dependencies: MaterializeDatasetDependencies,
    input: MaterializeDatasetInput,
  ) {
    const { client, store } = dependencies
    if (
      input.schemaFamily.id !== input.snapshot.schemaFamilyId
      || input.schemaFamily.datasetId !== input.snapshot.datasetId
      || input.schemaFamily.workspaceId !== input.snapshot.workspaceId
      || input.schemaFamily.projectId !== input.snapshot.projectId
    ) {
      return yield* new DataEngineProtocolError({
        message: 'Snapshot lineage does not match its schema family',
      })
    }
    if (input.sourceFormats.length !== input.snapshot.sources.length) {
      return yield* new DataEngineProtocolError({
        message: 'Every snapshot source requires one declared structured format',
      })
    }
    const request = yield* Schema.decodeUnknown(MaterializeRequest)({
      protocolVersion: DATA_ENGINE_PROTOCOL_VERSION,
      operation: 'materialize',
      snapshotId: input.snapshot.id,
      inputs: input.snapshot.sources.map((source, ordinal) => ({
        ordinal,
        format: input.sourceFormats[ordinal],
        artifactDigest: source.contentHash.slice('sha256:'.length),
        contentHash: source.contentHash,
      })),
      fields: input.schemaFamily.fields,
      limits: input.limits,
    }).pipe(
      Effect.mapError(() =>
        new DataEngineProtocolError({ message: 'Materialization request is invalid' }),
      ),
    )
    const result = yield* client.materialize(request)
    if (result.snapshotId !== input.snapshot.id) {
      return yield* new DataEngineProtocolError({
        message: 'Materialization response does not match the requested snapshot',
      })
    }
    if (
      result.profile.columns.length !== input.schemaFamily.fields.length
      || result.profile.columns.some((column, index) => {
        const field = input.schemaFamily.fields[index]
        return field === undefined
          || column.ordinal !== field.ordinal
          || column.name !== field.name
      })
    ) {
      return yield* new DataEngineProtocolError({
        message: 'Materialization profile does not match the requested schema',
      })
    }
    const parquetBytes = yield* client.readArtifact(
      result.artifactToken,
      result.parquetDigest,
      input.limits.maxOutputBytes,
      input.limits.timeoutMs,
    )
    if (parquetBytes.byteLength !== result.parquetByteLength) {
      return yield* new DataEngineProtocolError({
        message: 'Materialized Parquet bytes do not match sidecar metadata',
      })
    }
    const actualParquetDigest = new Bun.CryptoHasher('sha256')
      .update(parquetBytes)
      .digest('hex')
    if (actualParquetDigest !== result.parquetDigest) {
      return yield* new DataEngineProtocolError({
        message: 'Materialized Parquet bytes do not match their digest',
      })
    }
    const parquet = yield* store.writeObject(parquetBytes, {
      mediaType: 'application/vnd.apache.parquet',
    })
    const profileBytes = canonicalProfile(result.profile)
    const profileHash = Sha256Digest.make(
      `sha256:${new Bun.CryptoHasher('sha256').update(profileBytes).digest('hex')}`,
    )
    if (profileHash !== result.profileHash) {
      return yield* new DataEngineProtocolError({
        message: 'Materialized profile does not match its declared hash',
      })
    }
    const profile = yield* store.writeObject(profileBytes, {
      mediaType: 'application/json',
    })
    return { parquet, profile, profileValue: result.profile }
  },
)
