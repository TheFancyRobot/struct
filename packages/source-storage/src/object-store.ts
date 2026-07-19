import { Context, Effect, Layer } from 'effect'
import { createHash, randomUUID } from 'node:crypto'
import {
  lstat,
  link,
  mkdir,
  readFile,
  realpath,
  rename,
  rm,
  unlink,
  writeFile,
} from 'node:fs/promises'
import { basename, isAbsolute, join, relative, resolve, sep } from 'node:path'
import {
  isCanonicalStagedArtifactRef,
  StorageConfigurationError,
  StoragePathError,
  StorageReadError,
  StorageWriteError,
} from '@struct/domain'

export { StorageConfigurationError, StoragePathError, StorageReadError, StorageWriteError }

export type ArtifactRef = `artifact://sha256/${string}`
export type StagedArtifactRef = `staged://${string}/${string}`

export interface ArtifactWriteOptions {
  readonly mediaType: string
}

export interface ArtifactObject {
  readonly ref: ArtifactRef
  readonly hash: `sha256:${string}`
  readonly byteLength: number
  readonly mediaType: string
}

export interface StagedArtifact {
  readonly ref: StagedArtifactRef
  readonly byteLength: number
}

export interface StoredBytes {
  readonly bytes: Uint8Array
  readonly byteLength: number
}

export interface ArtifactStoreShape {
  readonly writeObject: (bytes: Uint8Array, options: ArtifactWriteOptions) => Effect.Effect<ArtifactObject, StoragePathError | StorageWriteError, never>
  readonly readObject: (ref: ArtifactRef) => Effect.Effect<StoredBytes, StoragePathError | StorageReadError, never>
  readonly stageObject: (name: string, bytes: Uint8Array, options: ArtifactWriteOptions) => Effect.Effect<StagedArtifact, StoragePathError | StorageWriteError, never>
  readonly readStagedObject: (ref: StagedArtifactRef) => Effect.Effect<StoredBytes, StoragePathError | StorageReadError, never>
}

// eslint-disable-next-line no-restricted-syntax -- Infrastructure boundary for a filesystem artifact-store resource.
export class ArtifactStore extends Context.Tag('@struct/source-storage/ArtifactStore')<
  ArtifactStore,
  ArtifactStoreShape
>() {}

export interface LocalArtifactStoreConfig {
  readonly root: string
}

const hashBytes = (bytes: Uint8Array): `sha256:${string}` =>
  `sha256:${createHash('sha256').update(bytes).digest('hex')}`

const sanitizeReason = (cause: unknown): string => {
  if (cause instanceof Error) return cause.message.replaceAll(process.cwd(), '<project>')
  return String(cause).replaceAll(process.cwd(), '<project>')
}

const validateRefText = (ref: string): Effect.Effect<void, StoragePathError, never> => {
  if (ref.includes('\0')) {
    return Effect.fail(new StoragePathError({ ref: '<nul>', reason: 'nul-byte', message: 'Artifact ref contains a NUL byte' }))
  }
  if (isAbsolute(ref) || ref.includes('..') || ref.includes('\\')) {
    return Effect.fail(new StoragePathError({ ref, reason: 'unsafe-ref', message: 'Artifact ref is not a safe logical ref' }))
  }
  return Effect.void
}

function ensureContained(root: string, candidate: string, ref: string): Effect.Effect<string, StoragePathError, never> {
  const resolved = resolve(candidate)
  const rel = relative(root, resolved)
  if (rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))) {
    return Effect.succeed(resolved)
  }
  return Effect.fail(new StoragePathError({ ref, reason: 'out-of-root', message: 'Artifact path escapes the storage root' }))
}

function artifactPath(root: string, ref: ArtifactRef): Effect.Effect<string, StoragePathError, never> {
  return Effect.gen(function* () {
    yield* validateRefText(ref)
    const match = /^artifact:\/\/sha256\/([a-f0-9]{64})$/.exec(ref)
    if (!match) {
      return yield* new StoragePathError({ ref, reason: 'malformed-ref', message: 'Artifact ref is malformed' })
    }
    const digest = match[1]
    return yield* ensureContained(root, join(root, 'objects', 'sha256', digest.slice(0, 2), digest), ref)
  })
}

function stagedPath(root: string, ref: StagedArtifactRef): Effect.Effect<string, StoragePathError, never> {
  return Effect.gen(function* () {
    yield* validateRefText(ref)
    if (!isCanonicalStagedArtifactRef(ref)) {
      return yield* new StoragePathError({ ref, reason: 'malformed-ref', message: 'Staged artifact ref is malformed' })
    }
    const match = /^staged:\/\/([^/]+)\/([^/]+)$/.exec(ref)
    if (match === null) {
      return yield* new StoragePathError({ ref, reason: 'malformed-ref', message: 'Staged artifact ref is malformed' })
    }
    return yield* ensureContained(root, join(root, 'staging', match[1], match[2]), ref)
  })
}

class UnsafeStoragePath extends Error {
  readonly reason: string

  constructor(
    reason: string,
    message: string,
  ) {
    super(message)
    this.reason = reason
  }
}

function containedSegments(root: string, target: string): ReadonlyArray<string> {
  const resolved = resolve(target)
  const rel = relative(root, resolved)
  if (rel === '' || rel === '.') return []
  if (rel.startsWith('..') || isAbsolute(rel)) {
    throw new UnsafeStoragePath('out-of-root', 'Artifact path escapes the storage root')
  }
  return rel.split(sep).filter(Boolean)
}

async function inspectContainedComponent(
  root: string,
  candidate: string,
  options: { readonly directory: boolean },
): Promise<void> {
  const info = await lstat(candidate)
  if (info.isSymbolicLink()) {
    throw new UnsafeStoragePath('symlink', 'Symlink artifact paths are rejected')
  }
  if (options.directory ? !info.isDirectory() : !info.isFile()) {
    throw new UnsafeStoragePath('unsafe-path-type', 'Artifact path has an unexpected filesystem type')
  }
  const canonical = await realpath(candidate)
  const rel = relative(root, canonical)
  if (rel.startsWith('..') || isAbsolute(rel)) {
    throw new UnsafeStoragePath('out-of-root', 'Artifact path escapes the storage root')
  }
}

async function ensureSafeDirectoryPath(root: string, target: string): Promise<void> {
  const segments = containedSegments(root, target)
  let current = root
  for (const segment of segments) {
    current = join(current, segment)
    try {
      await inspectContainedComponent(root, current, { directory: true })
    } catch (cause) {
      if (cause instanceof UnsafeStoragePath) throw cause
      if ((cause as NodeJS.ErrnoException).code !== 'ENOENT') throw cause
      try {
        await mkdir(current)
      } catch (mkdirCause) {
        if ((mkdirCause as NodeJS.ErrnoException).code !== 'EEXIST') throw mkdirCause
      }
      await inspectContainedComponent(root, current, { directory: true })
    }
  }
}

async function assertSafeExistingPath(root: string, target: string): Promise<void> {
  const segments = containedSegments(root, target)
  let current = root
  for (const [index, segment] of segments.entries()) {
    current = join(current, segment)
    try {
      await inspectContainedComponent(root, current, { directory: index < segments.length - 1 })
    } catch (cause) {
      if (cause instanceof UnsafeStoragePath) throw cause
      if ((cause as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new UnsafeStoragePath('missing', 'Artifact path does not exist')
      }
      throw cause
    }
  }
}

const mapUnsafeStoragePath = (ref: string, cause: unknown): StoragePathError =>
  cause instanceof UnsafeStoragePath
    ? new StoragePathError({ ref, reason: cause.reason, message: cause.message })
    : new StoragePathError({ ref, reason: 'filesystem-inspection-failed', message: 'Artifact path cannot be inspected safely' })

const ensureSafeDirectory = (root: string, target: string, ref: string): Effect.Effect<void, StoragePathError, never> =>
  Effect.tryPromise({
    try: () => ensureSafeDirectoryPath(root, target),
    catch: (cause) => mapUnsafeStoragePath(ref, cause),
  })

const assertSafePath = (root: string, target: string, ref: string): Effect.Effect<void, StoragePathError, never> =>
  Effect.tryPromise({
    try: () => assertSafeExistingPath(root, target),
    catch: (cause) => mapUnsafeStoragePath(ref, cause),
  })

async function ensureStorageDirectory(root: string, relativePath: string): Promise<void> {
  try {
    await ensureSafeDirectoryPath(root, join(root, relativePath))
  } catch (cause) {
    if (cause instanceof UnsafeStoragePath) {
      throw new StorageConfigurationError({
        reason: cause.reason,
        message: `ARTIFACT_STORAGE_ROOT contains an unsafe ${cause.reason} subdirectory`,
      })
    }
    throw cause
  }
}

async function validateRoot(root: string): Promise<string> {
  if (root.includes('\0')) {
    throw new StorageConfigurationError({ reason: 'nul-byte', message: 'ARTIFACT_STORAGE_ROOT contains a NUL byte' })
  }
  const resolved = resolve(root)
  await mkdir(resolved, { recursive: true })
  const info = await lstat(resolved)
  if (!info.isDirectory()) {
    throw new StorageConfigurationError({ reason: 'not-directory', message: 'ARTIFACT_STORAGE_ROOT must be a directory' })
  }
  if (info.isSymbolicLink()) {
    throw new StorageConfigurationError({ reason: 'symlink-root', message: 'ARTIFACT_STORAGE_ROOT must not be a symlink' })
  }
  const canonical = await realpath(resolved)
  const testPath = join(canonical, `.write-test-${randomUUID()}`)
  await writeFile(testPath, new Uint8Array())
  await unlink(testPath)
  await ensureStorageDirectory(canonical, join('objects', 'sha256'))
  await ensureStorageDirectory(canonical, 'tmp')
  await ensureStorageDirectory(canonical, 'staging')
  return canonical
}

function makeStore(canonicalRoot: string): ArtifactStoreShape {
  const readObject = (ref: ArtifactRef): Effect.Effect<StoredBytes, StoragePathError | StorageReadError, never> =>
    Effect.gen(function* () {
      const objectPath = yield* artifactPath(canonicalRoot, ref)
      yield* assertSafePath(canonicalRoot, objectPath, ref)
      const bytes = yield* Effect.tryPromise({
        try: () => readFile(objectPath),
        catch: (cause) => new StorageReadError({ ref, reason: sanitizeReason(cause), message: 'Artifact could not be read' }),
      })
      return { bytes: new Uint8Array(bytes), byteLength: bytes.byteLength }
    })

  const readStagedObject = (ref: StagedArtifactRef): Effect.Effect<StoredBytes, StoragePathError | StorageReadError, never> =>
    Effect.gen(function* () {
      const objectPath = yield* stagedPath(canonicalRoot, ref)
      yield* assertSafePath(canonicalRoot, objectPath, ref)
      const bytes = yield* Effect.tryPromise({
        try: () => readFile(objectPath),
        catch: (cause) => new StorageReadError({ ref, reason: sanitizeReason(cause), message: 'Staged artifact could not be read' }),
      })
      return { bytes: new Uint8Array(bytes), byteLength: bytes.byteLength }
    })

  const writeObject = (bytes: Uint8Array, options: ArtifactWriteOptions): Effect.Effect<ArtifactObject, StoragePathError | StorageWriteError, never> =>
    Effect.gen(function* () {
      const hash = hashBytes(bytes)
      const digest = hash.slice('sha256:'.length)
      const ref = `artifact://sha256/${digest}` as ArtifactRef
      const dest = yield* artifactPath(canonicalRoot, ref)
      const dir = dest.slice(0, dest.lastIndexOf(sep))
      const tmpDir = join(canonicalRoot, 'tmp')
      const tmp = join(canonicalRoot, 'tmp', `.object-${randomUUID()}`)
      yield* ensureContained(canonicalRoot, tmp, ref)
      yield* ensureSafeDirectory(canonicalRoot, dir, ref)
      yield* ensureSafeDirectory(canonicalRoot, tmpDir, ref)
      const existingInfo = yield* Effect.tryPromise({
        try: async () => {
          try {
            await assertSafeExistingPath(canonicalRoot, dest)
            return await lstat(dest)
          } catch (cause) {
            if (cause instanceof UnsafeStoragePath && cause.reason === 'missing') return null
            throw cause
          }
        },
        catch: (cause) => mapUnsafeStoragePath(ref, cause),
      })
      yield* Effect.tryPromise({
        try: async () => {
          if (existingInfo) {
            await assertSafeExistingPath(canonicalRoot, dest)
            const existing = await readFile(dest)
            if (hashBytes(existing) === hash) return 'exists'
            throw new Error('existing content-addressed object hash mismatch')
          }
          await ensureSafeDirectoryPath(canonicalRoot, tmpDir)
          await writeFile(tmp, bytes, { flag: 'wx' })
          await assertSafeExistingPath(canonicalRoot, tmp)
          const check = await readFile(tmp)
          if (hashBytes(check) !== hash) throw new Error('temporary object hash verification failed')
          await ensureSafeDirectoryPath(canonicalRoot, dir)
          await assertSafeExistingPath(canonicalRoot, tmp)
          try {
            await link(tmp, dest)
            await unlink(tmp)
          } catch (cause) {
            if ((cause as NodeJS.ErrnoException).code !== 'EEXIST') throw cause
            await assertSafeExistingPath(canonicalRoot, dest)
            const existing = await readFile(dest)
            if (hashBytes(existing) !== hash) throw new Error('raced object hash mismatch', { cause })
            await rm(tmp, { force: true })
          }
          return 'written'
        },
        catch: (cause) => new StorageWriteError({ operation: 'writeObject', reason: sanitizeReason(cause), message: 'Artifact write failed' }),
      }).pipe(Effect.ensuring(Effect.promise(() => rm(tmp, { force: true }))))
      return { ref, hash, byteLength: bytes.byteLength, mediaType: options.mediaType }
    })

  const stageObject = (name: string, bytes: Uint8Array, _options: ArtifactWriteOptions): Effect.Effect<StagedArtifact, StoragePathError | StorageWriteError, never> =>
    Effect.gen(function* () {
      if (name.includes('\0') || name.includes('/') || name.includes('\\') || name !== basename(name)) {
        return yield* new StoragePathError({ ref: name.includes('\0') ? '<nul>' : name, reason: 'unsafe-name', message: 'Staged artifact name is unsafe' })
      }
      const safeName = basename(name)
        .replace(/[^A-Za-z0-9._-]/g, '_')
        .toLowerCase()
      if (!safeName || safeName === '.' || safeName === '..') {
        return yield* new StoragePathError({ ref: name, reason: 'unsafe-name', message: 'Staged artifact name is unsafe' })
      }
      const id = randomUUID()
      const ref = `staged://${id}/${safeName}` as StagedArtifactRef
      const dest = yield* stagedPath(canonicalRoot, ref)
      const dir = dest.slice(0, dest.lastIndexOf(sep))
      const tmpDir = join(canonicalRoot, 'tmp')
      const tmp = join(canonicalRoot, 'tmp', `.stage-${randomUUID()}`)
      yield* ensureSafeDirectory(canonicalRoot, dir, ref)
      yield* ensureSafeDirectory(canonicalRoot, tmpDir, ref)
      yield* Effect.tryPromise({
        try: async () => {
          await ensureSafeDirectoryPath(canonicalRoot, tmpDir)
          await writeFile(tmp, bytes, { flag: 'wx' })
          await assertSafeExistingPath(canonicalRoot, tmp)
          await ensureSafeDirectoryPath(canonicalRoot, dir)
          await rename(tmp, dest)
        },
        catch: (cause) => new StorageWriteError({ operation: 'stageObject', reason: sanitizeReason(cause), message: 'Staged artifact write failed' }),
      }).pipe(Effect.ensuring(Effect.promise(() => rm(tmp, { force: true }))))
      return { ref, byteLength: bytes.byteLength }
    })

  return { writeObject, readObject, stageObject, readStagedObject }
}

export const LocalArtifactStore = {
  make: (config: LocalArtifactStoreConfig): Effect.Effect<ArtifactStoreShape, StorageConfigurationError, never> =>
    Effect.tryPromise({
      try: () => validateRoot(config.root),
      catch: (cause) =>
        cause instanceof StorageConfigurationError
          ? cause
          : new StorageConfigurationError({ reason: sanitizeReason(cause), message: 'ARTIFACT_STORAGE_ROOT validation failed' }),
    }).pipe(Effect.map(makeStore)),
  layer: (config: LocalArtifactStoreConfig): Layer.Layer<ArtifactStore, StorageConfigurationError, never> =>
    Layer.effect(ArtifactStore, LocalArtifactStore.make(config)),
}
