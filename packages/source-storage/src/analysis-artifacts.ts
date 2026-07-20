import { Sha256Digest, StorageWriteError } from '@struct/domain'
import { Effect } from 'effect'
/* eslint-disable no-unused-vars -- Babel's parser does not mark type-only imports as used. */
import type {
  ArtifactObject,
  ArtifactStoreShape,
} from './object-store.js'
/* eslint-enable no-unused-vars */

export interface PublishAnalysisArtifactInput {
  readonly bytes: Uint8Array
  readonly digest: typeof Sha256Digest.Type
  readonly mediaType: string
  readonly maximumBytes: number
}

/**
 * Publishes verified deterministic bytes through the existing atomic,
 * content-addressed object store. Durable metadata remains a separate commit
 * gate, so an interrupted multi-artifact job cannot expose a partial result.
 */
export const publishAnalysisArtifact = Effect.fn(
  'AnalysisArtifacts.publish',
)(function* (
  store: ArtifactStoreShape,
  input: PublishAnalysisArtifactInput,
) {
  if (
    !Number.isInteger(input.maximumBytes)
    || input.maximumBytes < 1
    || input.bytes.byteLength > input.maximumBytes
  ) {
    return yield* new StorageWriteError({
      operation: 'publishAnalysisArtifact',
      reason: 'artifact-byte-limit',
      message: 'Analysis artifact exceeds its configured byte limit',
    })
  }
  const digest = Sha256Digest.make(
    `sha256:${new Bun.CryptoHasher('sha256')
      .update(input.bytes)
      .digest('hex')}`,
  )
  if (digest !== input.digest) {
    return yield* new StorageWriteError({
      operation: 'publishAnalysisArtifact',
      reason: 'artifact-content-mismatch',
      message: 'Analysis artifact bytes do not match the expected digest',
    })
  }
  const stored = yield* store.writeObject(input.bytes, {
    mediaType: input.mediaType,
  }).pipe(
    Effect.mapError((error) =>
      error instanceof StorageWriteError
        ? error
        : new StorageWriteError({
            operation: 'publishAnalysisArtifact',
            reason: error._tag,
            message: 'Analysis artifact could not be stored',
          })),
  )
  return yield* verifyStoredArtifact(stored, input)
})

function verifyStoredArtifact(
  stored: ArtifactObject,
  input: PublishAnalysisArtifactInput,
): Effect.Effect<ArtifactObject, StorageWriteError> {
  return stored.hash === input.digest
    && stored.byteLength === input.bytes.byteLength
    && stored.mediaType === input.mediaType
    ? Effect.succeed(stored)
    : Effect.fail(new StorageWriteError({
        operation: 'publishAnalysisArtifact',
        reason: 'stored-metadata-mismatch',
        message: 'Stored analysis artifact metadata does not match its bytes',
      }))
}
