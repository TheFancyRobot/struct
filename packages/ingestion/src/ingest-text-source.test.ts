import { afterEach, describe, expect, it } from 'vitest'
import { Effect } from 'effect'
import { createHash } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { LocalArtifactStore } from '@struct/source-storage'
import { ingestTextSource, normalizeTextBytes } from './ingest-text-source'

const roots: string[] = []

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'struct-ingestion-'))
  roots.push(root)
  return root
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('normalizeTextBytes', () => {
  it('normalizes UTF-8 text deterministically and hashes normalized bytes', async () => {
    const input = new TextEncoder().encode('\uFEFFhello\r\nworld\r\n')
    const result = await Effect.runPromise(normalizeTextBytes(input))
    const expected = new TextEncoder().encode('hello\nworld\n')
    const expectedHash = `sha256:${createHash('sha256').update(expected).digest('hex')}`

    expect(new TextDecoder().decode(result.bytes)).toBe('hello\nworld\n')
    expect(result.contentHash).toBe(expectedHash)
  })
})

describe('ingestTextSource', () => {
  it('stores raw, normalized, and manifest artifacts without leaking source text or host paths', async () => {
    const store = await Effect.runPromise(LocalArtifactStore.make({ root: await tempRoot() }))
    const staged = await Effect.runPromise(store.stageObject('notes.md', new TextEncoder().encode('# Title\r\nhello'), { mediaType: 'text/markdown' }))

    const result = await Effect.runPromise(ingestTextSource({ store, stagedRef: staged.ref, name: 'notes.md', mediaType: 'text/markdown', maxBytes: 1024 }))
    const manifestObject = await Effect.runPromise(store.readObject(result.manifestRef))
    const manifest = JSON.parse(new TextDecoder().decode(manifestObject.bytes))

    expect(result.rawRef).toMatch(/^artifact:\/\/sha256\//)
    expect(result.normalizedRef).toMatch(/^artifact:\/\/sha256\//)
    expect(result.manifestRef).toMatch(/^artifact:\/\/sha256\//)
    expect(result.contentHash).toMatch(/^sha256:[a-f0-9]{64}$/)
    expect(manifest).toMatchObject({
      kind: 'text-source-manifest',
      version: 1,
      originalName: 'notes.md',
      mediaType: 'text/markdown',
      rawRef: result.rawRef,
      normalizedRef: result.normalizedRef,
      contentHash: result.contentHash,
    })
    expect(JSON.stringify(manifest)).not.toContain('# Title')
    expect(JSON.stringify(manifest)).not.toContain('/var/')
    expect(JSON.stringify(manifest)).not.toContain('/Users/')
  })
})
