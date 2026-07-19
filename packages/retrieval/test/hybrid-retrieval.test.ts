import { describe, expect, it } from 'bun:test'
import {
  DocumentChunkId,
  DocumentId,
  ProjectId,
  SourceVersionId,
  WorkspaceId,
} from '@struct/domain'
import { SqlClientTest } from '@struct/persistence'
import { Effect, Layer } from 'effect'
import { KeywordRetrieval } from '../src/full-text.js'
import { fuseCandidates } from '../src/hybrid-retrieval.js'
import type {
  KeywordCandidate,
  VectorCandidate,
} from '../src/retrieval-types.js'
import { VectorRetrieval } from '../src/vector-search.js'

const workspaceId = WorkspaceId.make('b50e8400-e29b-41d4-a716-446655440000')
const projectId = ProjectId.make('b50e8400-e29b-41d4-a716-446655440001')
const sourceVersionId = SourceVersionId.make(
  'b50e8400-e29b-41d4-a716-446655440002',
)
const documentId = DocumentId.make('b50e8400-e29b-41d4-a716-446655440003')
const chunkIds = [
  DocumentChunkId.make('b50e8400-e29b-41d4-a716-446655440004'),
  DocumentChunkId.make('b50e8400-e29b-41d4-a716-446655440005'),
] as const

function keyword(
  index: 0 | 1,
  rank: number,
  score: number,
): KeywordCandidate {
  return {
    chunkId: chunkIds[index],
    documentId,
    sourceVersionId,
    chunkingVersion: 'fragments-v1',
    ordinal: index,
    text: `chunk ${index}`,
    locator: {
      page: null,
      section: null,
      paragraph: index + 1,
      charStart: index * 10,
      charEnd: index * 10 + 7,
      byteStart: index * 10,
      byteEnd: index * 10 + 7,
    },
    channel: 'keyword',
    channelRank: rank,
    channelScore: score,
  }
}

function vector(
  index: 0 | 1,
  rank: number,
  score: number,
): VectorCandidate {
  return {
    ...keyword(index, rank, score),
    channel: 'vector',
  }
}

describe('hybrid retrieval', () => {
  it('fuses channel ranks transparently and breaks exact ties by chunk identity', () => {
    const result = fuseCandidates(
      [keyword(1, 1, 0.9), keyword(0, 2, 0.8)],
      [vector(0, 1, 0.95), vector(1, 2, 0.7)],
      2,
    )

    expect(result.map((candidate) => candidate.chunkId)).toEqual([...chunkIds])
    expect(result[0]).toMatchObject({
      keywordRank: 2,
      vectorRank: 1,
      keywordScore: 0.8,
      vectorScore: 0.95,
    })
    expect(result[1]).toMatchObject({
      keywordRank: 1,
      vectorRank: 2,
      keywordScore: 0.9,
      vectorScore: 0.7,
    })
    expect(result[0]?.fusionScore).toBe(result[1]?.fusionScore)
  })

  it('keeps single-channel candidates and applies the final bound', () => {
    const result = fuseCandidates(
      [keyword(0, 1, 0.8)],
      [vector(1, 1, 0.7)],
      1,
    )

    expect(result).toHaveLength(1)
    expect(result[0]?.chunkId).toBe(chunkIds[0])
    expect(result[0]).toMatchObject({
      keywordRank: 1,
      vectorRank: null,
    })
  })

  it('rejects blank, non-finite, and zero-vector requests before issuing SQL', async () => {
    let calls = 0
    const sqlLayer = SqlClientTest(async () => {
      calls += 1
      return []
    })
    const keywordLayer = Layer.provide(KeywordRetrieval.Default, sqlLayer)
    const vectorLayer = Layer.provide(VectorRetrieval.Default, sqlLayer)

    const keywordExit = await Effect.runPromiseExit(
      KeywordRetrieval.search({
        workspaceId,
        projectId,
        sourceVersionIds: [sourceVersionId],
        chunkingVersion: 'fragments-v1',
        query: '   ',
        limit: 5,
      }).pipe(Effect.provide(keywordLayer)),
    )
    const vectorExit = await Effect.runPromiseExit(
      VectorRetrieval.search({
        workspaceId,
        projectId,
        sourceVersionIds: [sourceVersionId],
        chunkingVersion: 'fragments-v1',
        embeddingModel: 'test-v1',
        embedding: [Number.NaN],
        limit: 5,
      }).pipe(Effect.provide(vectorLayer)),
    )
    const zeroVectorExit = await Effect.runPromiseExit(
      VectorRetrieval.search({
        workspaceId,
        projectId,
        sourceVersionIds: [sourceVersionId],
        chunkingVersion: 'fragments-v1',
        embeddingModel: 'test-v1',
        embedding: [0, 0, 0],
        limit: 5,
      }).pipe(Effect.provide(vectorLayer)),
    )
    const underflowVectorExit = await Effect.runPromiseExit(
      VectorRetrieval.search({
        workspaceId,
        projectId,
        sourceVersionIds: [sourceVersionId],
        chunkingVersion: 'fragments-v1',
        embeddingModel: 'test-v1',
        embedding: [1e-50],
        limit: 5,
      }).pipe(Effect.provide(vectorLayer)),
    )
    const overflowVectorExit = await Effect.runPromiseExit(
      VectorRetrieval.search({
        workspaceId,
        projectId,
        sourceVersionIds: [sourceVersionId],
        chunkingVersion: 'fragments-v1',
        embeddingModel: 'test-v1',
        embedding: [Number.MAX_VALUE],
        limit: 5,
      }).pipe(Effect.provide(vectorLayer)),
    )

    expect(keywordExit._tag).toBe('Failure')
    expect(vectorExit._tag).toBe('Failure')
    expect(zeroVectorExit._tag).toBe('Failure')
    expect(underflowVectorExit._tag).toBe('Failure')
    expect(overflowVectorExit._tag).toBe('Failure')
    expect(calls).toBe(0)
  })

  it('uses complete tenant and immutable-version filters in both channels', async () => {
    const calls: Array<{ query: string; params?: readonly unknown[] }> = []
    const sqlLayer = SqlClientTest(async (query, params) => {
      calls.push({ query, params })
      return []
    })
    const keywordLayer = Layer.provide(KeywordRetrieval.Default, sqlLayer)
    const vectorLayer = Layer.provide(VectorRetrieval.Default, sqlLayer)

    await Effect.runPromise(
      KeywordRetrieval.search({
        workspaceId,
        projectId,
        sourceVersionIds: [sourceVersionId],
        chunkingVersion: 'fragments-v1',
        query: 'needle',
        limit: 5,
      }).pipe(Effect.provide(keywordLayer)),
    )
    await Effect.runPromise(
      VectorRetrieval.search({
        workspaceId,
        projectId,
        sourceVersionIds: [sourceVersionId],
        chunkingVersion: 'fragments-v1',
        embeddingModel: 'test-v1',
        embedding: [1, 0, 0],
        limit: 5,
      }).pipe(Effect.provide(vectorLayer)),
    )

    expect(calls[0]?.query).toMatch(/workspace_id = \$1/)
    expect(calls[0]?.query).toMatch(/project_id = \$2/)
    expect(calls[0]?.query).toMatch(/source_version_id = ANY\(\$3::uuid\[\]\)/)
    expect(calls[0]?.query).toMatch(/chunking_version = \$4/)
    expect(calls[1]?.query).toMatch(/document_chunk_embeddings/)
    expect(calls[1]?.query).toMatch(/embedding_model = \$5/)
    expect(calls[1]?.query).toMatch(/dimensions = \$7/)
    expect(calls[1]?.query).toMatch(/ORDER BY channel_score DESC, chunk_id ASC/)
  })

  it('stores only scoped immutable embeddings', async () => {
    const calls: Array<{ query: string; params?: readonly unknown[] }> = []
    const sqlLayer = SqlClientTest(async (query, params) => {
      calls.push({ query, params })
      return [{ chunk_id: chunkIds[0] }]
    })
    const layer = Layer.provide(VectorRetrieval.Default, sqlLayer)

    await Effect.runPromise(
      VectorRetrieval.storeEmbedding({
        workspaceId,
        projectId,
        sourceVersionId,
        chunkId: chunkIds[0],
        embeddingModel: 'test-v1',
        embedding: [1, 0, 0],
      }).pipe(Effect.provide(layer)),
    )

    expect(calls[0]?.query).toMatch(/FROM document_chunks dc/)
    expect(calls[0]?.query).toMatch(/ON CONFLICT \(chunk_id, embedding_model\)/)
    expect(calls[0]?.query).toMatch(/document_chunk_embeddings\.embedding\s+= EXCLUDED\.embedding/)
    expect(calls[0]?.params).toEqual([
      workspaceId,
      projectId,
      sourceVersionId,
      chunkIds[0],
      'test-v1',
      3,
      '[1,0,0]',
    ])
  })

  it('reports immutable embedding conflicts without masking them as success', async () => {
    const sqlLayer = SqlClientTest(async () => [])
    const layer = Layer.provide(VectorRetrieval.Default, sqlLayer)

    const conflict = await Effect.runPromiseExit(
      VectorRetrieval.storeEmbedding({
        workspaceId,
        projectId,
        sourceVersionId,
        chunkId: chunkIds[0],
        embeddingModel: 'test-v1',
        embedding: [1, 0, 0],
      }).pipe(Effect.provide(layer)),
    )

    expect(conflict._tag).toBe('Failure')
    expect(String(conflict)).toContain('vectorEmbedding.scope-or-conflict')
  })
})
