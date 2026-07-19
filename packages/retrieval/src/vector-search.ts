import {
  DocumentChunkId,
  DocumentId,
  ProjectId,
  RetrievalQueryError,
  SourceVersionId,
  WorkspaceId,
} from '@struct/domain'
import { SqlClient } from '@struct/persistence'
import { Effect, Schema } from 'effect'
import {
  EmbeddingVector,
  VectorSearchRequest,
  VectorSearchResult,
} from './retrieval-types.js'

export const StoreChunkEmbeddingInput = Schema.Struct({
  workspaceId: WorkspaceId,
  projectId: ProjectId,
  sourceVersionId: SourceVersionId,
  chunkId: DocumentChunkId,
  embeddingModel: Schema.String.pipe(
    Schema.filter((value) => value.trim().length > 0 || 'must not be blank'),
  ),
  embedding: EmbeddingVector,
})
export type StoreChunkEmbeddingInput =
  Schema.Schema.Type<typeof StoreChunkEmbeddingInput>

const VectorRow = Schema.Struct({
  chunk_id: DocumentChunkId,
  document_id: DocumentId,
  source_version_id: SourceVersionId,
  chunking_version: Schema.String,
  ordinal: Schema.Union(Schema.Number, Schema.NumberFromString),
  text: Schema.String,
  page: Schema.NullOr(Schema.Union(Schema.Number, Schema.NumberFromString)),
  section: Schema.NullOr(Schema.String),
  paragraph: Schema.NullOr(
    Schema.Union(Schema.Number, Schema.NumberFromString),
  ),
  char_start: Schema.Union(Schema.Number, Schema.NumberFromString),
  char_end: Schema.Union(Schema.Number, Schema.NumberFromString),
  byte_start: Schema.Union(Schema.Number, Schema.NumberFromString),
  byte_end: Schema.Union(Schema.Number, Schema.NumberFromString),
  channel_rank: Schema.Union(Schema.Number, Schema.NumberFromString),
  channel_score: Schema.Union(Schema.Number, Schema.NumberFromString),
})

function vectorLiteral(embedding: ReadonlyArray<number>): string {
  return `[${embedding.join(',')}]`
}

function rowToCandidate(
  row: Schema.Schema.Type<typeof VectorRow>,
) {
  return {
    chunkId: row.chunk_id,
    documentId: row.document_id,
    sourceVersionId: row.source_version_id,
    chunkingVersion: row.chunking_version,
    ordinal: row.ordinal,
    text: row.text,
    locator: {
      page: row.page,
      section: row.section,
      paragraph: row.paragraph,
      charStart: row.char_start,
      charEnd: row.char_end,
      byteStart: row.byte_start,
      byteEnd: row.byte_end,
    },
    channel: 'vector',
    channelRank: row.channel_rank,
    channelScore: row.channel_score,
  }
}

export class VectorRetrieval extends Effect.Service<VectorRetrieval>()(
  'VectorRetrieval',
  {
    accessors: true,
    effect: Effect.gen(function* () {
      const sql = yield* SqlClient

      const storeEmbedding = Effect.fn('VectorRetrieval.storeEmbedding')(
        function* (input: StoreChunkEmbeddingInput) {
          const decoded = yield* Schema.decodeUnknown(StoreChunkEmbeddingInput)(
            input,
          ).pipe(
            Effect.mapError(() =>
              new RetrievalQueryError({
                operation: 'vectorEmbedding.request',
                message: 'Chunk embedding was invalid',
              }),
            ),
          )
          const rows = yield* Effect.tryPromise({
            try: () => sql.unsafe(
              `INSERT INTO document_chunk_embeddings (
                 chunk_id,
                 document_id,
                 workspace_id,
                 project_id,
                 source_id,
                 source_version_id,
                 chunking_version,
                 embedding_model,
                 dimensions,
                 embedding
               )
               SELECT dc.id,
                      dc.document_id,
                      dc.workspace_id,
                      dc.project_id,
                      dc.source_id,
                      dc.source_version_id,
                      dc.chunking_version,
                      $5,
                      $6,
                      $7::vector
               FROM document_chunks dc
               WHERE dc.id = $4
                 AND dc.workspace_id = $1
                 AND dc.project_id = $2
                 AND dc.source_version_id = $3
               ON CONFLICT (chunk_id, embedding_model)
               DO UPDATE
                 SET embedding = document_chunk_embeddings.embedding
                 WHERE document_chunk_embeddings.dimensions
                         = EXCLUDED.dimensions
                   AND document_chunk_embeddings.embedding
                         = EXCLUDED.embedding
               RETURNING chunk_id`,
              [
                decoded.workspaceId,
                decoded.projectId,
                decoded.sourceVersionId,
                decoded.chunkId,
                decoded.embeddingModel,
                decoded.embedding.length,
                vectorLiteral(decoded.embedding),
              ],
            ),
            catch: () =>
              new RetrievalQueryError({
                operation: 'vectorEmbedding.store',
                message: 'Chunk embedding could not be stored',
              }),
          })
          if (rows.length !== 1) {
            return yield* new RetrievalQueryError({
              operation: 'vectorEmbedding.scope-or-conflict',
              message: 'Chunk scope did not match or embedding was not immutable',
            })
          }
        },
      )

      const search = Effect.fn('VectorRetrieval.search')(function* (
        request: VectorSearchRequest,
      ) {
        const decoded = yield* Schema.decodeUnknown(VectorSearchRequest)(
          request,
        ).pipe(
          Effect.mapError(() =>
            new RetrievalQueryError({
              operation: 'vectorSearch.request',
              message: 'Vector search request was invalid',
            }),
          ),
        )
        const rows = yield* Effect.tryPromise({
          try: () => sql.unsafe(
            `WITH ranked AS (
               SELECT dc.id AS chunk_id,
                      dc.document_id,
                      dc.source_version_id,
                      dc.chunking_version,
                      dc.ordinal,
                      dc.text,
                      dc.page,
                      dc.section,
                      dc.paragraph,
                      dc.char_start,
                      dc.char_end,
                      dc.byte_start,
                      dc.byte_end,
                      1 - (dce.embedding <=> $6::vector) AS channel_score
               FROM document_chunk_embeddings dce
               JOIN document_chunks dc
                 ON dc.id = dce.chunk_id
                AND dc.document_id = dce.document_id
                AND dc.workspace_id = dce.workspace_id
                AND dc.project_id = dce.project_id
                AND dc.source_id = dce.source_id
                AND dc.source_version_id = dce.source_version_id
                AND dc.chunking_version = dce.chunking_version
               WHERE dce.workspace_id = $1
                 AND dce.project_id = $2
                 AND dce.source_version_id = ANY($3::uuid[])
                 AND dce.chunking_version = $4
                 AND dce.embedding_model = $5
                 AND dce.dimensions = $7
             )
             SELECT ranked.*,
                    row_number() OVER (
                      ORDER BY channel_score DESC, chunk_id ASC
                    )::int AS channel_rank
             FROM ranked
             ORDER BY channel_score DESC, chunk_id ASC
             LIMIT $8`,
            [
              decoded.workspaceId,
              decoded.projectId,
              decoded.sourceVersionIds,
              decoded.chunkingVersion,
              decoded.embeddingModel,
              vectorLiteral(decoded.embedding),
              decoded.embedding.length,
              decoded.limit,
            ],
          ),
          catch: () =>
            new RetrievalQueryError({
              operation: 'vectorSearch.query',
              message: 'Vector retrieval failed',
            }),
        })
        const candidates = yield* Effect.forEach(rows, (row) =>
          Schema.decodeUnknown(VectorRow)(row).pipe(
            Effect.map(rowToCandidate),
            Effect.mapError(() =>
              new RetrievalQueryError({
                operation: 'vectorSearch.decode',
                message: 'Vector retrieval returned invalid provenance',
              }),
            ),
          ))
        return yield* Schema.decodeUnknown(VectorSearchResult)({
          candidates,
        }).pipe(
          Effect.mapError(() =>
            new RetrievalQueryError({
              operation: 'vectorSearch.result',
              message: 'Vector retrieval returned invalid candidates',
            }),
          ),
        )
      })

      return { storeEmbedding, search }
    }),
  },
) {}
