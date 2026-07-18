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
  /**
   * The incremented attempt number returned by a durable reindex claim.
   * Omit only for ingestion, which may finalize unclaimed work or observe an
   * independently owned/completed lease without taking worker ownership.
   */
  readonly reindexAttempt?: number
}

interface SearchRow {
  readonly source_version_id: string
  readonly content: string
  readonly rank: number | string
  readonly match_line: number | string
  readonly match_passages?: unknown
}

const MAX_EXCERPT_CHARS = 1200
const MAX_CONTEXT_CHARS_PER_SIDE = 120
const MATCH_START = '\uE000'
const MATCH_END = '\uE001'
const OMITTED_SOURCE = '\n…\n'

interface MatchPassage {
  readonly lineNumber: number
  readonly highlightedLine: string
}

interface MatchRange {
  readonly lineIndex: number
  readonly start: number
  readonly end: number
  readonly key: string
}

interface SourceRange {
  readonly lineIndex: number
  readonly start: number
  readonly end: number
}

function fallbackExcerpt(content: string, matchLine: number): { excerpt: string; locator: string } {
  const lines = content.split('\n')
  const startLine = Math.max(0, Math.min(lines.length - 1, matchLine - 1))
  const excerptLines = lines.slice(startLine, startLine + 6)
  const excerpt = excerptLines.join('\n')
  if (excerpt.length > MAX_EXCERPT_CHARS) {
    throw new Error('A bounded excerpt requires PostgreSQL match positions')
  }
  const endLine = startLine + Math.max(1, excerptLines.length)
  return {
    excerpt,
    locator: `lines:${startLine + 1}-${endLine}`,
  }
}

function decodeMatchPassages(value: unknown): ReadonlyArray<MatchPassage> {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (typeof item !== 'object' || item === null) return []
    const record = item as Record<string, unknown>
    const lineNumber = Number(record['line_number'])
    const highlightedLine = record['highlighted_line']
    return Number.isInteger(lineNumber) && lineNumber > 0 && typeof highlightedLine === 'string'
      ? [{ lineNumber, highlightedLine }]
      : []
  })
}

function matchRanges(
  content: string,
  passages: ReadonlyArray<MatchPassage>,
): ReadonlyArray<MatchRange> {
  const lines = content.split('\n')
  const matches: MatchRange[] = []

  for (const passage of passages) {
    const lineIndex = passage.lineNumber - 1
    const sourceLine = lines[lineIndex]
    if (sourceLine === undefined) continue

    let cursor = 0
    let plain = ''
    const lineMatches: Array<{ start: number; end: number; key: string }> = []
    while (cursor < passage.highlightedLine.length) {
      const markedStart = passage.highlightedLine.indexOf(MATCH_START, cursor)
      if (markedStart === -1) {
        plain += passage.highlightedLine.slice(cursor)
        break
      }
      plain += passage.highlightedLine.slice(cursor, markedStart)
      const markedEnd = passage.highlightedLine.indexOf(MATCH_END, markedStart + MATCH_START.length)
      if (markedEnd === -1) break
      const matchedText = passage.highlightedLine.slice(markedStart + MATCH_START.length, markedEnd)
      const start = plain.length
      plain += matchedText
      if (matchedText.length > 0) {
        lineMatches.push({
          start,
          end: plain.length,
          key: matchedText.toLocaleLowerCase('en-US'),
        })
      }
      cursor = markedEnd + MATCH_END.length
    }

    // PostgreSQL's HighlightAll output should be the source line plus markers. Ignore
    // malformed marker output here; the caller fails closed instead of emitting offsets
    // that do not address the immutable source text.
    if (plain !== sourceLine) continue
    matches.push(...lineMatches.map((match) => ({ lineIndex, ...match })))
  }

  const seen = new Set<string>()
  return matches
    .sort((left, right) =>
      left.lineIndex - right.lineIndex
      || left.start - right.start
      || left.end - right.end)
    .filter((match) => {
      if (seen.has(match.key)) return false
      seen.add(match.key)
      return true
    })
}

function mergeRanges(ranges: ReadonlyArray<SourceRange>): ReadonlyArray<SourceRange> {
  const merged: SourceRange[] = []
  for (const range of ranges) {
    const previous = merged.at(-1)
    if (previous?.lineIndex === range.lineIndex && range.start <= previous.end) {
      merged[merged.length - 1] = {
        lineIndex: previous.lineIndex,
        start: previous.start,
        end: Math.max(previous.end, range.end),
      }
    } else {
      merged.push(range)
    }
  }
  return merged
}

function matchedExcerpt(
  content: string,
  passages: ReadonlyArray<MatchPassage>,
  fallbackMatchLine: number,
): { excerpt: string; locator: string } {
  const lines = content.split('\n')
  const matches = matchRanges(content, passages)
  if (matches.length === 0) {
    if (passages.length > 0) {
      throw new Error('PostgreSQL match positions did not address the source text')
    }
    return fallbackExcerpt(content, fallbackMatchLine)
  }

  const firstLine = matches[0]!.lineIndex
  const lastLine = matches.at(-1)!.lineIndex
  if (lastLine - firstLine < 6) {
    const excerptLines = lines.slice(firstLine, firstLine + 6)
    const excerpt = excerptLines.join('\n')
    if (excerpt.length <= MAX_EXCERPT_CHARS) {
      return {
        excerpt,
        locator: `lines:${firstLine + 1}-${firstLine + Math.max(1, excerptLines.length)}`,
      }
    }
  }

  const separatorChars = OMITTED_SOURCE.length * Math.max(0, matches.length - 1)
  const matchedChars = matches.reduce((total, match) => total + match.end - match.start, 0)
  const contextBudget = MAX_EXCERPT_CHARS - separatorChars - matchedChars
  if (contextBudget < 0) {
    throw new Error('Matched terms cannot be represented inside the bounded evidence excerpt')
  }
  const contextPerSide = Math.min(
    MAX_CONTEXT_CHARS_PER_SIDE,
    Math.floor(contextBudget / Math.max(1, matches.length * 2)),
  )
  const sourceRanges = mergeRanges(matches.map((match) => {
    const line = lines[match.lineIndex]!
    const desiredLength = match.end - match.start + contextPerSide * 2
    let start = Math.max(0, match.start - contextPerSide)
    const end = Math.min(line.length, start + desiredLength)
    start = Math.max(0, end - desiredLength)
    return { lineIndex: match.lineIndex, start, end }
  }))

  const excerpt = sourceRanges
    .map((range) => lines[range.lineIndex]!.slice(range.start, range.end))
    .join(OMITTED_SOURCE)
  if (excerpt.length > MAX_EXCERPT_CHARS) {
    throw new Error('Matched terms cannot be represented inside the bounded evidence excerpt')
  }
  const locator = sourceRanges.map((range) => {
    const line = lines[range.lineIndex]!
    return range.start === 0 && range.end === line.length
      ? `lines:${range.lineIndex + 1}-${range.lineIndex + 1}`
      : `line:${range.lineIndex + 1},chars:${range.start + 1}-${range.end}`
  }).join(';')
  return { excerpt, locator }
}

export class TextRetrieval extends Effect.Service<TextRetrieval>()('TextRetrieval', {
  accessors: true,
  effect: Effect.gen(function* () {
    const sql = yield* SqlClient

    const indexText = Effect.fn('TextRetrieval.indexText')(function* (input: IndexTextInput) {
      yield* Effect.tryPromise({
        try: () =>
          sql.transaction(async (transaction) => {
            const indexed = await transaction.unsafe(
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
               WHERE source_text_index.content = EXCLUDED.content
               RETURNING source_version_id`,
              [input.workspaceId, input.projectId, input.sourceVersionId, input.content],
            )
            if (indexed.length !== 1) return indexed
            const completed = input.reindexAttempt === undefined
              ? await transaction.unsafe(
                  `UPDATE source_text_reindex_jobs
                   SET status = CASE
                         WHEN status IN ('pending', 'failed') THEN 'completed'
                         ELSE status
                       END,
                       last_error_code = CASE
                         WHEN status IN ('pending', 'failed') THEN NULL
                         ELSE last_error_code
                       END,
                       updated_at = CASE
                         WHEN status IN ('pending', 'failed') THEN NOW()
                         ELSE updated_at
                       END
                   WHERE source_version_id = $1
                     AND workspace_id = $2
                     AND project_id = $3
                     AND status IN ('pending', 'failed', 'in-progress', 'completed')
                   RETURNING source_version_id`,
                  [
                    input.sourceVersionId,
                    input.workspaceId,
                    input.projectId,
                  ],
                )
              : await transaction.unsafe(
                  `UPDATE source_text_reindex_jobs
                   SET status = 'completed',
                       last_error_code = NULL,
                       updated_at = NOW()
                   WHERE source_version_id = $1
                     AND workspace_id = $2
                     AND project_id = $3
                     AND status = 'in-progress'
                     AND attempts = $4
                   RETURNING source_version_id`,
                  [
                    input.sourceVersionId,
                    input.workspaceId,
                    input.projectId,
                    input.reindexAttempt,
                  ],
                )
            if (completed.length !== 1) {
              throw new Error('source-text-reindex-state-missing')
            }
            return indexed
          }),
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
                  operation: 'indexText.scope-or-content',
                  message: 'Source version scope or immutable indexed content did not match',
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
          sql.transaction(async (transaction) => {
            const readiness = await transaction.unsafe(
              `SELECT COUNT(DISTINCT sv.id)::int AS ready_count
               FROM source_versions sv
               JOIN sources s ON s.id = sv.source_id
               JOIN projects p ON p.id = s.project_id
               JOIN source_text_reindex_jobs reindex
                 ON reindex.source_version_id = sv.id
                AND reindex.status = 'completed'
               JOIN source_text_index sti ON sti.source_version_id = sv.id
               WHERE p.workspace_id = $1
                 AND p.id = $2
                 AND sv.id = ANY($3::uuid[])`,
              [decoded.workspaceId, decoded.projectId, decoded.sourceVersionIds],
            )
            if (Number(readiness[0]?.['ready_count']) !== decoded.sourceVersionIds.length) {
              throw new Error('source-text-index-not-ready')
            }
            return transaction.unsafe(
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
                    COALESCE(matched_lines.match_line, 1)::int AS match_line,
                    COALESCE(matched_lines.match_passages, '[]'::jsonb) AS match_passages
             FROM source_text_index sti
             JOIN source_versions sv ON sv.id = sti.source_version_id
             JOIN sources s ON s.id = sv.source_id
             JOIN projects p ON p.id = s.project_id
             CROSS JOIN search_query
             LEFT JOIN LATERAL (
               SELECT MIN(line_number)::int AS match_line,
                      jsonb_agg(
                        jsonb_build_object(
                          'line_number', line_number,
                          'highlighted_line',
                          ts_headline(
                            'english',
                            source_lines.line,
                            search_query.locator_query,
                            'StartSel=${MATCH_START}, StopSel=${MATCH_END}, HighlightAll=true'
                          )
                        )
                        ORDER BY line_number
                      ) AS match_passages
               FROM unnest(string_to_array(sti.content, E'\n'))
                 WITH ORDINALITY AS source_lines(line, line_number)
               WHERE to_tsvector('english', source_lines.line) @@ search_query.query
                  OR to_tsvector('english', source_lines.line) @@ search_query.locator_query
             ) matched_lines ON TRUE
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
            )
          }),
        catch: () =>
          new RetrievalQueryError({
            operation: 'searchText',
            message: 'Deterministic text search failed',
          }),
      })

      const evidence = yield* Effect.forEach(
        rows as unknown as readonly SearchRow[],
        (row) =>
          Effect.try({
            try: () => {
              const located = matchedExcerpt(
                row.content,
                decodeMatchPassages(row.match_passages),
                Number(row.match_line),
              )
              return {
                sourceVersionId: SourceVersionId.make(row.source_version_id),
                locator: located.locator,
                excerpt: located.excerpt,
                rank: Number(row.rank),
              }
            },
            catch: () =>
              new RetrievalQueryError({
                operation: 'searchText.evidence',
                message: 'Matched source text could not be represented as bounded evidence',
              }),
          }),
        { concurrency: 1 },
      )
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
