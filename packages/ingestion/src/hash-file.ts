import { Effect } from 'effect'
import { Sha256Digest } from '@struct/domain'
import {
  DirectoryEntryDisappearedError,
  DirectoryFilesystemError,
  DirectoryLimitExceededError,
  DirectoryPermissionError,
} from './directory-errors.js'

export type FileReadError =
  | DirectoryPermissionError
  | DirectoryEntryDisappearedError
  | DirectoryFilesystemError

export interface HashFileInput {
  readonly relativePath: import('@struct/domain').DirectoryRelativePath
  readonly expectedByteLength: number
  readonly maxBytes: number
  readonly read: Effect.Effect<AsyncIterable<Uint8Array>, FileReadError>
}

export interface HashedFile {
  readonly contentHash: Sha256Digest
  readonly byteLength: number
}

export const hashFile = Effect.fn('hashFile')(function* (
  input: HashFileInput,
): Effect.fn.Return<HashedFile, FileReadError | DirectoryLimitExceededError> {
  if (input.expectedByteLength > input.maxBytes) {
    return yield* new DirectoryLimitExceededError({
      limit: 'file-bytes',
      maximum: input.maxBytes,
      observed: input.expectedByteLength,
      relativePath: input.relativePath,
      message: 'File exceeds the configured hashing byte limit',
    })
  }

  const stream = yield* input.read
  return yield* Effect.tryPromise({
    try: async () => {
      const hasher = new Bun.CryptoHasher('sha256')
      let byteLength = 0
      for await (const chunk of stream) {
        byteLength += chunk.byteLength
        if (byteLength > input.maxBytes) {
          throw new DirectoryLimitExceededError({
            limit: 'file-bytes',
            maximum: input.maxBytes,
            observed: byteLength,
            relativePath: input.relativePath,
            message: 'File grew beyond the configured hashing byte limit',
          })
        }
        hasher.update(chunk)
      }
      if (byteLength !== input.expectedByteLength) {
        throw new DirectoryFilesystemError({
          relativePath: input.relativePath,
          operation: 'read-file',
          message: 'File size changed while it was being hashed',
        })
      }
      return {
        contentHash: Sha256Digest.make(`sha256:${hasher.digest('hex')}`),
        byteLength,
      }
    },
    catch: (cause) =>
      cause instanceof DirectoryLimitExceededError
        || cause instanceof DirectoryPermissionError
        || cause instanceof DirectoryEntryDisappearedError
        || cause instanceof DirectoryFilesystemError
        ? cause
        : new DirectoryFilesystemError({
            relativePath: input.relativePath,
            operation: 'read-file',
            message: 'File content could not be hashed',
          }),
  })
})
