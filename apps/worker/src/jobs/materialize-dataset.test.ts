import { describe, expect, it } from 'bun:test'
import {
  DataEngineOperationError,
  materializeDataset,
  type DataEngineClientShape,
} from '@struct/data-engine'
import {
  DatasetId,
  DatasetSchemaFamilyId,
  DatasetSnapshotId,
  JobQueueId,
  ProjectId,
  Sha256Digest,
  SourceId,
  SourceVersionId,
  WorkspaceId,
} from '@struct/domain'
import {
  type DatasetMaterialization,
  type DatasetMaterializationJob,
} from '@struct/persistence'
import { Effect, Option } from 'effect'
import { processOneDatasetMaterialization } from './materialize-dataset.js'

const workspaceId = WorkspaceId.make('550e8400-e29b-41d4-a716-446655440001')
const projectId = ProjectId.make('550e8400-e29b-41d4-a716-446655440002')
const datasetId = DatasetId.make('550e8400-e29b-41d4-a716-446655440003')
const snapshotId = DatasetSnapshotId.make('550e8400-e29b-41d4-a716-446655440004')
const familyId = DatasetSchemaFamilyId.make('550e8400-e29b-41d4-a716-446655440005')
const sourceId = SourceId.make('550e8400-e29b-41d4-a716-446655440006')
const sourceVersionId = SourceVersionId.make('550e8400-e29b-41d4-a716-446655440007')
const contentDigest = 'a'.repeat(64)
const parquetBytes = new TextEncoder().encode('PAR1 deterministic parquet')
const parquetDigest = new Bun.CryptoHasher('sha256')
  .update(parquetBytes)
  .digest('hex')
const profile = {
  rowCount: 2,
  columns: [{
    ordinal: 0,
    name: 'id',
    nullCount: 0,
    distinctCount: 2,
    minimum: '1',
    maximum: '2',
  }],
}
const profileBytes = new TextEncoder().encode(`${JSON.stringify(profile)}\n`)
const profileDigest = new Bun.CryptoHasher('sha256')
  .update(profileBytes)
  .digest('hex')

function job(attempt: number): DatasetMaterializationJob {
  return {
    jobId: JobQueueId.make('550e8400-e29b-41d4-a716-446655440008'),
    workspaceId,
    projectId,
    datasetId,
    snapshotId,
    attempt,
    maxAttempts: 3,
    leaseToken: '550e8400-e29b-41d4-a716-446655440009',
    sourceFormats: ['json'],
  }
}

const snapshot = {
  id: snapshotId,
  datasetId,
  workspaceId,
  projectId,
  version: 1,
  schemaFamilyId: familyId,
  previousSnapshotId: Option.none(),
  contentHash: Sha256Digest.make(`sha256:${contentDigest}`),
  sources: [{
    ordinal: 0,
    sourceId,
    sourceVersionId,
    contentHash: Sha256Digest.make(`sha256:${contentDigest}`),
  }],
  createdAt: 1n,
}
const family = {
  id: familyId,
  datasetId,
  workspaceId,
  projectId,
  schemaHash: Sha256Digest.make(`sha256:${'b'.repeat(64)}`),
  fields: [{
    ordinal: 0,
    name: 'id',
    sourceType: 'number',
    logicalType: 'integer' as const,
    nullable: false,
  }],
  createdAt: 1n,
}

describe('processOneDatasetMaterialization', () => {
  it('rejects a sidecar result for another snapshot before reading artifacts', async () => {
    const client: DataEngineClientShape = {
      materialize: () => Effect.succeed({
        protocolVersion: '1',
        snapshotId: DatasetSnapshotId.make(
          '650e8400-e29b-41d4-a716-446655440099',
        ),
        artifactToken: '00000000-0000-4000-8000-000000000001',
        parquetDigest,
        parquetByteLength: parquetBytes.byteLength,
        profileHash: Sha256Digest.make(`sha256:${profileDigest}`),
        profile,
      }),
      readArtifact: () => Effect.die('artifact read must not run'),
    }
    const exit = await Effect.runPromiseExit(materializeDataset(
      {
        client,
        store: { writeObject: () => Effect.die('artifact write must not run') },
      },
      {
        snapshot,
        schemaFamily: family,
        sourceFormats: ['json'],
        limits: {
          maxInputBytes: 1_024,
          maxRows: 100,
          maxOutputBytes: 1_024,
          timeoutMs: 1_000,
        },
      },
    ))
    expect(String(exit)).toContain('DataEngineProtocolError')
    expect(String(exit)).toContain('requested snapshot')
  })

  it('recovers an interrupted attempt and commits one immutable result', async () => {
    let attempts = 0
    let pending = true
    let recordedFailure: { retryable: boolean; errorCode: string } | undefined
    let completed: DatasetMaterialization | undefined
    const client: DataEngineClientShape = {
      materialize: () => {
        attempts += 1
        if (attempts === 1) {
          return Effect.fail(new DataEngineOperationError({
            code: 'busy',
            message: 'Materializer concurrency limit reached',
          }))
        }
        return Effect.succeed({
          protocolVersion: '1',
          snapshotId,
          artifactToken: '00000000-0000-4000-8000-000000000001',
          parquetDigest,
          parquetByteLength: parquetBytes.byteLength,
          profileHash: Sha256Digest.make(`sha256:${profileDigest}`),
          profile,
        })
      },
      readArtifact: () => Effect.succeed(parquetBytes),
    }
    const dependencies = {
      leaseMs: 1_000,
      heartbeatIntervalMs: 100,
      limits: {
        maxInputBytes: 1_024,
        maxRows: 100,
        maxOutputBytes: 1_024,
        timeoutMs: 1_000,
      },
      jobs: {
        recoverExpired: () => Effect.sync(() => {
          pending = true
          return attempts === 0 ? 0 : 1
        }),
        claimNext: () => Effect.sync(() => {
          if (!pending) return Option.none()
          pending = false
          return Option.some(job(attempts + 1))
        }),
        renewLease: () => Effect.void,
        complete: (
          _job: DatasetMaterializationJob,
          value: DatasetMaterialization,
        ) => Effect.sync(() => {
          completed = value
        }),
        recordFailure: (
          _job: DatasetMaterializationJob,
          retryable: boolean,
          errorCode: string,
        ) => Effect.sync(() => {
          recordedFailure = { retryable, errorCode }
          pending = retryable
        }),
      },
      catalog: {
        listSnapshots: () => Effect.succeed([snapshot]),
        getSchemaFamily: () => Effect.succeed(Option.some(family)),
      },
      client,
      store: {
        writeObject: (bytes: Uint8Array, options: { readonly mediaType: string }) =>
          Effect.succeed({
            ref: `artifact://sha256/${new Bun.CryptoHasher('sha256').update(bytes).digest('hex')}` as const,
            hash: `sha256:${new Bun.CryptoHasher('sha256').update(bytes).digest('hex')}` as const,
            byteLength: bytes.byteLength,
            mediaType: options.mediaType,
          }),
      },
    }
    const first = await Effect.runPromise(
      processOneDatasetMaterialization(dependencies),
    )
    expect(first).toEqual({ processed: true, snapshotId })
    expect(recordedFailure).toEqual({
      retryable: true,
      errorCode: 'busy',
    })
    const replay = await Effect.runPromise(
      processOneDatasetMaterialization(dependencies),
    )
    expect(replay).toEqual({ processed: true, snapshotId })
    expect(attempts).toBe(2)
    expect(completed?.parquetHash).toBe(
      Sha256Digest.make(`sha256:${parquetDigest}`),
    )
    expect(completed?.profileHash).toBe(
      Sha256Digest.make(`sha256:${profileDigest}`),
    )
  })

  it('records invalid input as a terminal non-retryable failure', async () => {
    let failure: { retryable: boolean; errorCode: string } | undefined
    const claimed = job(1)
    const client: DataEngineClientShape = {
      materialize: () => Effect.fail(new DataEngineOperationError({
        code: 'invalid-input',
        message: 'Integer value would lose precision',
      })),
      readArtifact: () => Effect.die('artifact read must not run'),
    }
    const result = await Effect.runPromise(processOneDatasetMaterialization({
      leaseMs: 1_000,
      heartbeatIntervalMs: 100,
      limits: {
        maxInputBytes: 1_024,
        maxRows: 100,
        maxOutputBytes: 1_024,
        timeoutMs: 1_000,
      },
      jobs: {
        recoverExpired: () => Effect.succeed(0),
        claimNext: () => Effect.succeed(Option.some(claimed)),
        renewLease: () => Effect.void,
        complete: () => Effect.die('completion must not run'),
        recordFailure: (_job, retryable, errorCode) => Effect.sync(() => {
          failure = { retryable, errorCode }
        }),
      },
      catalog: {
        listSnapshots: () => Effect.succeed([snapshot]),
        getSchemaFamily: () => Effect.succeed(Option.some(family)),
      },
      client,
      store: {
        writeObject: () => Effect.die('artifact write must not run'),
      },
    }))

    expect(result).toEqual({ processed: true, snapshotId })
    expect(failure).toEqual({
      retryable: false,
      errorCode: 'invalid-input',
    })
  })
})
