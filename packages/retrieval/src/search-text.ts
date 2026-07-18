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
  readonly match_line: number | string
}

const MAX_EXCERPT_CHARS = 1200

function boundedExcerpt(content: string, matchLine: number): { excerpt: string; locator: string } {
  const lines = content.split('\n')
  const startLine = Math.max(0, Math.min(lines.length - 1, matchLine - 1))
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
            `INSERT INTO source_text_index (source_version_id, content)
             SELECT sv.id, $4
             FROM source_versions sv
             JOIN sources s ON s.id = sv.source_id
             JOIN projects p ON p.id = s.project_id
             WHERE sv.id = $3
               AND p.id = $2
               AND p.workspace_id = $1
             ON CONFLICT (source_version_id)
             DO UPDATE SET content = source_text_index.content
             RETURNING source_version_id`,
            [input.workspaceId, input.projectId, input.sourceVersionId, input.content],
          ),
        catch: () =>
          new RetrievalQueryError({
            operation: 'indexText',
            message: 'Normalized source text could not be indexed',
          }),
      }).pipe(
        Effect.flatMap((rows) =>
          rows.length === 1
            ? Effect.void
            : Effect.fail(
                new RetrievalQueryError({
                  operation: 'indexText.scope',
                  message: 'Source version does not belong to the requested workspace and project',
                }),
              ),
        ),
      )
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
            `WITH search_query AS (
               SELECT websearch_to_tsquery('english', $4) AS query,
                      to_tsquery(
                        'english',
                        NULLIF(
                          array_to_string(
                            tsvector_to_array(to_tsvector('english', $4)),
                            ' | '
                          ),
                          ''
                        )
                      ) AS locator_query
             )
             SELECT sti.source_version_id, sti.content,
                    ts_rank_cd(sti.search_vector, search_query.query) AS rank,
                    COALESCE(matched_line.match_line, 1)::int AS match_line
             FROM source_text_index sti
             JOIN source_versions sv ON sv.id = sti.source_version_id
             JOIN sources s ON s.id = sv.source_id
             JOIN projects p ON p.id = s.project_id
             CROSS JOIN search_query
             LEFT JOIN LATERAL (
               SELECT line_number::int AS match_line
               FROM unnest(string_to_array(sti.content, E'\n'))
                 WITH ORDINALITY AS source_lines(line, line_number)
               WHERE to_tsvector('english', source_lines.line) @@ search_query.query
                  OR to_tsvector('english', source_lines.line) @@ search_query.locator_query
               ORDER BY
                 (to_tsvector('english', source_lines.line) @@ search_query.query) DESC,
                 line_number
               LIMIT 1
             ) matched_line ON TRUE
             WHERE p.workspace_id = $1
               AND p.id = $2
               AND sti.source_version_id = ANY($3::uuid[])
               AND sti.search_vector @@ search_query.query
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
        const located = boundedExcerpt(row.content, Number(row.match_line))
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
