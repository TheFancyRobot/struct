import { Effect, Schema } from 'effect'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import { DirectoryRelativePath } from '@struct/domain'
import { DirectoryPathError } from './directory-errors.js'

export interface ResolvedDirectoryPath {
  readonly absolutePath: string
  readonly relativePath: DirectoryRelativePath | null
}

function isOutside(root: string, candidate: string): boolean {
  const difference = relative(root, candidate)
  return difference === '..'
    || difference.startsWith(`..${sep}`)
    || isAbsolute(difference)
}

export const resolveRegisteredDirectoryPath = Effect.fn(
  'resolveRegisteredDirectoryPath',
)(function* (
  canonicalRoot: string,
  candidate: string,
): Effect.fn.Return<ResolvedDirectoryPath, DirectoryPathError> {
  if (candidate === '' || candidate === '.') {
    return { absolutePath: canonicalRoot, relativePath: null }
  }
  if (isAbsolute(candidate)) {
    return yield* new DirectoryPathError({
      relativePath: candidate,
      reason: 'absolute',
      message: 'Directory scan paths must be relative to the registered root',
    })
  }

  const relativePath = yield* Schema.decodeUnknown(DirectoryRelativePath)(candidate).pipe(
    Effect.mapError(() =>
      new DirectoryPathError({
        relativePath: candidate,
        reason: candidate.split(/[\\/]/).includes('..') ? 'traversal' : 'invalid',
        message: 'Directory scan path is not a canonical root-relative path',
      })),
  )
  const absolutePath = resolve(canonicalRoot, relativePath)
  if (isOutside(canonicalRoot, absolutePath)) {
    return yield* new DirectoryPathError({
      relativePath: candidate,
      reason: 'outside-root',
      message: 'Directory scan path escapes the registered root',
    })
  }
  return { absolutePath, relativePath }
})

export function isCanonicalPathContained(
  canonicalRoot: string,
  canonicalCandidate: string,
): boolean {
  return !isOutside(canonicalRoot, canonicalCandidate)
}
