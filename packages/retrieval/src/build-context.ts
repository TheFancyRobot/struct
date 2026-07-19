import {
  DocumentChunkId,
  DocumentId,
  DocumentLocator,
  SourceVersionId,
} from '@struct/domain'
import { Effect, Schema } from 'effect'
import { HybridRetrieval } from './hybrid-retrieval.js'
// eslint-disable-next-line no-unused-vars -- Type-only namespace is consumed by TypeScript.
import type * as Retrieval from './retrieval-types.js'

const NullableRank = Schema.NullOr(
  Schema.Number.pipe(Schema.int(), Schema.positive()),
)
const NullableScore = Schema.NullOr(
  Schema.Number.pipe(
    Schema.filter((value) => Number.isFinite(value) || 'must be finite'),
  ),
)

export const DocumentContextEvidence = Schema.Struct({
  chunkId: DocumentChunkId,
  documentId: DocumentId,
  sourceVersionId: SourceVersionId,
  chunkingVersion: Schema.String.pipe(Schema.minLength(1)),
  ordinal: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  locator: DocumentLocator,
  citationLocator: Schema.String.pipe(Schema.minLength(1)),
  excerpt: Schema.String.pipe(Schema.minLength(1)),
  trust: Schema.Literal('untrusted-evidence'),
  keywordRank: NullableRank,
  vectorRank: NullableRank,
  keywordScore: NullableScore,
  vectorScore: NullableScore,
  fusionScore: Schema.Number.pipe(
    Schema.filter((value) => Number.isFinite(value) || 'must be finite'),
  ),
})
export type DocumentContextEvidence =
  Schema.Schema.Type<typeof DocumentContextEvidence>

export const DocumentResearchContext = Schema.Struct({
  evidence: Schema.Array(DocumentContextEvidence),
})
export type DocumentResearchContext =
  Schema.Schema.Type<typeof DocumentResearchContext>

export function encodeDocumentLocator(
  locator: typeof DocumentLocator.Type,
): string {
  const parts = [
    `chars:${locator.charStart}-${locator.charEnd}`,
    `bytes:${locator.byteStart}-${locator.byteEnd}`,
  ]
  if (locator.page !== null) parts.unshift(`page:${locator.page}`)
  if (locator.paragraph !== null) parts.unshift(`paragraph:${locator.paragraph}`)
  if (locator.section !== null) {
    parts.unshift(`section:${encodeURIComponent(locator.section)}`)
  }
  return `document:${parts.join(',')}`
}

export function buildDocumentContext(
  candidates: ReadonlyArray<Retrieval.HybridCandidate>,
): DocumentResearchContext {
  return {
    evidence: candidates.map((candidate) => ({
      chunkId: candidate.chunkId,
      documentId: candidate.documentId,
      sourceVersionId: candidate.sourceVersionId,
      chunkingVersion: candidate.chunkingVersion,
      ordinal: candidate.ordinal,
      locator: candidate.locator,
      citationLocator: encodeDocumentLocator(candidate.locator),
      excerpt: candidate.text,
      trust: 'untrusted-evidence',
      keywordRank: candidate.keywordRank,
      vectorRank: candidate.vectorRank,
      keywordScore: candidate.keywordScore,
      vectorScore: candidate.vectorScore,
      fusionScore: candidate.fusionScore,
    })),
  }
}

export class DocumentContextBuilder extends Effect.Service<DocumentContextBuilder>()(
  'DocumentContextBuilder',
  {
    accessors: true,
    dependencies: [HybridRetrieval.Default],
    effect: Effect.gen(function* () {
      const retrieval = yield* HybridRetrieval

      const build = Effect.fn('DocumentContextBuilder.build')(function* (
        request: Retrieval.HybridSearchRequest,
      ) {
        const result = yield* retrieval.search(request)
        return yield* Schema.decodeUnknown(DocumentResearchContext)(
          buildDocumentContext(result.candidates),
        )
      })

      return { build }
    }),
  },
) {}
