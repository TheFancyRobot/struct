import { afterEach, describe, expect, it } from 'bun:test'
import { Cause, Effect, Exit, Layer } from 'effect'
import {
  mkdtemp,
  mkdir,
  rename,
  rm,
  symlink,
  unlink,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  DirectoryRootId,
  DirectorySnapshotId,
  ProjectId,
  WorkspaceId,
} from '@struct/domain'
import {
  BunDirectoryFileSystemShape,
  DirectoryDiscovery,
  DirectoryEntryDisappearedError,
  DirectoryFileSystem,
  DirectoryLimitExceededError,
  DirectoryPathError,
  DirectoryPermissionError,
  DirectoryRootError,
  type DirectoryFileSystemShape,
  type DiscoverDirectoryInput,
} from './index.js'

const roots: string[] = []
const workspaceId = WorkspaceId.make('550e8400-e29b-41d4-a716-446655440001')
const projectId = ProjectId.make('550e8400-e29b-41d4-a716-446655440002')
const directoryRootId = DirectoryRootId.make('550e8400-e29b-41d4-a716-446655440003')
const snapshotId = DirectorySnapshotId.make('550e8400-e29b-41d4-a716-446655440004')
const limits = {
  maxDepth: 8,
  maxEntries: 100,
  maxFileBytes: 1_024,
  maxAggregateBytes: 4_096,
}

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'struct-discovery-'))
  roots.push(root)
  return root
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) =>
    rm(root, { recursive: true, force: true })))
})

function input(root: string, overrides: Partial<DiscoverDirectoryInput> = {}): DiscoverDirectoryInput {
  return {
    registeredRoot: root,
    workspaceId,
    projectId,
    directoryRootId,
    snapshotId,
    limits,
    ...overrides,
  }
}

function discoveryLayer(fileSystem: DirectoryFileSystemShape) {
  return DirectoryDiscovery.Default.pipe(
    Layer.provide(Layer.succeed(DirectoryFileSystem, fileSystem)),
  )
}

function discover(
  request: DiscoverDirectoryInput,
  fileSystem: DirectoryFileSystemShape = BunDirectoryFileSystemShape,
) {
  return DirectoryDiscovery.discover(request).pipe(
    Effect.provide(discoveryLayer(fileSystem)),
  )
}

function failureOf<A, E>(exit: Exit.Exit<A, E>): E {
  expect(Exit.isFailure(exit)).toBe(true)
  if (Exit.isSuccess(exit)) throw new Error('expected failure')
  const failure = Cause.failureOption(exit.cause)
  expect(failure._tag).toBe('Some')
  if (failure._tag === 'None') throw new Error('expected typed failure')
  return failure.value
}

describe('DirectoryDiscovery', () => {
  it('discovers, hashes, classifies, ignores, and orders one contained tree deterministically', async () => {
    const root = await tempRoot()
    await mkdir(join(root, 'zeta'), { recursive: true })
    await mkdir(join(root, '.git'), { recursive: true })
    await writeFile(join(root, 'zeta', 'notes.txt'), 'notes')
    await writeFile(join(root, 'alpha.md'), '# alpha')
    await writeFile(join(root, 'binary.dat'), new Uint8Array([0, 1, 2]))
    await writeFile(join(root, '.git', 'secret.md'), 'ignored')

    const result = await Effect.runPromise(discover(input(root)))

    expect(result.manifest.entries.map((entry) => String(entry.relativePath))).toEqual([
      'alpha.md',
      'binary.dat',
      'zeta/notes.txt',
    ])
    expect(result.manifest.entries.map((entry) => entry.status)).toEqual([
      'included',
      'unsupported',
      'included',
    ])
    expect(result.manifest.entries[0]?.contentHash).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(result.manifest.entries[1]?.contentHash).toBeNull()
    expect(result.aggregateHashedBytes).toBe(12)
    expect(result.manifest.digest).toMatch(/^sha256:[0-9a-f]{64}$/)
  })

  it('produces identical IDs, hashes, ordering, and manifest digest when enumeration order changes', async () => {
    const root = await tempRoot()
    await mkdir(join(root, 'nested'), { recursive: true })
    await writeFile(join(root, 'a.txt'), 'a')
    await writeFile(join(root, 'nested', 'b.md'), 'b')
    const reversed: DirectoryFileSystemShape = {
      ...BunDirectoryFileSystemShape,
      readDirectory: (absolutePath, relativePath) =>
        BunDirectoryFileSystemShape.readDirectory(absolutePath, relativePath).pipe(
          Effect.map((names) => Array.from(names).reverse()),
        ),
    }

    const normal = await Effect.runPromise(discover(input(root)))
    const reverse = await Effect.runPromise(discover(input(root), reversed))

    expect(reverse.manifest).toEqual(normal.manifest)
    expect(reverse.outcomes).toEqual(normal.outcomes)
  })

  it.each([
    ['../escape', 'traversal'],
    ['/tmp/absolute', 'absolute'],
    ['nested/../../escape', 'traversal'],
  ])('rejects unsafe start path %s before traversal', async (startPath, reason) => {
    const root = await tempRoot()
    const exit = await Effect.runPromiseExit(discover(input(root, { startPath })))
    const error = failureOf(exit)

    expect(error).toBeInstanceOf(DirectoryPathError)
    expect(error).toMatchObject({ reason })
  })

  it('accepts contained path segments that begin with two dots', async () => {
    const root = await tempRoot()
    await mkdir(join(root, '..config'), { recursive: true })
    await writeFile(join(root, '..config', 'safe.txt'), 'safe')

    const result = await Effect.runPromise(discover(input(root)))

    expect(result.manifest.entries.map((entry) =>
      String(entry.relativePath))).toEqual(['..config/safe.txt'])
  })

  it('rejects a symlink registered root', async () => {
    const target = await tempRoot()
    const parent = await tempRoot()
    const linkedRoot = join(parent, 'linked')
    await symlink(target, linkedRoot, 'dir')

    const error = failureOf(
      await Effect.runPromiseExit(discover(input(linkedRoot))),
    )

    expect(error).toBeInstanceOf(DirectoryRootError)
    expect(error).toMatchObject({ reason: 'symlink' })
  })

  it('fails closed for symlinks outside the root and symlink cycles without traversing either', async () => {
    const root = await tempRoot()
    const outside = await tempRoot()
    await writeFile(join(outside, 'secret.txt'), 'secret')
    await symlink(join(outside, 'secret.txt'), join(root, 'outside.txt'))
    await symlink(root, join(root, 'cycle'), 'dir')
    await writeFile(join(root, 'safe.txt'), 'safe')

    const result = await Effect.runPromise(discover(input(root)))
    const failures = result.outcomes.filter((outcome) =>
      outcome._tag === 'DirectoryEntryFailure')

    expect(result.manifest.entries.map((entry) => String(entry.relativePath))).toEqual([
      'safe.txt',
    ])
    expect(failures.map((outcome) => String(outcome.relativePath))).toEqual([
      'cycle',
      'outside.txt',
    ])
    expect(failures.every((outcome) =>
      outcome.error._tag === 'DirectorySymlinkError')).toBe(true)
  })

  it('reports portable injected permission denial at the canonical path without host ACL assumptions', async () => {
    const root = await tempRoot()
    await mkdir(join(root, 'restricted'), { recursive: true })
    await writeFile(join(root, 'restricted', 'denied.txt'), 'private')
    const denied: DirectoryFileSystemShape = {
      ...BunDirectoryFileSystemShape,
      readFile: (absolutePath, relativePath, canonicalRoot) =>
        relativePath === 'restricted/denied.txt'
          ? Effect.fail(new DirectoryPermissionError({
              relativePath,
              operation: 'read-file',
              message: 'Injected permission denial',
            }))
          : BunDirectoryFileSystemShape.readFile(
              absolutePath,
              relativePath,
              canonicalRoot,
            ),
    }

    const result = await Effect.runPromise(discover(input(root), denied))

    expect(result.manifest.entries).toEqual([])
    expect(result.outcomes).toHaveLength(1)
    expect(result.outcomes[0]).toMatchObject({
      _tag: 'DirectoryEntryFailure',
      relativePath: 'restricted/denied.txt',
      error: {
        _tag: 'DirectoryPermissionError',
        operation: 'read-file',
      },
    })
  })

  it('records nested directory enumeration denial and continues scanning siblings', async () => {
    const root = await tempRoot()
    await mkdir(join(root, 'restricted'), { recursive: true })
    await writeFile(join(root, 'restricted', 'denied.txt'), 'private')
    await writeFile(join(root, 'visible.txt'), 'public')
    const denied: DirectoryFileSystemShape = {
      ...BunDirectoryFileSystemShape,
      readDirectory: (absolutePath, relativePath) =>
        relativePath === 'restricted'
          ? Effect.fail(new DirectoryPermissionError({
              relativePath,
              operation: 'read-directory',
              message: 'Injected directory permission denial',
            }))
          : BunDirectoryFileSystemShape.readDirectory(absolutePath, relativePath),
    }

    const result = await Effect.runPromise(discover(input(root), denied))

    expect(result.manifest.entries.map((entry) => String(entry.relativePath))).toEqual([
      'visible.txt',
    ])
    expect(result.outcomes[0]).toMatchObject({
      _tag: 'DirectoryEntryFailure',
      relativePath: 'restricted',
      error: {
        _tag: 'DirectoryPermissionError',
        operation: 'read-directory',
      },
    })
  })

  it('rejects an inspect-to-open symlink swap instead of hashing outside-root content', async () => {
    const root = await tempRoot()
    const outside = await tempRoot()
    const candidate = join(root, 'candidate.txt')
    await writeFile(candidate, 'inside')
    await writeFile(join(outside, 'secret.txt'), 'secret')
    let swapped = false
    const racing: DirectoryFileSystemShape = {
      ...BunDirectoryFileSystemShape,
      readFile: (absolutePath, relativePath, canonicalRoot) =>
        Effect.tryPromise({
          try: async () => {
            if (!swapped) {
              swapped = true
              await unlink(candidate)
              await symlink(join(outside, 'secret.txt'), candidate)
            }
          },
          catch: () => new DirectoryPermissionError({
            relativePath,
            operation: 'read-file',
            message: 'Injected race setup failed',
          }),
        }).pipe(
          Effect.flatMap(() =>
            BunDirectoryFileSystemShape.readFile(
              absolutePath,
              relativePath,
              canonicalRoot,
            )),
        ),
    }

    const result = await Effect.runPromise(discover(input(root), racing))

    expect(result.manifest.entries).toEqual([])
    expect(result.outcomes[0]).toMatchObject({
      _tag: 'DirectoryEntryFailure',
      relativePath: 'candidate.txt',
    })
  })

  it('rejects an ancestor-directory symlink swap before hashing outside-root content', async () => {
    const root = await tempRoot()
    const outside = await tempRoot()
    const nested = join(root, 'nested')
    const movedNested = join(root, 'nested-safe')
    await mkdir(nested, { recursive: true })
    await writeFile(join(nested, 'secret.txt'), 'inside')
    await writeFile(join(outside, 'secret.txt'), 'outside')
    let swapped = false
    const racing: DirectoryFileSystemShape = {
      ...BunDirectoryFileSystemShape,
      readFile: (absolutePath, relativePath, canonicalRoot) =>
        Effect.tryPromise({
          try: async () => {
            if (!swapped) {
              swapped = true
              await rename(nested, movedNested)
              await symlink(outside, nested, 'dir')
            }
          },
          catch: () => new DirectoryPermissionError({
            relativePath,
            operation: 'read-file',
            message: 'Injected ancestor race setup failed',
          }),
        }).pipe(
          Effect.flatMap(() =>
            BunDirectoryFileSystemShape.readFile(
              absolutePath,
              relativePath,
              canonicalRoot,
            )),
        ),
    }

    const result = await Effect.runPromise(discover(input(root), racing))

    expect(result.manifest.entries).toEqual([])
    expect(result.outcomes).toHaveLength(1)
    expect(result.outcomes[0]).toMatchObject({
      _tag: 'DirectoryEntryFailure',
      relativePath: 'nested/secret.txt',
      error: { _tag: 'DirectoryFilesystemError' },
    })
  })

  it('reports an injected disappearing file as a typed per-entry failure', async () => {
    const root = await tempRoot()
    await writeFile(join(root, 'vanished.txt'), 'temporary')
    const disappearing: DirectoryFileSystemShape = {
      ...BunDirectoryFileSystemShape,
      inspect: (absolutePath, relativePath) =>
        relativePath === 'vanished.txt'
          ? Effect.fail(new DirectoryEntryDisappearedError({
              relativePath,
              operation: 'inspect',
              message: 'Injected disappearance',
            }))
          : BunDirectoryFileSystemShape.inspect(absolutePath, relativePath),
    }

    const result = await Effect.runPromise(discover(input(root), disappearing))

    expect(result.manifest.entries).toEqual([])
    expect(result.outcomes[0]).toMatchObject({
      _tag: 'DirectoryEntryFailure',
      relativePath: 'vanished.txt',
      error: { _tag: 'DirectoryEntryDisappearedError' },
    })
  })

  it('does not convert filesystem defects into recoverable entry outcomes', async () => {
    const root = await tempRoot()
    await writeFile(join(root, 'defect.txt'), 'content')
    const defective: DirectoryFileSystemShape = {
      ...BunDirectoryFileSystemShape,
      inspect: (absolutePath, relativePath) =>
        relativePath === 'defect.txt'
          ? Effect.dieMessage('Injected filesystem defect')
          : BunDirectoryFileSystemShape.inspect(absolutePath, relativePath),
    }

    const exit = await Effect.runPromiseExit(discover(input(root), defective))

    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isSuccess(exit)) throw new Error('expected defect')
    expect(Cause.failureOption(exit.cause)._tag).toBe('None')
    expect(Cause.pretty(exit.cause)).toContain('Injected filesystem defect')
  })

  it('preserves a typed permission failure raised lazily while hashing', async () => {
    const root = await tempRoot()
    await writeFile(join(root, 'denied.txt'), 'private')
    const denied: DirectoryFileSystemShape = {
      ...BunDirectoryFileSystemShape,
      readFile: (_absolutePath, relativePath) =>
        Effect.succeed((async function* (): AsyncGenerator<Uint8Array> {
          throw new DirectoryPermissionError({
            relativePath,
            operation: 'read-file',
            message: 'Injected lazy permission denial',
          })
        })()),
    }

    const result = await Effect.runPromise(discover(input(root), denied))

    expect(result.manifest.entries).toEqual([])
    expect(result.outcomes[0]).toMatchObject({
      _tag: 'DirectoryEntryFailure',
      relativePath: 'denied.txt',
      error: {
        _tag: 'DirectoryPermissionError',
        operation: 'read-file',
      },
    })
  })

  it.each([
    ['depth', { maxDepth: 0 }, 'nested/file.txt'],
    ['entries', { maxEntries: 0 }, 'file.txt'],
    ['file-bytes', { maxFileBytes: 3 }, 'file.txt'],
    ['aggregate-bytes', { maxAggregateBytes: 3 }, 'file.txt'],
  ] as const)('fails with a typed %s limit error', async (limit, override, filePath) => {
    const root = await tempRoot()
    if (filePath.includes('/')) await mkdir(join(root, 'nested'), { recursive: true })
    await writeFile(join(root, filePath), 'four')
    const exit = await Effect.runPromiseExit(discover(input(root, {
      limits: { ...limits, ...override },
    })))
    const error = failureOf(exit)

    expect(error).toBeInstanceOf(DirectoryLimitExceededError)
    expect(error).toMatchObject({ limit })
  })
})
