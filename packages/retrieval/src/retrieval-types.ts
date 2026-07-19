import {
  DocumentChunkId,
  DocumentId,
  DocumentLocator,
  ProjectId,
  SourceVersionId,
  WorkspaceId,
} from '@struct/domain'
import { Schema } from 'effect'

const NonBlankString = Schema.String.pipe(
  Schema.filter((value) => value.trim().length > 0 || 'must not be blank'),
)
const CandidateLimit = Schema.Number.pipe(Schema.int(), Schema.between(1, 50))

export const RetrievalScope = Schema.Struct({
  workspaceId: WorkspaceId,
  projectId: ProjectId,
  sourceVersionIds: Schema.Array(SourceVersionId).pipe(Schema.minItems(1)),
  chunkingVersion: NonBlankString,
  limit: CandidateLimit,
})
export type RetrievalScope = Schema.Schema.Type<typeof RetrievalScope>

export const KeywordSearchRequest = Schema.Struct({
  ...RetrievalScope.fields,
  query: NonBlankString,
})
export type KeywordSearchRequest = Schema.Schema.Type<typeof KeywordSearchRequest>

export const EmbeddingVector = Schema.Array(
  Schema.Number.pipe(
    Schema.filter(
      (value) =>
        (
          Number.isFinite(value)
          && Number.isFinite(Math.fround(value))
        )
        || 'must be representable as a finite pgvector component',
    ),
  ),
).pipe(
  Schema.minItems(1),
  Schema.maxItems(16_000),
  Schema.filter(
    (embedding) =>
      embedding.some((value) => Math.fround(value) !== 0)
      || 'cosine search requires a non-zero vector',
  ),
)
export type EmbeddingVector = Schema.Schema.Type<typeof EmbeddingVector>

export const VectorSearchRequest = Schema.Struct({
  ...RetrievalScope.fields,
  embeddingModel: NonBlankString,
  embedding: EmbeddingVector,
})
export type VectorSearchRequest = Schema.Schema.Type<typeof VectorSearchRequest>

export const RetrievalChunk = Schema.Struct({
  chunkId: DocumentChunkId,
  documentId: DocumentId,
  sourceVersionId: SourceVersionId,
  chunkingVersion: NonBlankString,
  ordinal: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  text: Schema.String.pipe(Schema.minLength(1)),
  locator: DocumentLocator,
})
export type RetrievalChunk = Schema.Schema.Type<typeof RetrievalChunk>

export const KeywordCandidate = Schema.Struct({
  ...RetrievalChunk.fields,
  channel: Schema.Literal('keyword'),
  channelRank: Schema.Number.pipe(Schema.int(), Schema.positive()),
  channelScore: Schema.Number.pipe(
    Schema.filter((value) => Number.isFinite(value) || 'must be finite'),
  ),
})
export type KeywordCandidate = Schema.Schema.Type<typeof KeywordCandidate>

export const VectorCandidate = Schema.Struct({
  ...RetrievalChunk.fields,
  channel: Schema.Literal('vector'),
  channelRank: Schema.Number.pipe(Schema.int(), Schema.positive()),
  channelScore: Schema.Number.pipe(
    Schema.filter((value) => Number.isFinite(value) || 'must be finite'),
  ),
})
export type VectorCandidate = Schema.Schema.Type<typeof VectorCandidate>

export const HybridSearchRequest = Schema.Struct({
  ...RetrievalScope.fields,
  query: NonBlankString,
  embeddingModel: NonBlankString,
  embedding: EmbeddingVector,
  candidateLimit: CandidateLimit,
})
export type HybridSearchRequest = Schema.Schema.Type<typeof HybridSearchRequest>

export const HybridCandidate = Schema.Struct({
  ...RetrievalChunk.fields,
  keywordRank: Schema.NullOr(
    Schema.Number.pipe(Schema.int(), Schema.positive()),
  ),
  vectorRank: Schema.NullOr(
    Schema.Number.pipe(Schema.int(), Schema.positive()),
  ),
  keywordScore: Schema.NullOr(Schema.Number),
  vectorScore: Schema.NullOr(Schema.Number),
  fusionScore: Schema.Number.pipe(
    Schema.filter((value) => Number.isFinite(value) || 'must be finite'),
  ),
})
export type HybridCandidate = Schema.Schema.Type<typeof HybridCandidate>

export const KeywordSearchResult = Schema.Struct({
  candidates: Schema.Array(KeywordCandidate),
})
export type KeywordSearchResult = Schema.Schema.Type<typeof KeywordSearchResult>

export const VectorSearchResult = Schema.Struct({
  candidates: Schema.Array(VectorCandidate),
})
export type VectorSearchResult = Schema.Schema.Type<typeof VectorSearchResult>

export const HybridSearchResult = Schema.Struct({
  candidates: Schema.Array(HybridCandidate),
})
export type HybridSearchResult = Schema.Schema.Type<typeof HybridSearchResult>
