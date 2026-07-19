import { describe, expect, it } from 'bun:test'
import {
  DocumentId,
  SourceVersionId,
  type Document,
} from '@struct/domain'
import { Cause, Effect, Exit } from 'effect'
import {
  chunkDocument,
  DOCUMENT_CHUNKING_VERSION,
} from './chunk-document.js'
import { parseText } from './parsers/text.js'

const encode = (text: string): Uint8Array => new TextEncoder().encode(text)
const documentId = DocumentId.make('650e8400-e29b-41d4-a716-446655440010')
const sourceVersionId = SourceVersionId.make('650e8400-e29b-41d4-a716-446655440011')

describe('chunkDocument', () => {
  it('builds deterministic, ordered chunks that round-trip multibyte locators', async () => {
    const normalized = await Effect.runPromise(
      parseText(encode('First café\n\nSecond paragraph\n\nThird')),
    )
    const document: Document = {
      id: documentId,
      sourceVersionId,
      format: 'text',
      normalizedText: normalized.text,
      contentHash: 'sha256:document',
      parserVersion: 'text-v1',
      createdAt: 1n,
    }

    const first = await Effect.runPromise(
      chunkDocument({ document, normalized, maxCharacters: 25 }),
    )
    const second = await Effect.runPromise(
      chunkDocument({ document, normalized, maxCharacters: 25 }),
    )

    expect(first).toEqual(second)
    expect(first.map((chunk) => chunk.ordinal)).toEqual([0, 1])
    expect(first.every((chunk) =>
      chunk.chunkingVersion === DOCUMENT_CHUNKING_VERSION
    )).toBe(true)
    for (const chunk of first) {
      expect(
        normalized.text.slice(
          chunk.locator.charStart,
          chunk.locator.charEnd,
        ),
      ).toBe(chunk.text)
      expect(
        encode(normalized.text.slice(0, chunk.locator.charStart)).byteLength,
      ).toBe(chunk.locator.byteStart)
      expect(
        encode(normalized.text.slice(0, chunk.locator.charEnd)).byteLength,
      ).toBe(chunk.locator.byteEnd)
    }
  })

  it('groups adjacent fragments without losing their exact source span', async () => {
    const normalized = await Effect.runPromise(
      parseText(encode('First\n\nSecond')),
    )
    const document: Document = {
      id: documentId,
      sourceVersionId,
      format: 'text',
      normalizedText: normalized.text,
      contentHash: 'sha256:document',
      parserVersion: 'text-v1',
      createdAt: 1n,
    }

    const chunks = await Effect.runPromise(
      chunkDocument({ document, normalized, maxCharacters: 100 }),
    )

    expect(chunks).toHaveLength(1)
    expect(chunks[0]).toMatchObject({
      text: 'First\n\nSecond',
      locator: {
        paragraph: null,
        charStart: 0,
        charEnd: 13,
        byteStart: 0,
        byteEnd: 13,
      },
    })
  })

  it('bounds a single oversized fragment without splitting surrogate pairs', async () => {
    const normalized = await Effect.runPromise(
      parseText(encode('abc😀defghi')),
    )
    const document: Document = {
      id: documentId,
      sourceVersionId,
      format: 'text',
      normalizedText: normalized.text,
      contentHash: 'sha256:document',
      parserVersion: 'text-v1',
      createdAt: 1n,
    }

    const chunks = await Effect.runPromise(
      chunkDocument({ document, normalized, maxCharacters: 4 }),
    )

    expect(chunks.map((chunk) => chunk.text)).toEqual(['abc', '😀de', 'fghi'])
    expect(chunks.every((chunk) => chunk.text.length <= 4)).toBe(true)
    expect(chunks.map((chunk) => chunk.locator.byteEnd)).toEqual([3, 9, 13])
  })

  it('makes progress when a one-character limit meets a surrogate pair', async () => {
    const normalized = await Effect.runPromise(
      parseText(encode('😀a')),
    )
    const document: Document = {
      id: documentId,
      sourceVersionId,
      format: 'text',
      normalizedText: normalized.text,
      contentHash: 'sha256:document',
      parserVersion: 'text-v1',
      createdAt: 1n,
    }

    const chunks = await Effect.runPromise(
      chunkDocument({ document, normalized, maxCharacters: 1 }),
    )

    expect(chunks.map((chunk) => chunk.text)).toEqual(['😀', 'a'])
    expect(chunks.map((chunk) => chunk.locator.charEnd)).toEqual([2, 3])
    expect(chunks.map((chunk) => chunk.locator.byteEnd)).toEqual([4, 5])
  })

  it('accepts adjacent fragments because locator ends are exclusive', async () => {
    const normalized = {
      format: 'text',
      text: 'FirstSecond',
      fragments: [
        {
          text: 'First',
          page: null,
          section: null,
          paragraph: 1,
          charStart: 0,
          charEnd: 5,
          byteStart: 0,
          byteEnd: 5,
        },
        {
          text: 'Second',
          page: null,
          section: null,
          paragraph: 2,
          charStart: 5,
          charEnd: 11,
          byteStart: 5,
          byteEnd: 11,
        },
      ],
    } as const
    const document: Document = {
      id: documentId,
      sourceVersionId,
      format: 'text',
      normalizedText: normalized.text,
      contentHash: 'sha256:document',
      parserVersion: 'text-v1',
      createdAt: 1n,
    }

    const chunks = await Effect.runPromise(
      chunkDocument({ document, normalized, maxCharacters: 100 }),
    )

    expect(chunks).toHaveLength(1)
    expect(chunks[0]?.text).toBe('FirstSecond')
  })

  it('fails with a typed error when a fragment locator does not round-trip', async () => {
    const normalized = {
      format: 'text',
      text: 'Body',
      fragments: [{
        text: 'Wrong',
        page: null,
        section: null,
        paragraph: 1,
        charStart: 0,
        charEnd: 4,
        byteStart: 0,
        byteEnd: 4,
      }],
    } as const
    const document: Document = {
      id: documentId,
      sourceVersionId,
      format: 'text',
      normalizedText: normalized.text,
      contentHash: 'sha256:document',
      parserVersion: 'text-v1',
      createdAt: 1n,
    }

    const result = await Effect.runPromiseExit(chunkDocument({
      document,
      normalized,
    }))

    expect(Exit.isFailure(result)).toBe(true)
    if (Exit.isFailure(result)) {
      const failure = Cause.failureOption(result.cause)
      expect(failure._tag).toBe('Some')
      if (failure._tag === 'Some') {
        expect(failure.value).toMatchObject({
          _tag: 'DocumentChunkingError',
          reason: 'invalid-locator',
          fragment: 0,
        })
      }
    }
  })
})
