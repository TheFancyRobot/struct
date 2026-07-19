import {
  DocumentChunkId,
  DocumentId,
  RetrievalQueryError,
  SourceVersionId,
} from '@struct/domain'
import { SqlClient } from '@struct/persistence'
import { Effect, Schema } from 'effect'
import {
  KeywordSearchRequest,
  KeywordSearchResult,
} from './retrieval-types.js'

const KeywordRow = Schema.Struct({
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

function rowToCandidate(
  row: Schema.Schema.Type<typeof KeywordRow>,
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
    channel: 'keyword',
    channelRank: row.channel_rank,
    channelScore: row.channel_score,
  }
}

export class KeywordRetrieval extends Effect.Service<KeywordRetrieval>()(
  'KeywordRetrieval',
  {
    accessors: true,
    effect: Effect.gen(function* () {
      const sql = yield* SqlClient

      const search = Effect.fn('KeywordRetrieval.search')(function* (
        request: KeywordSearchRequest,
      ) {
        const decoded = yield* Schema.decodeUnknown(KeywordSearchRequest)(
          request,
        ).pipe(
          Effect.mapError(() =>
            new RetrievalQueryError({
              operation: 'keywordSearch.request',
              message: 'Keyword search request was invalid',
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
                      ts_rank_cd(
                        dc.search_vector,
                        websearch_to_tsquery('english', $5)
                      ) AS channel_score
               FROM document_chunks dc
               WHERE dc.workspace_id = $1
                 AND dc.project_id = $2
                 AND dc.source_version_id = ANY($3::uuid[])
                 AND dc.chunking_version = $4
                 AND dc.search_vector
                   @@ websearch_to_tsquery('english', $5)
             )
             SELECT ranked.*,
                    row_number() OVER (
                      ORDER BY channel_score DESC, chunk_id ASC
                    )::int AS channel_rank
             FROM ranked
             ORDER BY channel_score DESC, chunk_id ASC
             LIMIT $6`,
            [
              decoded.workspaceId,
              decoded.projectId,
              decoded.sourceVersionIds,
              decoded.chunkingVersion,
              decoded.query,
              decoded.limit,
            ],
          ),
          catch: () =>
            new RetrievalQueryError({
              operation: 'keywordSearch.query',
              message: 'Keyword retrieval failed',
            }),
        })
        const candidates = yield* Effect.forEach(rows, (row) =>
          Schema.decodeUnknown(KeywordRow)(row).pipe(
            Effect.map(rowToCandidate),
            Effect.mapError(() =>
              new RetrievalQueryError({
                operation: 'keywordSearch.decode',
                message: 'Keyword retrieval returned invalid provenance',
              }),
            ),
          ))
        return yield* Schema.decodeUnknown(KeywordSearchResult)({
          candidates,
        }).pipe(
          Effect.mapError(() =>
            new RetrievalQueryError({
              operation: 'keywordSearch.result',
              message: 'Keyword retrieval returned invalid candidates',
            }),
          ),
        )
      })

      return { search }
    }),
  },
) {}
