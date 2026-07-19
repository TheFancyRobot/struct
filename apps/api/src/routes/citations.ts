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

interface DocumentRange {
  readonly charStart: number
  readonly charEnd: number
  readonly byteStart: number
  readonly byteEnd: number
}

type ParsedLocator =
  | { readonly kind: 'lines'; readonly ranges: ReadonlyArray<LineRange> }
  | { readonly kind: 'document'; readonly range: DocumentRange }

function parsePositiveInteger(value: string | undefined): number | undefined {
  if (value === undefined || !/^[1-9]\d*$/.test(value)) return undefined
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) ? parsed : undefined
}

function parseNonNegativeRange(
  value: string | undefined,
): readonly [number, number] | undefined {
  const match = /^(\d+)-(\d+)$/.exec(value ?? '')
  if (match === null) return undefined
  const start = Number(match[1])
  const end = Number(match[2])
  return Number.isSafeInteger(start)
    && Number.isSafeInteger(end)
    && start >= 0
    && end > start
    ? [start, end]
    : undefined
}

function parseDocumentLocator(locator: string): DocumentRange | undefined {
  if (!locator.startsWith('document:')) return undefined
  const fields = new Map<string, string>()
  for (const field of locator.slice('document:'.length).split(',')) {
    const separator = field.indexOf(':')
    if (separator <= 0) return undefined
    const key = field.slice(0, separator)
    const value = field.slice(separator + 1)
    if (
      fields.has(key)
      || !['section', 'page', 'paragraph', 'chars', 'bytes'].includes(key)
      || value.length === 0
    ) {
      return undefined
    }
    fields.set(key, value)
  }
  if (
    (fields.has('page') && parsePositiveInteger(fields.get('page')) === undefined)
    || (
      fields.has('paragraph')
      && parsePositiveInteger(fields.get('paragraph')) === undefined
    )
  ) {
    return undefined
  }
  if (fields.has('section')) {
    try {
      if (decodeURIComponent(fields.get('section') ?? '').length === 0) return undefined
    } catch {
      return undefined
    }
  }
  const chars = parseNonNegativeRange(fields.get('chars'))
  const bytes = parseNonNegativeRange(fields.get('bytes'))
  if (chars === undefined || bytes === undefined) return undefined
  return {
    charStart: chars[0],
    charEnd: chars[1],
    byteStart: bytes[0],
    byteEnd: bytes[1],
  }
}

function parseLocator(locator: string): ParsedLocator | undefined {
  const documentRange = parseDocumentLocator(locator)
  if (documentRange !== undefined) {
    return { kind: 'document', range: documentRange }
  }
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
  return { kind: 'lines', ranges }
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

function documentSourceContext(
  content: string,
  range: DocumentRange,
): {
  readonly contextLines: ReadonlyArray<{
    readonly lineNumber: number
    readonly segments: ReadonlyArray<{ readonly text: string; readonly cited: boolean }>
  }>
  readonly startLine: number
  readonly endLine: number
} | undefined {
  if (range.charEnd > content.length) return undefined
  const encoder = new TextEncoder()
  if (
    encoder.encode(content.slice(0, range.charStart)).byteLength !== range.byteStart
    || encoder.encode(content.slice(0, range.charEnd)).byteLength !== range.byteEnd
  ) {
    return undefined
  }
  const lines = content.split('\n')
  const lineStarts: number[] = []
  let offset = 0
  for (const line of lines) {
    lineStarts.push(offset)
    offset += line.length + 1
  }
  const citedLineIndexes = lineStarts.flatMap((lineStart, index) => {
    const lineEnd = lineStart + (lines[index]?.length ?? 0)
    return range.charStart <= lineEnd && range.charEnd >= lineStart
      && Math.max(range.charStart, lineStart) < Math.min(range.charEnd, lineEnd)
      ? [index]
      : []
  })
  const firstCited = citedLineIndexes[0]
  const lastCited = citedLineIndexes[citedLineIndexes.length - 1]
  if (firstCited === undefined || lastCited === undefined) return undefined
  const visibleStart = Math.max(0, firstCited - CONTEXT_LINES)
  const visibleEnd = Math.min(lines.length - 1, lastCited + CONTEXT_LINES)
  let remaining = MAX_CONTEXT_CHARS
  let representedThrough = range.charStart
  const contextLines = lines.slice(visibleStart, visibleEnd + 1).flatMap((text, relativeIndex) => {
    if (remaining <= 0) return []
    const index = visibleStart + relativeIndex
    const lineStart = lineStarts[index] ?? 0
    const highlightStart = Math.max(0, range.charStart - lineStart)
    const highlightEnd = Math.min(text.length, range.charEnd - lineStart)
    const hasHighlight = highlightEnd > highlightStart
    const windowStart = text.length > remaining && hasHighlight
      ? Math.max(0, Math.min(highlightStart - 200, text.length - remaining))
      : 0
    const sourceWindow = text.slice(windowStart, windowStart + remaining)
    const prefix = windowStart > 0 ? '…' : ''
    const suffix = windowStart + sourceWindow.length < text.length ? '…' : ''
    const boundedText = `${prefix}${sourceWindow}${suffix}`
    const shiftedStart = Math.max(0, highlightStart - windowStart + prefix.length)
    const shiftedEnd = Math.min(
      boundedText.length - suffix.length,
      highlightEnd - windowStart + prefix.length,
    )
    const representedHighlightStart = lineStart
      + windowStart
      + Math.max(0, shiftedStart - prefix.length)
    const representedHighlightEnd = lineStart
      + windowStart
      + Math.max(0, shiftedEnd - prefix.length)
    remaining -= boundedText.length
    const segments: Array<{ readonly text: string; readonly cited: boolean }> = []
    if (hasHighlight && shiftedEnd > shiftedStart) {
      if (shiftedStart > 0) {
        segments.push({ text: boundedText.slice(0, shiftedStart), cited: false })
      }
      segments.push({
        text: boundedText.slice(shiftedStart, shiftedEnd),
        cited: true,
      })
      if (representedHighlightStart <= representedThrough) {
        representedThrough = Math.max(
          representedThrough,
          representedHighlightEnd,
        )
      }
      if (shiftedEnd < boundedText.length) {
        segments.push({ text: boundedText.slice(shiftedEnd), cited: false })
      }
    } else {
      segments.push({ text: boundedText, cited: false })
    }
    if (
      representedThrough === lineStart + text.length
      && representedThrough < range.charEnd
      && content[representedThrough] === '\n'
    ) {
      representedThrough += 1
    }
    return [{ lineNumber: index + 1, segments }]
  })
  return representedThrough >= range.charEnd
    ? {
        contextLines,
        startLine: firstCited + 1,
        endLine: lastCited + 1,
      }
    : undefined
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
    const locator = parseLocator(citation.locator)
    const resolved = locator?.kind === 'document'
      ? documentSourceContext(citation.content, locator.range)
      : locator?.kind === 'lines'
        ? (() => {
            const contextLines = sourceContext(citation.content, locator.ranges)
            const first = locator.ranges[0]
            const last = locator.ranges[locator.ranges.length - 1]
            return contextLines !== undefined && first !== undefined && last !== undefined
              ? { contextLines, startLine: first.start, endLine: last.end }
              : undefined
          })()
        : undefined
    if (
      resolved === undefined
      || resolved.contextLines.length === 0
      || !resolved.contextLines.some(
        (line) => line.segments.some((segment) => segment.cited),
      )
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
      contextLines: resolved.contextLines,
      startLine: resolved.startLine,
      endLine: resolved.endLine,
    }).pipe(
      Effect.mapError(() => new NotFoundError({
        entityType: 'Citation',
        entityId: citationId,
        message: 'Citation source data is no longer available',
      })),
    )
  })
