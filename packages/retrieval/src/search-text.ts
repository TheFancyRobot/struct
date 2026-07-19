import { Effect, Schema } from 'effect'
import {
  ProjectId,
  RetrievalQueryError,
  SourceVersionId,
  TextEvidence,
  WorkspaceId,
} from '@struct/domain'
import {
  SourceTextReindexOwnershipLostError,
  SqlClient,
} from '@struct/persistence'

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
  readonly query_is_positional?: boolean
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
  readonly text: string
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
    const lineMatches: Array<{ start: number; end: number }> = []
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
        })
      }
      cursor = markedEnd + MATCH_END.length
    }

    // PostgreSQL's HighlightAll output should be the source line plus markers. Ignore
    // malformed marker output here; the caller fails closed instead of emitting offsets
    // that do not address the immutable source text.
    if (plain !== sourceLine) continue
    matches.push(...lineMatches.map((match) => ({
      lineIndex,
      ...match,
      text: sourceLine.slice(match.start, match.end),
    })))
  }

  const seen = new Set<string>()
  return matches
    .sort((left, right) =>
      left.lineIndex - right.lineIndex
      || left.start - right.start
      || left.end - right.end)
    .filter((match) => {
      // A phrase/proximity query can highlight the same lexeme at several
      // positions while only a later combination actually satisfies the
      // PostgreSQL query. Deduplicate only identical source positions: removing
      // later occurrences by lexeme text can remove the supported match itself.
      const position = `${match.lineIndex}:${match.start}:${match.end}`
      if (seen.has(position)) return false
      seen.add(position)
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

interface LocatedExcerpt {
  readonly excerpt: string
  readonly locator: string
  readonly discontiguous: boolean
}

function compactCandidate(
  lines: ReadonlyArray<string>,
  matches: ReadonlyArray<MatchRange>,
): LocatedExcerpt | undefined {
  const exactRanges = mergeRanges(matches.map(({ lineIndex, start, end }) => ({
    lineIndex,
    start,
    end,
  })))
  const separatorChars = OMITTED_SOURCE.length * Math.max(0, exactRanges.length - 1)
  const matchedChars = exactRanges.reduce((total, match) => total + match.end - match.start, 0)
  const contextBudget = MAX_EXCERPT_CHARS - separatorChars - matchedChars
  if (contextBudget < 0) return undefined
  const contextPerSide = Math.min(
    MAX_CONTEXT_CHARS_PER_SIDE,
    Math.floor(contextBudget / Math.max(1, exactRanges.length * 2)),
  )
  const sourceRanges = mergeRanges(exactRanges.map((match) => {
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
  if (excerpt.length > MAX_EXCERPT_CHARS) return undefined
  const locator = sourceRanges.map((range) => {
    const line = lines[range.lineIndex]!
    return range.start === 0 && range.end === line.length
      ? `lines:${range.lineIndex + 1}-${range.lineIndex + 1}`
      : `line:${range.lineIndex + 1},chars:${range.start + 1}-${range.end}`
  }).join(';')
  return { excerpt, locator, discontiguous: true }
}

function lineOffsets(lines: ReadonlyArray<string>): ReadonlyArray<number> {
  const offsets: number[] = []
  let offset = 0
  for (const line of lines) {
    offsets.push(offset)
    offset += line.length + 1
  }
  return offsets
}

function contiguousLocator(
  lines: ReadonlyArray<string>,
  offsets: ReadonlyArray<number>,
  start: number,
  end: number,
): string {
  const ranges: SourceRange[] = []
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex]!
    const lineStart = offsets[lineIndex]!
    const lineEnd = lineStart + line.length
    if (end < lineStart || start > lineEnd) continue
    const rangeStart = Math.max(0, start - lineStart)
    const rangeEnd = Math.min(line.length, end - lineStart)
    if (
      rangeStart < rangeEnd
      || (line.length === 0 && start <= lineStart && end >= lineStart)
    ) {
      ranges.push({ lineIndex, start: rangeStart, end: rangeEnd })
    }
  }
  if (ranges.length === 0) {
    throw new Error('Contiguous evidence window did not address source lines')
  }
  if (ranges.every((range) =>
    range.start === 0 && range.end === lines[range.lineIndex]!.length)) {
    return `lines:${ranges[0]!.lineIndex + 1}-${ranges.at(-1)!.lineIndex + 1}`
  }
  return ranges.map((range) => {
    const line = lines[range.lineIndex]!
    return range.start === 0 && range.end === line.length
      ? `lines:${range.lineIndex + 1}-${range.lineIndex + 1}`
      : `line:${range.lineIndex + 1},chars:${range.start + 1}-${range.end}`
  }).join(';')
}

function boundedSourceWindow(
  content: string,
  lines: ReadonlyArray<string>,
  offsets: ReadonlyArray<number>,
  match: MatchRange,
  maxLength: number,
): LocatedExcerpt {
  const matchStart = offsets[match.lineIndex]! + match.start
  const matchEnd = offsets[match.lineIndex]! + match.end
  const length = Math.min(maxLength, content.length)
  let start = Math.max(0, matchStart - Math.floor((length - (matchEnd - matchStart)) / 2))
  let end = Math.min(content.length, start + length)
  start = Math.max(0, end - length)
  while (start < end && content[start] === '\n') start += 1
  while (end > start && content[end - 1] === '\n') end -= 1
  return {
    excerpt: content.slice(start, end),
    locator: contiguousLocator(lines, offsets, start, end),
    discontiguous: false,
  }
}

function boundedLineWindow(line: string, lineIndex: number, match: MatchRange): LocatedExcerpt {
  const length = Math.min(MAX_EXCERPT_CHARS, line.length)
  let start = Math.max(0, match.start - Math.floor((length - (match.end - match.start)) / 2))
  const end = Math.min(line.length, start + length)
  start = Math.max(0, end - length)
  return {
    excerpt: line.slice(start, end),
    locator: start === 0 && end === line.length
      ? `lines:${lineIndex + 1}-${lineIndex + 1}`
      : `line:${lineIndex + 1},chars:${start + 1}-${end}`,
    discontiguous: false,
  }
}

function matchedExcerptCandidates(
  content: string,
  passages: ReadonlyArray<MatchPassage>,
  fallbackMatchLine: number,
  queryIsPositional: boolean,
): ReadonlyArray<LocatedExcerpt> {
  const lines = content.split('\n')
  const offsets = lineOffsets(lines)
  const matches = matchRanges(content, passages)
  if (matches.length === 0) {
    if (passages.length > 0) {
      throw new Error('PostgreSQL match positions did not address the source text')
    }
    return [{ ...fallbackExcerpt(content, fallbackMatchLine), discontiguous: false }]
  }

  const candidates: LocatedExcerpt[] = []
  const seen = new Set<string>()
  const add = (candidate: LocatedExcerpt | undefined): void => {
    if (candidate === undefined || candidate.excerpt.length > MAX_EXCERPT_CHARS) return
    const key = `${candidate.locator}\u0000${candidate.excerpt}`
    if (!seen.has(key)) {
      seen.add(key)
      candidates.push(candidate)
    }
  }

  const firstLine = matches[0]!.lineIndex
  const lastLine = matches.at(-1)!.lineIndex
  if (lastLine - firstLine < 6) {
    const excerptLines = lines.slice(firstLine, firstLine + 6)
    const excerpt = excerptLines.join('\n')
    if (excerpt.length <= MAX_EXCERPT_CHARS) {
      add({
        excerpt,
        locator: `lines:${firstLine + 1}-${firstLine + Math.max(1, excerptLines.length)}`,
        discontiguous: false,
      })
    }
  }

  for (const match of matches) {
    add(boundedLineWindow(lines[match.lineIndex]!, match.lineIndex, match))
  }

  if (!queryIsPositional) {
    // Distributed non-positional terms may use accurate multi-range evidence.
    // Never offer synthetic omission-separated text for phrase/proximity
    // support: removing source distance can manufacture a match.
    const latestByLexeme = new Map<string, MatchRange>()
    for (const match of matches) {
      latestByLexeme.set(match.text, match)
      add(compactCandidate(
        lines,
        [...latestByLexeme.values()].sort((left, right) =>
          left.lineIndex - right.lineIndex
          || left.start - right.start
          || left.end - right.end),
      ))
    }
  }

  // Prefer local contiguous windows so a later supported phrase is cited at
  // its actual coordinates instead of inside a document-wide passage.
  for (const match of matches) {
    add(boundedSourceWindow(
      content,
      lines,
      offsets,
      match,
      Math.min(
        MAX_EXCERPT_CHARS,
        match.end - match.start + MAX_CONTEXT_CHARS_PER_SIDE * 2,
      ),
    ))
  }
  // A wider contiguous fallback retains unusual but still bounded positional
  // matches without ever collapsing source distance.
  for (const match of matches) {
    add(boundedSourceWindow(content, lines, offsets, match, MAX_EXCERPT_CHARS))
  }

  if (candidates.length === 0) {
    throw new Error('Matched terms cannot be represented inside the bounded evidence excerpt')
  }
  return candidates
}

export class TextRetrieval extends Effect.Service<TextRetrieval>()('TextRetrieval', {
  accessors: true,
  effect: Effect.gen(function* () {
    const sql = yield* SqlClient

    const indexText = Effect.fn('TextRetrieval.indexText')(function* (input: IndexTextInput) {
      const result = yield* Effect.tryPromise({
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
            if (indexed.length !== 1) {
              return { indexed, completionOwned: false }
            }
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
            return {
              indexed,
              completionOwned: completed.length === 1,
            }
          }),
        catch: () =>
          new RetrievalQueryError({
            operation: 'indexText',
            message: 'Normalized source text could not be indexed',
          }),
      })
      if (result.indexed.length !== 1) {
        return yield* new RetrievalQueryError({
          operation: 'indexText.scope-or-content',
          message: 'Source version scope or immutable indexed content did not match',
        })
      }
      if (!result.completionOwned) {
        if (input.reindexAttempt !== undefined) {
          return yield* new SourceTextReindexOwnershipLostError({
            sourceVersionId: input.sourceVersionId,
            attempt: input.reindexAttempt,
            transition: 'index-text',
            message: 'Source text reindex attempt no longer owns the in-progress lease',
          })
        }
        return yield* new RetrievalQueryError({
          operation: 'indexText.reindex-state',
          message: 'Source text reindex state was missing from the requested tenant scope',
        })
      }
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
              `WITH raw_search_query AS (
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
             ),
             search_query AS (
               SELECT raw_search_query.*,
                      raw_search_query.query::text ~ '(<->|<[0-9]+>)'
                        AS query_is_positional
               FROM raw_search_query
             )
             SELECT sti.source_version_id, sti.content,
                    ts_rank_cd(sti.search_vector, search_query.query) AS rank,
                    COALESCE(matched_lines.match_line, 1)::int AS match_line,
                    COALESCE(matched_lines.match_passages, '[]'::jsonb) AS match_passages,
                    search_query.query_is_positional
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
               FROM (
                 SELECT candidate_lines.*,
                        bool_or(candidate_lines.matches_query) OVER () AS has_query_match
                 FROM (
                   SELECT line,
                          line_number,
                          to_tsvector('english', line) @@ search_query.query
                            AS matches_query,
                          to_tsvector('english', line) @@ search_query.locator_query
                            AS matches_locator
                   FROM unnest(string_to_array(sti.content, E'\n'))
                     WITH ORDINALITY AS lines(line, line_number)
                 ) candidate_lines
                 WHERE candidate_lines.matches_query
                    OR candidate_lines.matches_locator
               ) source_lines
               WHERE source_lines.matches_query
                  OR NOT source_lines.has_query_match
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
          Effect.gen(function* () {
            const candidates = yield* Effect.try({
              try: () => matchedExcerptCandidates(
                row.content,
                decodeMatchPassages(row.match_passages),
                Number(row.match_line),
                row.query_is_positional === true,
              ),
              catch: () =>
                new RetrievalQueryError({
                  operation: 'searchText.evidence',
                  message: 'Matched source text could not be represented as bounded evidence',
                }),
            })
            const eligibleCandidates = row.query_is_positional === true
              ? candidates.filter((candidate) => !candidate.discontiguous)
              : candidates
            const supported = yield* Effect.tryPromise({
              try: () =>
                sql.unsafe(
                  `SELECT candidate_number::int
                   FROM unnest($1::text[]) WITH ORDINALITY
                     AS candidates(excerpt, candidate_number)
                   WHERE to_tsvector('english', excerpt)
                     @@ websearch_to_tsquery('english', $2)
                   ORDER BY candidate_number ASC
                   LIMIT 1`,
                  [
                    eligibleCandidates.map((candidate) => candidate.excerpt),
                    decoded.query,
                  ],
                ),
              catch: () =>
                new RetrievalQueryError({
                  operation: 'searchText.evidence-support',
                  message: 'Bounded evidence support could not be verified',
                }),
            })
            const candidateNumber = Number(supported[0]?.['candidate_number'])
            const located = Number.isInteger(candidateNumber) && candidateNumber > 0
              ? eligibleCandidates[candidateNumber - 1]
              : undefined
            if (located === undefined) {
              return yield* new RetrievalQueryError({
                operation: 'searchText.evidence-support',
                message: 'No bounded excerpt preserved the PostgreSQL-supported match',
              })
            }
            return {
              sourceVersionId: SourceVersionId.make(row.source_version_id),
              locator: located.locator,
              excerpt: located.excerpt,
              rank: Number(row.rank),
            }
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
