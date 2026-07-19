import { RetrievalQueryError } from '@struct/domain'
import { Effect, Schema } from 'effect'
import { KeywordRetrieval } from './full-text.js'
import {
  HybridSearchRequest,
  HybridSearchResult,
} from './retrieval-types.js'
import { VectorRetrieval } from './vector-search.js'

const RECIPROCAL_RANK_OFFSET = 60
type HybridCandidate =
  import('./retrieval-types.js').HybridCandidate
type KeywordCandidate =
  import('./retrieval-types.js').KeywordCandidate
type VectorCandidate =
  import('./retrieval-types.js').VectorCandidate

interface MutableHybridCandidate {
  readonly chunk: KeywordCandidate | VectorCandidate
  keywordRank: number | null
  vectorRank: number | null
  keywordScore: number | null
  vectorScore: number | null
  fusionScore: number
}

export function fuseCandidates(
  keyword: ReadonlyArray<KeywordCandidate>,
  vector: ReadonlyArray<VectorCandidate>,
  limit: number,
): ReadonlyArray<HybridCandidate> {
  const fused = new Map<string, MutableHybridCandidate>()
  for (const candidate of keyword) {
    fused.set(candidate.chunkId, {
      chunk: candidate,
      keywordRank: candidate.channelRank,
      vectorRank: null,
      keywordScore: candidate.channelScore,
      vectorScore: null,
      fusionScore: 1 / (RECIPROCAL_RANK_OFFSET + candidate.channelRank),
    })
  }
  for (const candidate of vector) {
    const existing = fused.get(candidate.chunkId)
    if (existing === undefined) {
      fused.set(candidate.chunkId, {
        chunk: candidate,
        keywordRank: null,
        vectorRank: candidate.channelRank,
        keywordScore: null,
        vectorScore: candidate.channelScore,
        fusionScore: 1 / (RECIPROCAL_RANK_OFFSET + candidate.channelRank),
      })
    } else {
      existing.vectorRank = candidate.channelRank
      existing.vectorScore = candidate.channelScore
      existing.fusionScore +=
        1 / (RECIPROCAL_RANK_OFFSET + candidate.channelRank)
    }
  }
  return [...fused.values()]
    .sort((left, right) =>
      right.fusionScore - left.fusionScore
      || left.chunk.chunkId.localeCompare(right.chunk.chunkId))
    .slice(0, limit)
    .map(({ chunk, ...ranking }) => ({
      chunkId: chunk.chunkId,
      documentId: chunk.documentId,
      sourceVersionId: chunk.sourceVersionId,
      chunkingVersion: chunk.chunkingVersion,
      ordinal: chunk.ordinal,
      text: chunk.text,
      locator: chunk.locator,
      ...ranking,
    }))
}

export class HybridRetrieval extends Effect.Service<HybridRetrieval>()(
  'HybridRetrieval',
  {
    accessors: true,
    dependencies: [KeywordRetrieval.Default, VectorRetrieval.Default],
    effect: Effect.gen(function* () {
      const keywordRetrieval = yield* KeywordRetrieval
      const vectorRetrieval = yield* VectorRetrieval

      const search = Effect.fn('HybridRetrieval.search')(function* (
        request: HybridSearchRequest,
      ) {
        const decoded = yield* Schema.decodeUnknown(HybridSearchRequest)(
          request,
        ).pipe(
          Effect.mapError(() =>
            new RetrievalQueryError({
              operation: 'hybridSearch.request',
              message: 'Hybrid search request was invalid',
            }),
          ),
        )
        const scope = {
          workspaceId: decoded.workspaceId,
          projectId: decoded.projectId,
          sourceVersionIds: decoded.sourceVersionIds,
          chunkingVersion: decoded.chunkingVersion,
          limit: decoded.candidateLimit,
        }
        const [keyword, vector] = yield* Effect.all([
          keywordRetrieval.search({
            ...scope,
            query: decoded.query,
          }),
          vectorRetrieval.search({
            ...scope,
            embeddingModel: decoded.embeddingModel,
            embedding: decoded.embedding,
          }),
        ], { concurrency: 2 })
        return yield* Schema.decodeUnknown(HybridSearchResult)({
          candidates: fuseCandidates(
            keyword.candidates,
            vector.candidates,
            decoded.limit,
          ),
        }).pipe(
          Effect.mapError(() =>
            new RetrievalQueryError({
              operation: 'hybridSearch.result',
              message: 'Hybrid retrieval returned invalid candidates',
            }),
          ),
        )
      })

      return { search }
    }),
  },
) {}
