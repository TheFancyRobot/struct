/* eslint-disable no-unused-vars -- Babel's parser does not mark type-only imports as used. */
import { Effect, Schema } from 'effect'
import {
  CitationDetail,
  NotFoundError,
} from '@struct/domain'
import type * as typeDomain from '@struct/domain'
import type * as typePersistence from '@struct/persistence'

const MAX_LOCATIONS = 24
const CONTEXT_LINES = 2
const MAX_CONTEXT_CHARS = 4_000

interface LineRange {
  readonly start: number
  readonly end: number
  readonly startChar?: number
  readonly endChar?: number
}

function parseLocator(locator: string): ReadonlyArray<LineRange> | undefined {
  const parts = locator.split(';')
  if (parts.length === 0 || parts.length > MAX_LOCATIONS) return undefined
  const ranges: LineRange[] = []
  for (const part of parts) {
    const lines = /^lines:(\d+)-(\d+)$/.exec(part)
    if (lines !== null) {
      const start = Number(lines[1])
      const end = Number(lines[2])
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 1 || end < start) {
        return undefined
      }
      ranges.push({ start, end })
      continue
    }
    const chars = /^line:(\d+),chars:(\d+)-(\d+)$/.exec(part)
    if (chars === null) return undefined
    const line = Number(chars[1])
    const startChar = Number(chars[2])
    const endChar = Number(chars[3])
    if (
      !Number.isSafeInteger(line)
      || !Number.isSafeInteger(startChar)
      || !Number.isSafeInteger(endChar)
      || line < 1
      || startChar < 1
      || endChar < startChar
    ) {
      return undefined
    }
    ranges.push({ start: line, end: line, startChar, endChar })
  }
  return ranges
}

function sourceContext(
  content: string,
  ranges: ReadonlyArray<LineRange>,
): ReadonlyArray<{
  readonly lineNumber: number
  readonly segments: ReadonlyArray<{ readonly text: string; readonly cited: boolean }>
}> | undefined {
  const lines = content.split('\n')
  if (ranges.some((range) => range.end > lines.length)) return undefined
  const representedRanges = new Set<number>()
  const visibleLines = new Set<number>()
  for (const range of ranges) {
    for (
      let lineNumber = Math.max(1, range.start - CONTEXT_LINES);
      lineNumber <= Math.min(lines.length, range.end + CONTEXT_LINES);
      lineNumber += 1
    ) {
      visibleLines.add(lineNumber)
    }
  }
  let remaining = MAX_CONTEXT_CHARS
  const contextLines = [...visibleLines].sort((left, right) => left - right).flatMap((lineNumber) => {
    if (remaining <= 0) return []
    const text = lines[lineNumber - 1] ?? ''
    const highlights = ranges.flatMap((range, rangeIndex) => {
      if (lineNumber < range.start || lineNumber > range.end) return []
      const start = range.startChar === undefined ? 0 : range.startChar - 1
      const end = range.endChar === undefined ? text.length : range.endChar
      return start <= text.length && end <= text.length
        ? [{ start, end, rangeIndex }]
        : []
    }).sort((left, right) => left.start - right.start)
    if (ranges.some((range) => lineNumber >= range.start && lineNumber <= range.end) && highlights.length === 0) {
      return []
    }
    const firstHighlight = highlights[0]
    const lastHighlight = highlights[highlights.length - 1]
    const windowStart = text.length > remaining
      && firstHighlight !== undefined
      && lastHighlight !== undefined
      ? Math.max(0, Math.min(firstHighlight.start - 200, text.length - remaining))
      : 0
    const sourceWindow = text.slice(windowStart, windowStart + remaining)
    const prefix = windowStart > 0 ? '…' : ''
    const suffix = windowStart + sourceWindow.length < text.length ? '…' : ''
    const boundedText = `${prefix}${sourceWindow}${suffix}`
    const offset = prefix.length - windowStart
    remaining -= boundedText.length
    let cursor = 0
    const segments: Array<{ readonly text: string; readonly cited: boolean }> = []
    for (const highlight of highlights) {
      const start = Math.max(0, Math.min(highlight.start + offset, boundedText.length))
      const end = Math.max(0, Math.min(highlight.end + offset, boundedText.length))
      if (start > cursor) segments.push({ text: boundedText.slice(cursor, start), cited: false })
      if (end > start) {
        segments.push({ text: boundedText.slice(start, end), cited: true })
        representedRanges.add(highlight.rangeIndex)
      }
      cursor = Math.max(cursor, end)
    }
    if (cursor < boundedText.length) {
      segments.push({ text: boundedText.slice(cursor), cited: false })
    }
    if (segments.length === 0) segments.push({ text: boundedText, cited: false })
    return [{ lineNumber, segments }]
  })
  return representedRanges.size === ranges.length ? contextLines : undefined
}

export const getCitationDetail = (
  projectId: typeDomain.ProjectId,
  threadId: typeDomain.ResearchThreadId,
  citationId: typeDomain.CitationId,
  findCitation: (
    projectId: typeDomain.ProjectId,
    threadId: typeDomain.ResearchThreadId,
    citationId: typeDomain.CitationId,
  ) => Effect.Effect<
    typePersistence.CitationSourceProjection,
    typePersistence.PersistenceError,
    never
  >,
): Effect.Effect<
  CitationDetail,
  typePersistence.PersistenceError | NotFoundError,
  never
> =>
  Effect.gen(function* () {
    const citation = yield* findCitation(projectId, threadId, citationId)
    const ranges = parseLocator(citation.locator)
    const contextLines = ranges === undefined
      ? undefined
      : sourceContext(citation.content, ranges)
    const first = ranges?.[0]
    const last = ranges?.[ranges.length - 1]
    if (
      contextLines === undefined
      || contextLines.length === 0
      || !contextLines.some((line) => line.segments.some((segment) => segment.cited))
      || first === undefined
      || last === undefined
    ) {
      return yield* new NotFoundError({
        entityType: 'Citation',
        entityId: citationId,
        message: 'Citation source location is no longer available',
      })
    }
    return yield* Schema.decodeUnknown(CitationDetail)({
      id: citationId,
      runId: citation.runId,
      sourceVersionId: citation.sourceVersionId,
      sourceName: citation.sourceName,
      sourceVersion: citation.sourceVersion,
      locator: citation.locator,
      contextLines,
      startLine: first.start,
      endLine: last.end,
    }).pipe(
      Effect.mapError(() => new NotFoundError({
        entityType: 'Citation',
        entityId: citationId,
        message: 'Citation source data is no longer available',
      })),
    )
  })
