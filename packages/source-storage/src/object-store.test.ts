import { afterEach, describe, expect, it } from 'bun:test'
import { Effect, Exit } from 'effect'
import { createHash } from 'node:crypto'
import { access, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  LocalArtifactStore,
  StorageConfigurationError,
  StoragePathError,
  type ArtifactRef,
  type StagedArtifactRef,
} from './object-store'

const roots: string[] = []

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'struct-artifacts-'))
  roots.push(root)
  return root
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('LocalArtifactStore', () => {
  it('validates and creates a writable canonical storage root on startup', async () => {
    const root = join(await tempRoot(), 'nested', 'artifacts')
    const store = await Effect.runPromise(LocalArtifactStore.make({ root }))

    const artifact = await Effect.runPromise(store.writeObject(new TextEncoder().encode('hello'), { mediaType: 'text/plain' }))

    expect(artifact.ref).toMatch(/^artifact:\/\/sha256\/[a-f0-9]{64}$/)
    expect(artifact.hash).toMatch(/^sha256:[a-f0-9]{64}$/)
    expect(artifact.byteLength).toBe(5)
    expect(artifact.ref.includes(root)).toBe(false)
  })

  it('rejects NUL bytes and unsafe storage roots with typed configuration errors', async () => {
    const root = `${await tempRoot()}\0suffix`
    const result = await Effect.runPromiseExit(LocalArtifactStore.make({ root }))

    expect(Exit.isFailure(result)).toBe(true)
    if (Exit.isFailure(result)) {
      expect(result.cause.toString()).toContain(StorageConfigurationError.name)
    }
  })

  it('rejects traversal, absolute, and malformed refs before filesystem access', async () => {
    const store = await Effect.runPromise(LocalArtifactStore.make({ root: await tempRoot() }))

    for (const ref of ['artifact://sha256/../secret', '/tmp/secret', 'artifact://sha256/not-a-hash']) {
      const result = await Effect.runPromiseExit(store.readObject(ref as ArtifactRef))
      expect(Exit.isFailure(result)).toBe(true)
      if (Exit.isFailure(result)) {
        expect(result.cause.toString()).toContain(StoragePathError.name)
      }
    }
  })

  it('rejects symlinked storage subdirectories during startup validation', async () => {
    const root = await tempRoot()
    const outside = await tempRoot()
    await symlink(outside, join(root, 'tmp'))

    const result = await Effect.runPromiseExit(LocalArtifactStore.make({ root }))

    expect(Exit.isFailure(result)).toBe(true)
    if (Exit.isFailure(result)) {
      expect(result.cause.toString()).toContain(StorageConfigurationError.name)
      expect(result.cause.toString()).toContain('symlink')
    }
  })

  it('rejects user-controlled staged symlinks instead of following them', async () => {
    const root = await tempRoot()
    const store = await Effect.runPromise(LocalArtifactStore.make({ root }))
    const stagingDir = join(root, 'staging', '550e8400-e29b-41d4-a716-446655440000')
    await mkdir(stagingDir, { recursive: true })
    const outside = join(await tempRoot(), 'outside.txt')
    await writeFile(outside, 'secret')
    await symlink(outside, join(stagingDir, 'link.txt'))

    const result = await Effect.runPromiseExit(
      store.readStagedObject('staged://550e8400-e29b-41d4-a716-446655440000/link.txt' as StagedArtifactRef),
    )

    expect(Exit.isFailure(result)).toBe(true)
    if (Exit.isFailure(result)) {
      expect(result.cause.toString()).toContain(StoragePathError.name)
    }
  })

  it('performs content-addressed atomic writes and verifies deduped existing objects', async () => {
    const store = await Effect.runPromise(LocalArtifactStore.make({ root: await tempRoot() }))
    const bytes = new TextEncoder().encode('same bytes')

    const first = await Effect.runPromise(store.writeObject(bytes, { mediaType: 'text/plain' }))
    const second = await Effect.runPromise(store.writeObject(bytes, { mediaType: 'text/plain' }))
    const stored = await Effect.runPromise(store.readObject(first.ref))

    expect(second.ref).toBe(first.ref)
    expect(second.hash).toBe(first.hash)
    expect(new TextDecoder().decode(stored.bytes)).toBe('same bytes')
  })

  it('rejects symlinked content-addressed object paths instead of treating them as deduped objects', async () => {
    const root = await tempRoot()
    const store = await Effect.runPromise(LocalArtifactStore.make({ root }))
    const bytes = new TextEncoder().encode('outside bytes')
    const digest = createHash('sha256').update(bytes).digest('hex')
    const objectDir = join(root, 'objects', 'sha256', digest.slice(0, 2))
    await mkdir(objectDir, { recursive: true })
    const outside = join(await tempRoot(), 'outside.txt')
    await writeFile(outside, bytes)
    await symlink(outside, join(objectDir, digest))

    const result = await Effect.runPromiseExit(store.writeObject(bytes, { mediaType: 'text/plain' }))

    expect(Exit.isFailure(result)).toBe(true)
    if (Exit.isFailure(result)) {
      expect(result.cause.toString()).toContain('Symlink')
    }
  })

  it('rejects a pre-existing symlinked digest-prefix directory without writing outside the storage root', async () => {
    const root = await tempRoot()
    const outside = await tempRoot()
    const store = await Effect.runPromise(LocalArtifactStore.make({ root }))
    const bytes = new TextEncoder().encode('digest-prefix escape')
    const digest = createHash('sha256').update(bytes).digest('hex')
    const digestPrefix = join(root, 'objects', 'sha256', digest.slice(0, 2))
    const escapedObject = join(outside, digest)
    await symlink(outside, digestPrefix, 'dir')

    const result = await Effect.runPromiseExit(store.writeObject(bytes, { mediaType: 'text/plain' }))

    expect(Exit.isFailure(result)).toBe(true)
    if (Exit.isFailure(result)) {
      expect(result.cause.toString()).toContain(StoragePathError.name)
    }
    await expect(access(escapedObject)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('stages uploads under stable logical refs without leaking host paths', async () => {
    const root = await tempRoot()
    const store = await Effect.runPromise(LocalArtifactStore.make({ root }))

    const staged = await Effect.runPromise(
      store.stageObject('notes.md', new TextEncoder().encode('# Notes'), { mediaType: 'text/markdown' }),
    )
    const read = await Effect.runPromise(store.readStagedObject(staged.ref))

    expect(staged.ref).toMatch(/^staged:\/\/[0-9a-f-]{36}\/notes\.md$/)
    expect(staged.ref.includes(root)).toBe(false)
    expect(new TextDecoder().decode(read.bytes)).toBe('# Notes')
  })

  it('rejects path-like staged upload names instead of sanitizing traversal input', async () => {
    const store = await Effect.runPromise(LocalArtifactStore.make({ root: await tempRoot() }))

    const result = await Effect.runPromiseExit(
      store.stageObject('../secret.md', new TextEncoder().encode('secret'), { mediaType: 'text/markdown' }),
    )

    expect(Exit.isFailure(result)).toBe(true)
    if (Exit.isFailure(result)) {
      expect(result.cause.toString()).toContain(StoragePathError.name)
    }
  })
})
