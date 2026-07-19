import { describe, expect, it } from 'bun:test'
import {
  DirectoryIngestionLeaseToken,
  DirectoryManifest,
  DirectoryRelativePath,
  DirectoryRootId,
  DirectorySnapshotId,
  JobQueueId,
  ManifestEntryId,
  ProjectId,
  Sha256Digest,
  SourceId,
  SourceVersionId,
  WorkspaceId,
  computeManifestDigest,
  type DirectoryManifestEntry,
} from '@struct/domain'
import type {
  ArtifactObject,
  ArtifactStoreShape,
} from '@struct/source-storage'
import { Effect, Schema } from 'effect'
import { refreshClaimedDirectory } from './refresh-directory.js'

const workspaceId = WorkspaceId.make('370e8400-e29b-41d4-a716-446655440000')
const projectId = ProjectId.make('370e8400-e29b-41d4-a716-446655440001')
const rootId = DirectoryRootId.make('370e8400-e29b-41d4-a716-446655440002')
const snapshotId =
  DirectorySnapshotId.make('370e8400-e29b-41d4-a716-446655440003')
const bytes = new TextEncoder().encode('changed')
const hash = Sha256Digest.make(
  `sha256:${new Bun.CryptoHasher('sha256').update(bytes).digest('hex')}`,
)
const entry: DirectoryManifestEntry = {
  id: ManifestEntryId.make('370e8400-e29b-41d4-a716-446655440004'),
  snapshotId,
  directoryRootId: rootId,
  workspaceId,
  projectId,
  relativePath: DirectoryRelativePath.make('changed.txt'),
  status: 'included',
  byteLength: bytes.byteLength,
  contentHash: hash,
  unsupportedReason: null,
}
const currentManifest = Schema.decodeUnknownSync(DirectoryManifest)({
  snapshotId,
  directoryRootId: rootId,
  workspaceId,
  projectId,
  entries: [entry],
  digest: computeManifestDigest([entry]),
})
const job = {
  jobId: JobQueueId.make('370e8400-e29b-41d4-a716-446655440005'),
  workspaceId,
  snapshotId,
  status: 'running' as const,
  attempt: 1,
  maxAttempts: 3,
  leaseToken:
    DirectoryIngestionLeaseToken.make('370e8400-e29b-41d4-a716-446655440006'),
  leaseExpiresAt: BigInt(Date.now() + 30_000),
  nextCheckpointSequence: 1,
}
const artifact: ArtifactObject = {
  ref: hash.replace(
    'sha256:',
    'artifact://sha256/',
  ) as `artifact://sha256/${string}`,
  hash: String(hash) as `sha256:${string}`,
  byteLength: bytes.byteLength,
  mediaType: 'text/plain',
}

function store(onWrite: () => void): ArtifactStoreShape {
  return {
    writeObject: () => {
      onWrite()
      return Effect.succeed(artifact)
    },
    readObject: () => Effect.dieMessage('unused'),
    stageObject: () => Effect.dieMessage('unused'),
    readStagedObject: () => Effect.dieMessage('unused'),
  }
}

function prepared() {
  return {
    entryId: entry.id,
    sourceId: SourceId.make('370e8400-e29b-41d4-a716-446655440007'),
    sourceVersionId:
      SourceVersionId.make('370e8400-e29b-41d4-a716-446655440008'),
    artifact: {
      ref: artifact.ref,
      contentHash: entry.contentHash,
      byteLength: artifact.byteLength,
      mediaType: artifact.mediaType,
    },
    document: null,
    chunks: [],
    embeddings: [],
  }
}

const input = {
  job,
  idempotencyKey: 'refresh:worker',
  projectId,
  previousManifest: null,
  currentManifest,
}

describe('refreshClaimedDirectory', () => {
  it('persists unsupported inventory without loading or staging content', async () => {
    const unsupportedEntry: DirectoryManifestEntry = {
      ...entry,
      status: 'unsupported',
      byteLength: 0,
      contentHash: null,
      unsupportedReason: 'binary',
    }
    const unsupportedManifest = Schema.decodeUnknownSync(DirectoryManifest)({
      ...currentManifest,
      entries: [unsupportedEntry],
      digest: computeManifestDigest([unsupportedEntry]),
    })
    let loads = 0
    let writes = 0
    expect(await Effect.runPromise(refreshClaimedDirectory({
      store: store(() => writes += 1),
      loadChangedEntry: () => {
        loads += 1
        return Effect.succeed({ bytes, mediaType: 'text/plain' })
      },
      prepareChangedEntry: () => Effect.succeed(prepared()),
      commit: ({ prepared }) =>
        Effect.succeed({ preparedCount: prepared.length }),
    }, {
      ...input,
      currentManifest: unsupportedManifest,
    }))).toEqual({ preparedCount: 0 })
    expect({ loads, writes }).toEqual({ loads: 0, writes: 0 })
  })

  it('writes no artifact and never crosses the commit boundary when loading fails', async () => {
    let writes = 0
    let commits = 0
    const exit = await Effect.runPromiseExit(refreshClaimedDirectory({
      store: store(() => writes += 1),
      loadChangedEntry: () => Effect.fail('read-failed'),
      prepareChangedEntry: () => Effect.succeed(prepared()),
      commit: () => {
        commits += 1
        return Effect.succeed({ _tag: 'Committed' as const })
      },
    }, input))
    expect(exit._tag).toBe('Failure')
    expect({ writes, commits }).toEqual({ writes: 0, commits: 0 })
  })

  it('reuses staged content after a pre-commit failure and replays a post-commit acknowledgement loss', async () => {
    let writes = 0
    let attempts = 0
    let stored: { readonly _tag: 'Committed' } | undefined
    const deps = {
      store: store(() => writes += 1),
      loadChangedEntry: () =>
        Effect.succeed({ bytes, mediaType: 'text/plain' }),
      prepareChangedEntry: () => Effect.succeed(prepared()),
      commit: () => {
        attempts += 1
        if (attempts === 1) return Effect.fail('before-database-commit')
        if (stored === undefined) {
          stored = { _tag: 'Committed' }
          return Effect.fail('after-database-commit-before-ack')
        }
        return Effect.succeed({ _tag: 'Replayed' as const })
      },
    }

    expect((await Effect.runPromiseExit(
      refreshClaimedDirectory(deps, input),
    ))._tag).toBe('Failure')
    expect((await Effect.runPromiseExit(
      refreshClaimedDirectory(deps, input),
    ))._tag).toBe('Failure')
    expect(await Effect.runPromise(
      refreshClaimedDirectory(deps, input),
    )).toEqual({ _tag: 'Replayed' })
    expect({ writes, attempts }).toEqual({ writes: 3, attempts: 3 })
  })
})
