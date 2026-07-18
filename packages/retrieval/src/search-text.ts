import { Effect, Schema } from 'effect'
import {
  ProjectId,
  RetrievalQueryError,
  SourceVersionId,
  TextEvidence,
  WorkspaceId,
} from '@struct/domain'
import { SqlClient } from '@struct/persistence'

export const TextSearchRequest = Schema.Struct({
  workspaceId: WorkspaceId,
  projectId: ProjectId,
  sourceVersionIds: Schema.Array(SourceVersionId).pipe(Schema.minItems(1)),
  query: Schema.String.pipe(Schema.minLength(1)),
  limit: Schema.Number.pipe(Schema.int(), Schema.between(1, 10)),
})
export type TextSearchRequest = Schema.Schema.Type<typeof TextSearchRequest>

export const TextSearchResult = Schema.Struct({
  evidence: Schema.Array(TextEvidence),
})
export type TextSearchResult = Schema.Schema.Type<typeof TextSearchResult>

export interface IndexTextInput {
  readonly workspaceId: typeof WorkspaceId.Type
  readonly projectId: typeof ProjectId.Type
  readonly sourceVersionId: typeof SourceVersionId.Type
  readonly content: string
}

interface SearchRow {
  readonly source_version_id: string
  readonly content: string
  readonly rank: number | string
}

const MAX_EXCERPT_CHARS = 1200

function boundedExcerpt(content: string, query: string): { excerpt: string; locator: string } {
  const terms = query.toLocaleLowerCase().match(/[\p{L}\p{N}_-]+/gu) ?? []
  const lines = content.split('\n')
  const lineIndex = lines.findIndex((line) => {
    const normalized = line.toLocaleLowerCase()
    return terms.some((term) => normalized.includes(term))
  })
  const startLine = lineIndex < 0 ? 0 : lineIndex
  const excerptLines = lines.slice(startLine, startLine + 6)
  const excerpt = excerptLines.join('\n').slice(0, MAX_EXCERPT_CHARS)
  const endLine = startLine + Math.max(1, excerptLines.length)
  return {
    excerpt,
    locator: `lines:${startLine + 1}-${endLine}`,
  }
}

export class TextRetrieval extends Effect.Service<TextRetrieval>()('TextRetrieval', {
  accessors: true,
  effect: Effect.gen(function* () {
    const sql = yield* SqlClient

    const indexText = Effect.fn('TextRetrieval.indexText')(function* (input: IndexTextInput) {
      yield* Effect.tryPromise({
        try: () =>
          sql.unsafe(
            `INSERT INTO source_text_index (source_version_id, workspace_id, project_id, content)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (source_version_id) DO NOTHING`,
            [input.sourceVersionId, input.workspaceId, input.projectId, input.content],
          ),
        catch: () =>
          new RetrievalQueryError({
            operation: 'indexText',
            message: 'Normalized source text could not be indexed',
          }),
      })
    })

    const searchText = Effect.fn('TextRetrieval.searchText')(function* (request: TextSearchRequest) {
      const decoded = yield* Schema.decodeUnknown(TextSearchRequest)(request).pipe(
        Effect.mapError(() =>
          new RetrievalQueryError({
            operation: 'searchText',
            message: 'Text search request was invalid',
          }),
        ),
      )
      const rows = yield* Effect.tryPromise({
        try: () =>
          sql.unsafe(
            `SELECT source_version_id, content,
                    ts_rank_cd(search_vector, websearch_to_tsquery('english', $4)) AS rank
             FROM source_text_index
             WHERE workspace_id = $1
               AND project_id = $2
               AND source_version_id = ANY($3::uuid[])
               AND search_vector @@ websearch_to_tsquery('english', $4)
             ORDER BY rank DESC, source_version_id ASC
             LIMIT $5`,
            [
              decoded.workspaceId,
              decoded.projectId,
              decoded.sourceVersionIds,
              decoded.query,
              decoded.limit,
            ],
          ),
        catch: () =>
          new RetrievalQueryError({
            operation: 'searchText',
            message: 'Deterministic text search failed',
          }),
      })

      const evidence = (rows as unknown as readonly SearchRow[]).map((row) => {
        const located = boundedExcerpt(row.content, decoded.query)
        return {
          sourceVersionId: SourceVersionId.make(row.source_version_id),
          locator: located.locator,
          excerpt: located.excerpt,
          rank: Number(row.rank),
        }
      })
      return yield* Schema.decodeUnknown(TextSearchResult)({ evidence }).pipe(
        Effect.mapError(() =>
          new RetrievalQueryError({
            operation: 'searchText.decode',
            message: 'Text search returned an invalid result',
          }),
        ),
      )
    })

    return { indexText, searchText }
  }),
}) {}
