import { Context, Effect, Layer, Schema } from 'effect'
import { constants } from 'node:fs'
import { lstat, open, readdir, realpath } from 'node:fs/promises'
import { resolve } from 'node:path'
import {
  DirectoryManifest,
  DirectoryManifestEntry,
  DirectoryRelativePath,
  ManifestEntryId,
  computeManifestDigest,
  orderManifestEntries,
  type DirectoryRootId,
  type DirectorySnapshotId,
  type ProjectId,
  type WorkspaceId,
} from '@struct/domain'
import {
  DirectoryEntryDisappearedError,
  DirectoryFilesystemError,
  DirectoryLimitExceededError,
  DirectoryPathError,
  DirectoryPermissionError,
  DirectoryRootError,
  DirectorySymlinkError,
  type DirectoryEntryError,
} from './directory-errors.js'
import { hashFile } from './hash-file.js'
import { supportedTextSourceExtensionFor } from './file-classifier.js'
import {
  isCanonicalPathContained,
  resolveRegisteredDirectoryPath,
} from './path-safety.js'

export interface DirectoryFileInfo {
  readonly kind: 'file' | 'directory' | 'symlink' | 'other'
  readonly byteLength: number
  readonly canonicalPath: string | null
}

export interface DirectoryFileSystemShape {
  readonly inspect: (
    absolutePath: string,
    relativePath: DirectoryRelativePath | null,
  ) => Effect.Effect<
    DirectoryFileInfo,
    DirectoryPermissionError | DirectoryEntryDisappearedError | DirectoryFilesystemError
  >
  readonly readDirectory: (
    absolutePath: string,
    relativePath: DirectoryRelativePath | null,
  ) => Effect.Effect<
    ReadonlyArray<string>,
    DirectoryPermissionError | DirectoryEntryDisappearedError | DirectoryFilesystemError
  >
  readonly readFile: (
    absolutePath: string,
    relativePath: DirectoryRelativePath,
    canonicalRoot: string,
  ) => Effect.Effect<
    AsyncIterable<Uint8Array>,
    DirectoryPermissionError | DirectoryEntryDisappearedError | DirectoryFilesystemError
  >
}

// eslint-disable-next-line no-restricted-syntax -- Runtime-injected filesystem infrastructure boundary.
export class DirectoryFileSystem extends Context.Tag(
  '@struct/ingestion/DirectoryFileSystem',
)<DirectoryFileSystem, DirectoryFileSystemShape>() {}

type FileOperation = 'inspect' | 'read-directory' | 'read-file'

function mapFilesystemError(
  relativePath: DirectoryRelativePath | null,
  operation: FileOperation,
  cause: unknown,
): DirectoryPermissionError | DirectoryEntryDisappearedError | DirectoryFilesystemError {
  const safePath = relativePath ?? '<root>'
  const code = cause instanceof Error && 'code' in cause
    ? String(cause.code)
    : ''
  if (code === 'EACCES' || code === 'EPERM') {
    return new DirectoryPermissionError({
      relativePath: relativePath ?? DirectoryRelativePath.make('.root'),
      operation,
      message: 'Directory entry permission was denied',
    })
  }
  if (code === 'ENOENT') {
    return new DirectoryEntryDisappearedError({
      relativePath: relativePath ?? DirectoryRelativePath.make('.root'),
      operation,
      message: 'Directory entry disappeared during discovery',
    })
  }
  return new DirectoryFilesystemError({
    relativePath: safePath,
    operation,
    message: 'Directory entry could not be accessed',
  })
}

export const BunDirectoryFileSystemShape: DirectoryFileSystemShape = {
  inspect: (absolutePath, relativePath) =>
    Effect.tryPromise({
      try: async (): Promise<DirectoryFileInfo> => {
        const info = await lstat(absolutePath)
        const kind = info.isSymbolicLink()
          ? 'symlink'
          : info.isDirectory()
            ? 'directory'
            : info.isFile()
              ? 'file'
              : 'other'
        return {
          kind,
          byteLength: info.size,
          canonicalPath: kind === 'symlink' ? null : await realpath(absolutePath),
        }
      },
      catch: (cause) => mapFilesystemError(relativePath, 'inspect', cause),
    }),
  readDirectory: (absolutePath, relativePath) =>
    Effect.tryPromise({
      try: () => readdir(absolutePath),
      catch: (cause) => mapFilesystemError(relativePath, 'read-directory', cause),
    }),
  readFile: (absolutePath, relativePath, canonicalRoot) =>
    Effect.tryPromise({
      try: async () => {
        const handle = await open(
          absolutePath,
          constants.O_RDONLY | constants.O_NOFOLLOW,
        )
        try {
          const [openedInfo, currentInfo, canonicalPath] = await Promise.all([
            handle.stat(),
            lstat(absolutePath),
            realpath(absolutePath),
          ])
          if (
            !currentInfo.isFile()
            || currentInfo.isSymbolicLink()
            || openedInfo.dev !== currentInfo.dev
            || openedInfo.ino !== currentInfo.ino
            || !isCanonicalPathContained(canonicalRoot, canonicalPath)
          ) {
            throw new DirectoryFilesystemError({
              relativePath,
              operation: 'read-file',
              message: 'File ownership changed before hashing began',
            })
          }
        } catch (cause) {
          await handle.close()
          throw cause
        }
        return (async function* (): AsyncGenerator<Uint8Array> {
          try {
            const buffer = new Uint8Array(64 * 1_024)
            while (true) {
              const { bytesRead } = await handle.read(
                buffer,
                0,
                buffer.byteLength,
                null,
              )
              if (bytesRead === 0) return
              yield buffer.slice(0, bytesRead)
            }
          } catch (cause) {
            throw cause instanceof DirectoryPermissionError
              || cause instanceof DirectoryEntryDisappearedError
              || cause instanceof DirectoryFilesystemError
              ? cause
              : mapFilesystemError(relativePath, 'read-file', cause)
          } finally {
            await handle.close()
          }
        })()
      },
      catch: (cause) =>
        cause instanceof DirectoryFilesystemError
          ? cause
          : mapFilesystemError(relativePath, 'read-file', cause),
    }),
}

export const BunDirectoryFileSystem = Layer.succeed(
  DirectoryFileSystem,
  BunDirectoryFileSystemShape,
)

export interface DirectoryDiscoveryLimits {
  readonly maxDepth: number
  readonly maxEntries: number
  readonly maxFileBytes: number
  readonly maxAggregateBytes: number
}

export interface DiscoverDirectoryInput {
  readonly registeredRoot: string
  readonly startPath?: string
  readonly workspaceId: WorkspaceId
  readonly projectId: ProjectId
  readonly directoryRootId: DirectoryRootId
  readonly snapshotId: DirectorySnapshotId
  readonly limits: DirectoryDiscoveryLimits
  readonly ignoredNames?: ReadonlyArray<string>
}

export interface DirectoryEntrySuccess {
  readonly _tag: 'DirectoryEntrySuccess'
  readonly relativePath: DirectoryRelativePath
  readonly entry: DirectoryManifestEntry
}

export interface DirectoryEntryFailure {
  readonly _tag: 'DirectoryEntryFailure'
  readonly relativePath: DirectoryRelativePath
  readonly error: DirectoryEntryError
}

export type DirectoryDiscoveryOutcome = DirectoryEntrySuccess | DirectoryEntryFailure

export interface DirectoryDiscoveryResult {
  readonly manifest: DirectoryManifest
  readonly outcomes: ReadonlyArray<DirectoryDiscoveryOutcome>
  readonly aggregateHashedBytes: number
}

const defaultIgnoredNames = ['.git', 'node_modules'] as const

function isSupportedFile(relativePath: DirectoryRelativePath): boolean {
  return supportedTextSourceExtensionFor(relativePath) !== null
}

function deterministicEntryId(
  snapshotId: DirectorySnapshotId,
  relativePath: DirectoryRelativePath,
): ManifestEntryId {
  const digest = new Bun.CryptoHasher('sha256')
    .update(`${snapshotId}\0${relativePath}`)
    .digest('hex')
  const uuid = `${digest.slice(0, 8)}-${digest.slice(8, 12)}-5${digest.slice(13, 16)}-a${digest.slice(17, 20)}-${digest.slice(20, 32)}`
  return ManifestEntryId.make(uuid)
}

function validateLimits(
  limits: DirectoryDiscoveryLimits,
): Effect.Effect<void, DirectoryLimitExceededError> {
  for (const [limit, value] of [
    ['depth', limits.maxDepth],
    ['entries', limits.maxEntries],
    ['file-bytes', limits.maxFileBytes],
    ['aggregate-bytes', limits.maxAggregateBytes],
  ] as const) {
    if (!Number.isSafeInteger(value) || value < 0) {
      return Effect.fail(new DirectoryLimitExceededError({
        limit,
        maximum: value,
        observed: value,
        relativePath: null,
        message: 'Directory discovery limits must be non-negative safe integers',
      }))
    }
  }
  return Effect.void
}

function rootError(
  cause: DirectoryPermissionError | DirectoryEntryDisappearedError | DirectoryFilesystemError,
): DirectoryRootError {
  return new DirectoryRootError({
    reason: cause._tag === 'DirectoryEntryDisappearedError' ? 'missing' : 'inspection-failed',
    message: 'Registered directory root could not be inspected',
  })
}

export class DirectoryDiscovery extends Effect.Service<DirectoryDiscovery>()(
  'DirectoryDiscovery',
  {
    accessors: true,
    effect: Effect.gen(function* () {
      const fileSystem = yield* DirectoryFileSystem

      const discover = Effect.fn('DirectoryDiscovery.discover')(function* (
        input: DiscoverDirectoryInput,
      ): Effect.fn.Return<
        DirectoryDiscoveryResult,
        import('./directory-errors.js').DirectoryDiscoveryError
      > {
        yield* validateLimits(input.limits)
        const rootPath = resolve(input.registeredRoot)
        const rootInfo = yield* fileSystem.inspect(rootPath, null).pipe(
          Effect.mapError(rootError),
        )
        if (rootInfo.kind === 'symlink') {
          return yield* new DirectoryRootError({
            reason: 'symlink',
            message: 'Registered directory root must not be a symlink',
          })
        }
        if (rootInfo.kind !== 'directory' || rootInfo.canonicalPath === null) {
          return yield* new DirectoryRootError({
            reason: 'not-directory',
            message: 'Registered directory root must be a directory',
          })
        }
        const canonicalRoot = rootInfo.canonicalPath
        const start = yield* resolveRegisteredDirectoryPath(
          canonicalRoot,
          input.startPath ?? '.',
        )
        const startInfo = start.relativePath === null
          ? rootInfo
          : yield* fileSystem.inspect(start.absolutePath, start.relativePath)
        if (
          startInfo.kind !== 'directory'
          || startInfo.canonicalPath === null
          || !isCanonicalPathContained(canonicalRoot, startInfo.canonicalPath)
        ) {
          return yield* new DirectoryPathError({
            relativePath: input.startPath ?? '.',
            reason: 'outside-root',
            message: 'Directory scan start path is not a contained directory',
          })
        }

        const ignoredNames = new Set(input.ignoredNames ?? defaultIgnoredNames)
        const outcomes: DirectoryDiscoveryOutcome[] = []
        let entryCount = 0
        let aggregateHashedBytes = 0

        const visit = Effect.fn('DirectoryDiscovery.visit')(function* (
          absoluteDirectory: string,
          directoryRelativePath: DirectoryRelativePath | null,
          depth: number,
        ): Effect.fn.Return<
          void,
          import('./directory-errors.js').DirectoryDiscoveryError
        > {
          if (depth > input.limits.maxDepth) {
            return yield* new DirectoryLimitExceededError({
              limit: 'depth',
              maximum: input.limits.maxDepth,
              observed: depth,
              relativePath: directoryRelativePath,
              message: 'Directory discovery exceeded the configured depth limit',
            })
          }
          const readResult = yield* Effect.either(fileSystem.readDirectory(
            absoluteDirectory,
            directoryRelativePath,
          ))
          if (readResult._tag === 'Left') {
            if (directoryRelativePath === null) return yield* readResult.left
            outcomes.push({
              _tag: 'DirectoryEntryFailure',
              relativePath: directoryRelativePath,
              error: readResult.left,
            })
            return
          }
          const names = Array.from(readResult.right)
          names.sort((left, right) =>
            Buffer.from(left, 'utf8').compare(Buffer.from(right, 'utf8')))

          for (const name of names) {
            if (ignoredNames.has(name)) continue
            const rawRelativePath = directoryRelativePath === null
              ? name
              : `${directoryRelativePath}/${name}`
            const resolvedPath = yield* resolveRegisteredDirectoryPath(
              canonicalRoot,
              rawRelativePath,
            )
            if (resolvedPath.relativePath === null) continue
            const relativePath = resolvedPath.relativePath
            entryCount += 1
            if (entryCount > input.limits.maxEntries) {
              return yield* new DirectoryLimitExceededError({
                limit: 'entries',
                maximum: input.limits.maxEntries,
                observed: entryCount,
                relativePath,
                message: 'Directory discovery exceeded the configured entry-count limit',
              })
            }

            const infoResult = yield* Effect.either(
              fileSystem.inspect(resolvedPath.absolutePath, relativePath),
            )
            if (infoResult._tag === 'Left') {
              outcomes.push({
                _tag: 'DirectoryEntryFailure',
                relativePath,
                error: infoResult.left,
              })
              continue
            }
            const info = infoResult.right
            if (info.kind === 'symlink') {
              outcomes.push({
                _tag: 'DirectoryEntryFailure',
                relativePath,
                error: new DirectorySymlinkError({
                  relativePath,
                  message: 'Symbolic links are rejected by directory discovery',
                }),
              })
              continue
            }
            if (
              info.canonicalPath === null
              || !isCanonicalPathContained(canonicalRoot, info.canonicalPath)
            ) {
              return yield* new DirectoryPathError({
                relativePath,
                reason: 'outside-root',
                message: 'Directory entry canonical path escapes the registered root',
              })
            }
            if (info.kind === 'directory') {
              yield* visit(resolvedPath.absolutePath, relativePath, depth + 1)
              continue
            }

            const entryBase = {
              id: deterministicEntryId(input.snapshotId, relativePath),
              snapshotId: input.snapshotId,
              directoryRootId: input.directoryRootId,
              workspaceId: input.workspaceId,
              projectId: input.projectId,
              relativePath,
              byteLength: info.byteLength,
            }
            if (info.kind !== 'file' || !isSupportedFile(relativePath)) {
              const entry = yield* Schema.decodeUnknown(DirectoryManifestEntry)({
                ...entryBase,
                status: 'unsupported',
                contentHash: null,
                unsupportedReason: info.kind === 'file'
                  ? 'extension is not supported'
                  : 'filesystem entry type is not supported',
              }).pipe(Effect.orDie)
              outcomes.push({ _tag: 'DirectoryEntrySuccess', relativePath, entry })
              continue
            }
            if (info.byteLength > input.limits.maxFileBytes) {
              return yield* new DirectoryLimitExceededError({
                limit: 'file-bytes',
                maximum: input.limits.maxFileBytes,
                observed: info.byteLength,
                relativePath,
                message: 'File exceeds the configured hashing byte limit',
              })
            }
            if (
              aggregateHashedBytes + info.byteLength
              > input.limits.maxAggregateBytes
            ) {
              return yield* new DirectoryLimitExceededError({
                limit: 'aggregate-bytes',
                maximum: input.limits.maxAggregateBytes,
                observed: aggregateHashedBytes + info.byteLength,
                relativePath,
                message: 'Directory discovery exceeded the aggregate hashing byte limit',
              })
            }

            const hashResult = yield* Effect.either(hashFile({
              relativePath,
              expectedByteLength: info.byteLength,
              maxBytes: input.limits.maxFileBytes,
              read: fileSystem.readFile(
                resolvedPath.absolutePath,
                relativePath,
                canonicalRoot,
              ),
            }))
            if (hashResult._tag === 'Left') {
              if (hashResult.left._tag === 'DirectoryLimitExceededError') {
                return yield* hashResult.left
              }
              outcomes.push({
                _tag: 'DirectoryEntryFailure',
                relativePath,
                error: hashResult.left,
              })
              continue
            }
            aggregateHashedBytes += hashResult.right.byteLength
            const entry = yield* Schema.decodeUnknown(DirectoryManifestEntry)({
              ...entryBase,
              byteLength: hashResult.right.byteLength,
              status: 'included',
              contentHash: hashResult.right.contentHash,
              unsupportedReason: null,
            }).pipe(Effect.orDie)
            outcomes.push({ _tag: 'DirectoryEntrySuccess', relativePath, entry })
          }
        })

        yield* visit(start.absolutePath, start.relativePath, 0)
        const entries = orderManifestEntries(
          outcomes.flatMap((outcome) =>
            outcome._tag === 'DirectoryEntrySuccess' ? [outcome.entry] : []),
        )
        const manifest = yield* Schema.decodeUnknown(DirectoryManifest)({
          snapshotId: input.snapshotId,
          directoryRootId: input.directoryRootId,
          workspaceId: input.workspaceId,
          projectId: input.projectId,
          digest: computeManifestDigest(entries),
          entries,
        }).pipe(Effect.orDie)
        return {
          manifest,
          outcomes: outcomes.sort((left, right) =>
            Buffer.from(left.relativePath, 'utf8')
              .compare(Buffer.from(right.relativePath, 'utf8'))),
          aggregateHashedBytes,
        }
      })

      return { discover }
    }),
  },
) {}
