import {
  hashDocumentChunkText,
  makeDocumentChunkId,
} from '@struct/domain'
import { Effect } from 'effect'
import { DocumentChunkingError } from './errors.js'
import type {
  DocumentFragment,
  NormalizedDocument,
} from './types.js'

export const DOCUMENT_CHUNKING_VERSION = 'fragments-v1'
export const DEFAULT_DOCUMENT_CHUNK_MAX_CHARACTERS = 1_200

type DomainDocument = import('@struct/domain').Document
type DomainDocumentChunk = import('@struct/domain').DocumentChunk

export interface ChunkDocumentInput {
  readonly document: DomainDocument
  readonly normalized: NormalizedDocument
  readonly maxCharacters?: number
}

const encoder = new TextEncoder()

function validateFragment(
  document: NormalizedDocument,
  fragment: DocumentFragment,
  index: number,
  previous: DocumentFragment | undefined,
): Effect.Effect<void, DocumentChunkingError> {
  const text = document.text.slice(fragment.charStart, fragment.charEnd)
  if (
    fragment.charStart < 0
    || fragment.charEnd <= fragment.charStart
    || fragment.charEnd > document.text.length
    || fragment.text !== text
    || (previous !== undefined && fragment.charStart < previous.charEnd)
  ) {
    return Effect.fail(new DocumentChunkingError({
      reason: 'invalid-locator',
      fragment: index,
      message: 'Normalized fragment locators must be ordered and round-trip exactly',
    }))
  }
  const byteStart = previous === undefined
    ? encoder.encode(document.text.slice(0, fragment.charStart)).byteLength
    : previous.byteEnd + encoder.encode(
      document.text.slice(previous.charEnd, fragment.charStart),
    ).byteLength
  const byteEnd = byteStart + encoder.encode(text).byteLength
  if (
    fragment.byteStart !== byteStart
    || fragment.byteEnd !== byteEnd
  ) {
    return Effect.fail(new DocumentChunkingError({
      reason: 'invalid-locator',
      fragment: index,
      message: 'Normalized fragment locators must be ordered and round-trip exactly',
    }))
  }
  return Effect.void
}

interface ChunkGroup {
  readonly first: DocumentFragment
  readonly last: DocumentFragment
}

function splitFragment(
  fragment: DocumentFragment,
  maxCharacters: number,
): ReadonlyArray<DocumentFragment> {
  if (fragment.text.length <= maxCharacters) return [fragment]
  const segments: DocumentFragment[] = []
  let relativeCharStart = 0
  let relativeByteStart = 0
  while (relativeCharStart < fragment.text.length) {
    let relativeCharEnd = Math.min(
      relativeCharStart + maxCharacters,
      fragment.text.length,
    )
    const previousCodeUnit = fragment.text.charCodeAt(relativeCharEnd - 1)
    const nextCodeUnit = fragment.text.charCodeAt(relativeCharEnd)
    if (
      relativeCharEnd < fragment.text.length
      && previousCodeUnit >= 0xD800
      && previousCodeUnit <= 0xDBFF
      && nextCodeUnit >= 0xDC00
      && nextCodeUnit <= 0xDFFF
    ) {
      relativeCharEnd = relativeCharEnd - 1 === relativeCharStart
        ? relativeCharEnd + 1
        : relativeCharEnd - 1
    }
    const text = fragment.text.slice(relativeCharStart, relativeCharEnd)
    const byteLength = encoder.encode(text).byteLength
    segments.push({
      text,
      page: fragment.page,
      section: fragment.section,
      paragraph: fragment.paragraph,
      charStart: fragment.charStart + relativeCharStart,
      charEnd: fragment.charStart + relativeCharEnd,
      byteStart: fragment.byteStart + relativeByteStart,
      byteEnd: fragment.byteStart + relativeByteStart + byteLength,
    })
    relativeCharStart = relativeCharEnd
    relativeByteStart += byteLength
  }
  return segments
}

export const chunkDocument = Effect.fn('chunkDocument')(function* (
  input: ChunkDocumentInput,
) {
  const maxCharacters =
    input.maxCharacters ?? DEFAULT_DOCUMENT_CHUNK_MAX_CHARACTERS
  if (!Number.isSafeInteger(maxCharacters) || maxCharacters <= 0) {
    return yield* new DocumentChunkingError({
      reason: 'invalid-max-characters',
      message: 'Document chunk character limit must be a positive safe integer',
    })
  }
  if (
    input.document.normalizedText !== input.normalized.text
    || input.document.format !== input.normalized.format
  ) {
    return yield* new DocumentChunkingError({
      reason: 'invalid-locator',
      message: 'Normalized document text does not match the document contract',
    })
  }
  if (input.normalized.fragments.length === 0) {
    return yield* new DocumentChunkingError({
      reason: 'empty-document',
      message: 'A normalized document must contain at least one fragment',
    })
  }

  const segments: DocumentFragment[] = []
  let previous: DocumentFragment | undefined
  for (const [index, fragment] of input.normalized.fragments.entries()) {
    yield* validateFragment(input.normalized, fragment, index, previous)
    segments.push(...splitFragment(fragment, maxCharacters))
    previous = fragment
  }

  const groups: ChunkGroup[] = []
  let current: ChunkGroup | undefined
  for (const segment of segments) {
    if (
      current === undefined
      || segment.charEnd - current.first.charStart > maxCharacters
    ) {
      current = { first: segment, last: segment }
      groups.push(current)
    } else {
      current = { first: current.first, last: segment }
      groups[groups.length - 1] = current
    }
  }

  return groups.map((group, ordinal): DomainDocumentChunk => {
    const text = input.normalized.text.slice(
      group.first.charStart,
      group.last.charEnd,
    )
    const samePage = group.first.page === group.last.page
    const sameSection = group.first.section === group.last.section
    const sameParagraph = group.first.paragraph === group.last.paragraph
    return {
      id: makeDocumentChunkId(
        input.document.id,
        DOCUMENT_CHUNKING_VERSION,
        ordinal,
      ),
      documentId: input.document.id,
      sourceVersionId: input.document.sourceVersionId,
      chunkingVersion: DOCUMENT_CHUNKING_VERSION,
      ordinal,
      text,
      textHash: hashDocumentChunkText(text),
      locator: {
        page: samePage ? group.first.page : null,
        section: sameSection ? group.first.section : null,
        paragraph: sameParagraph ? group.first.paragraph : null,
        charStart: group.first.charStart,
        charEnd: group.last.charEnd,
        byteStart: group.first.byteStart,
        byteEnd: group.last.byteEnd,
      },
      createdAt: input.document.createdAt,
    }
  })
})
