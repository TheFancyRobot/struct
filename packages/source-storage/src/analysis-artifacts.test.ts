import { afterEach, describe, expect, it } from 'bun:test'
import { Sha256Digest } from '@struct/domain'
import { Effect, Schema } from 'effect'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { publishAnalysisArtifact } from './analysis-artifacts.js'
import { LocalArtifactStore } from './object-store.js'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) =>
    rm(root, { recursive: true, force: true })))
})

async function store() {
  const root = await mkdtemp(join(tmpdir(), 'struct-analysis-artifacts-'))
  roots.push(root)
  return Effect.runPromise(LocalArtifactStore.make({ root }))
}

function input(value: string) {
  const bytes = new TextEncoder().encode(value)
  return {
    bytes,
    digest: Sha256Digest.make(
      `sha256:${new Bun.CryptoHasher('sha256').update(bytes).digest('hex')}`,
    ),
    mediaType: 'application/vnd.struct.test+json',
    maximumBytes: 1_000,
  }
}

describe('analysis artifact publication', () => {
  it('publishes verified bytes content-addressably and reuses duplicate content', async () => {
    const storage = await store()
    const value = input('{"stable":true}')
    const first = await Effect.runPromise(
      publishAnalysisArtifact(storage, value),
    )
    const second = await Effect.runPromise(
      publishAnalysisArtifact(storage, value),
    )

    expect(second).toEqual(first)
    expect(String(first.hash)).toBe(String(value.digest))
  })

  it('rejects digest mismatch and byte overflow before calling storage', async () => {
    const storage = await store()
    const value = input('{"stable":true}')
    const mismatched = await Effect.runPromise(Effect.either(
      publishAnalysisArtifact(storage, {
        ...value,
        digest: Schema.decodeUnknownSync(Sha256Digest)(
          `sha256:${'f'.repeat(64)}`,
        ),
      }),
    ))
    const oversized = await Effect.runPromise(Effect.either(
      publishAnalysisArtifact(storage, { ...value, maximumBytes: 1 }),
    ))

    expect(mismatched._tag).toBe('Left')
    expect(oversized._tag).toBe('Left')
  })
})
