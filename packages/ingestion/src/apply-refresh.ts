import {
  type DirectoryIngestionJob,
  type DirectoryManifest,
  type DirectoryManifestEntry,
  type Document,
  type DocumentChunk,
  type ProjectId,
  type SourceId,
  type SourceVersionId,
} from '@struct/domain'
import {
  writeVersionedArtifact,
  type ArtifactObject,
  type ArtifactStoreShape,
} from '@struct/source-storage'
import { Effect, Option } from 'effect'
import { diffManifest } from './diff-manifest.js'

export interface PreparedRefreshEntry {
  readonly entryId: DirectoryManifestEntry['id']
  readonly sourceId: typeof SourceId.Type
  readonly sourceVersionId: typeof SourceVersionId.Type
  readonly artifact: {
    readonly ref: ArtifactObject['ref']
    readonly contentHash: DirectoryManifestEntry['contentHash']
    readonly byteLength: number
    readonly mediaType: string
  }
  readonly document: Document | null
  readonly chunks: ReadonlyArray<DocumentChunk>
  readonly embeddings: ReadonlyArray<{
    readonly chunkId: DocumentChunk['id']
    readonly embeddingModel: string
    readonly values: ReadonlyArray<number>
  }>
}

export interface ApplyDirectoryRefreshInput {
  readonly job: DirectoryIngestionJob
  readonly idempotencyKey: string
  readonly projectId: typeof ProjectId.Type
  readonly previousManifest: DirectoryManifest | null
  readonly currentManifest: DirectoryManifest
}

export interface ApplyDirectoryRefreshDeps<Result, Error, PrepareError> {
  readonly store: ArtifactStoreShape
  readonly loadChangedEntry: (
    entry: DirectoryManifestEntry,
  ) => Effect.Effect<{
    readonly bytes: Uint8Array
    readonly mediaType: string
  }, Error>
  readonly prepareChangedEntry: (
    entry: DirectoryManifestEntry,
    artifact: ArtifactObject,
  ) => Effect.Effect<PreparedRefreshEntry, PrepareError>
  readonly commit: (
    input: ApplyDirectoryRefreshInput & {
      readonly prepared: ReadonlyArray<PreparedRefreshEntry>
    },
  ) => Effect.Effect<Result, Error>
}

/**
 * The single deterministic refresh path: diff, stage only changed content,
 * prepare derived records, then cross the atomic persistence boundary once.
 */
export const applyDirectoryRefresh = Effect.fn('applyDirectoryRefresh')(
  function* <Result, Error, PrepareError>(
    deps: ApplyDirectoryRefreshDeps<Result, Error, PrepareError>,
    input: ApplyDirectoryRefreshInput,
  ) {
    const plan = diffManifest(input.previousManifest, input.currentManifest)
    const changed = plan.filter((item) =>
      (item.disposition === 'added' || item.disposition === 'modified')
      && Option.isSome(item.current)
      && item.current.value.status === 'included')
    const prepared = yield* Effect.forEach(
      changed,
      (item) =>
        Effect.gen(function* () {
          if (Option.isNone(item.current)) {
            return yield* Effect.dieMessage(
              'Manifest diff invariant failed: changed entry is missing',
            )
          }
          const entry = item.current.value
          const loaded = yield* deps.loadChangedEntry(entry)
          const artifact = yield* writeVersionedArtifact(deps.store, {
            entry,
            bytes: loaded.bytes,
            options: { mediaType: loaded.mediaType },
          })
          return yield* deps.prepareChangedEntry(entry, artifact)
        }),
      { concurrency: 4 },
    )
    return yield* deps.commit({ ...input, prepared })
  },
)
