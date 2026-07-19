import {
  Sha256Digest,
  StorageWriteError,
  type DirectoryManifestEntry,
} from '@struct/domain'
import { Effect } from 'effect'
import type * as Storage from './object-store.js'

export interface WriteVersionedArtifactInput {
  readonly entry: DirectoryManifestEntry
  readonly bytes: Uint8Array
  readonly options: Storage.ArtifactWriteOptions
}

/**
 * Writes one immutable object only when the bytes match the manifest produced
 * by sandboxed discovery. The underlying store deduplicates retries by digest.
 */
export const writeVersionedArtifact = Effect.fn('writeVersionedArtifact')(
  function* (
    store: Storage.ArtifactStoreShape,
    input: WriteVersionedArtifactInput,
  ) {
    if (input.entry.status !== 'included' || input.entry.contentHash === null) {
      return yield* new StorageWriteError({
        operation: 'writeVersionedArtifact',
        reason: 'unsupported-entry',
        message: 'Only included manifest entries can produce versioned artifacts',
      })
    }
    const actual = Sha256Digest.make(
      `sha256:${new Bun.CryptoHasher('sha256').update(input.bytes).digest('hex')}`,
    )
    if (
      actual !== input.entry.contentHash
      || input.bytes.byteLength !== input.entry.byteLength
    ) {
      return yield* new StorageWriteError({
        operation: 'writeVersionedArtifact',
        reason: 'manifest-content-mismatch',
        message: 'Artifact bytes do not match the immutable manifest entry',
      })
    }
    return yield* store.writeObject(input.bytes, input.options).pipe(
      Effect.mapError((error) =>
        error instanceof StorageWriteError
          ? error
          : new StorageWriteError({
              operation: 'writeVersionedArtifact',
              reason: error._tag,
              message: 'Versioned artifact could not be stored',
            })),
    )
  },
)
