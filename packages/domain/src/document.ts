import { Schema } from 'effect'
import {
  DocumentChunkId,
  DocumentId,
  SourceVersionId,
} from './branded-ids.js'

export const DocumentFormat = Schema.Literal('pdf', 'html', 'markdown', 'text')
export type DocumentFormat = Schema.Schema.Type<typeof DocumentFormat>

const NonNegativeInteger = Schema.Number.pipe(Schema.int(), Schema.nonNegative())
const PositiveInteger = Schema.Number.pipe(Schema.int(), Schema.positive())
const NonEmptyString = Schema.String.pipe(Schema.minLength(1))

export const DocumentLocator = Schema.Struct({
  page: Schema.NullOr(PositiveInteger),
  section: Schema.NullOr(NonEmptyString),
  paragraph: Schema.NullOr(PositiveInteger),
  charStart: NonNegativeInteger,
  charEnd: NonNegativeInteger,
  byteStart: NonNegativeInteger,
  byteEnd: NonNegativeInteger,
}).pipe(
  Schema.filter((locator) => [
    locator.charEnd > locator.charStart
      ? undefined
      : 'charEnd must be greater than charStart',
    locator.byteEnd > locator.byteStart
      ? undefined
      : 'byteEnd must be greater than byteStart',
  ]),
)
export type DocumentLocator = Schema.Schema.Type<typeof DocumentLocator>

export function makeDocumentChunkId(
  documentId: DocumentId,
  chunkingVersion: string,
  ordinal: number,
): DocumentChunkId {
  const hex = new Bun.CryptoHasher('sha256')
    .update(`${documentId}\u0000${chunkingVersion}\u0000${ordinal}`)
    .digest('hex')
  const versioned = `${hex.slice(0, 12)}5${hex.slice(13, 16)}${(
    Number.parseInt(hex[16] ?? '0', 16) & 0x3 | 0x8
  ).toString(16)}${hex.slice(17, 32)}`
  return DocumentChunkId.make(
    `${versioned.slice(0, 8)}-${versioned.slice(8, 12)}-${versioned.slice(12, 16)}-${versioned.slice(16, 20)}-${versioned.slice(20)}`,
  )
}

export function hashDocumentChunkText(text: string): string {
  return `sha256:${new Bun.CryptoHasher('sha256').update(text).digest('hex')}`
}

export const Document = Schema.Struct({
  id: DocumentId,
  sourceVersionId: SourceVersionId,
  format: DocumentFormat,
  normalizedText: Schema.String,
  contentHash: NonEmptyString,
  parserVersion: NonEmptyString,
  createdAt: Schema.BigIntFromNumber,
})
export type Document = Schema.Schema.Type<typeof Document>

export const DocumentChunk = Schema.Struct({
  id: DocumentChunkId,
  documentId: DocumentId,
  sourceVersionId: SourceVersionId,
  chunkingVersion: NonEmptyString,
  ordinal: NonNegativeInteger,
  text: NonEmptyString,
  textHash: NonEmptyString,
  locator: DocumentLocator,
  createdAt: Schema.BigIntFromNumber,
})
export type DocumentChunk = Schema.Schema.Type<typeof DocumentChunk>
