import { describe, expect, it } from 'bun:test'
import { Effect, Exit, Schema } from 'effect'
import {
  Document,
  DocumentChunk,
  DocumentChunkId,
  DocumentId,
  SourceVersionId,
} from './index.js'

const documentId = DocumentId.make('550e8400-e29b-41d4-a716-446655440010')
const sourceVersionId = SourceVersionId.make('550e8400-e29b-41d4-a716-446655440011')
const chunkId = DocumentChunkId.make('550e8400-e29b-41d4-a716-446655440012')

describe('document domain contracts', () => {
  it('decodes normalized documents and versioned chunks with precise locators', async () => {
    const document = await Effect.runPromise(Schema.decodeUnknown(Document)({
      id: documentId,
      sourceVersionId,
      format: 'markdown',
      normalizedText: 'Intro\n\nBody',
      contentHash: 'sha256:document',
      parserVersion: 'markdown-v1',
      createdAt: 1,
    }))
    const chunk = await Effect.runPromise(Schema.decodeUnknown(DocumentChunk)({
      id: chunkId,
      documentId,
      sourceVersionId,
      chunkingVersion: 'fragments-v1',
      ordinal: 0,
      text: 'Body',
      textHash: 'sha256:chunk',
      locator: {
        page: null,
        section: 'Intro',
        paragraph: 2,
        charStart: 7,
        charEnd: 11,
        byteStart: 7,
        byteEnd: 11,
      },
      createdAt: 1,
    }))

    expect(document.sourceVersionId).toBe(sourceVersionId)
    expect(chunk.locator).toEqual({
      page: null,
      section: 'Intro',
      paragraph: 2,
      charStart: 7,
      charEnd: 11,
      byteStart: 7,
      byteEnd: 11,
    })
  })

  it('rejects invalid chunk ordinals and locator ranges', async () => {
    const invalidOrdinal = await Effect.runPromiseExit(
      Schema.decodeUnknown(DocumentChunk)({
        id: chunkId,
        documentId,
        sourceVersionId,
        chunkingVersion: 'fragments-v1',
        ordinal: -1,
        text: 'Body',
        textHash: 'sha256:chunk',
        locator: {
          page: null,
          section: null,
          paragraph: null,
          charStart: 0,
          charEnd: 4,
          byteStart: 0,
          byteEnd: 4,
        },
        createdAt: 1,
      }),
    )
    expect(Exit.isFailure(invalidOrdinal)).toBe(true)

    for (const locator of [
      {
        page: 0,
        section: null,
        paragraph: null,
        charStart: -1,
        charEnd: 4,
        byteStart: 0,
        byteEnd: 4,
      },
      {
        page: null,
        section: null,
        paragraph: null,
        charStart: 4,
        charEnd: 4,
        byteStart: 0,
        byteEnd: 4,
      },
      {
        page: null,
        section: null,
        paragraph: null,
        charStart: 0,
        charEnd: 4,
        byteStart: 5,
        byteEnd: 4,
      },
    ]) {
      const result = await Effect.runPromiseExit(
        Schema.decodeUnknown(DocumentChunk)({
          id: chunkId,
          documentId,
          sourceVersionId,
          chunkingVersion: 'fragments-v1',
          ordinal: 0,
          text: 'Body',
          textHash: 'sha256:chunk',
          locator,
          createdAt: 1,
        }),
      )

      expect(Exit.isFailure(result)).toBe(true)
    }
  })
})
