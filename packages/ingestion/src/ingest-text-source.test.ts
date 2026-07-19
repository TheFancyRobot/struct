import { afterEach, describe, expect, it } from 'bun:test'
import { Effect } from 'effect'
import { createHash } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { LocalArtifactStore } from '@struct/source-storage'
import { ingestTextSource, normalizeTextBytes } from './ingest-text-source'

const roots: string[] = []
const encode = (text: string): Uint8Array => new TextEncoder().encode(text)

function pdfFixture(text: string): Uint8Array {
  const stream = `BT /F1 12 Tf 72 720 Td (${text.replace(/[()\\]/g, '\\$&')}) Tj ET`
  const byteLength = (value: string): number => encode(value).byteLength
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ]
  let body = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((object, index) => {
    offsets.push(byteLength(body))
    body += `${index + 1} 0 obj\n${object}\nendobj\n`
  })
  const xref = byteLength(body)
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  body += offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return encode(body)
}

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
    expect(String(result.contentHash)).toBe(expectedHash)
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
      version: 2,
      originalName: 'notes.md',
      mediaType: 'text/markdown',
      rawRef: result.rawRef,
      normalizedRef: result.normalizedRef,
      contentHash: result.contentHash,
    })
    expect(JSON.stringify(manifest)).not.toContain('# Title')
    expect(JSON.stringify(manifest)).not.toContain('/var/')
    expect(JSON.stringify(manifest)).not.toContain('/Users/')
    expect(manifest).toMatchObject({ format: 'markdown' })
    expect(manifest.fragments[0]).toMatchObject({ section: 'Title', paragraph: 1, charStart: 0, byteStart: 0 })
  })

  it('preserves the immutable raw PDF bytes after PDF.js parsing', async () => {
    const store = await Effect.runPromise(LocalArtifactStore.make({ root: await tempRoot() }))
    const original = pdfFixture('Embedded PDF café')
    const staged = await Effect.runPromise(store.stageObject('paper.pdf', original, { mediaType: 'application/pdf' }))

    const result = await Effect.runPromise(ingestTextSource({
      store,
      stagedRef: staged.ref,
      name: 'paper.pdf',
      mediaType: 'application/pdf',
      maxBytes: 4096,
    }))
    const raw = await Effect.runPromise(store.readObject(result.rawRef))

    expect(raw.byteLength).toBe(original.byteLength)
    expect(raw.bytes).toEqual(original)
  })
})
