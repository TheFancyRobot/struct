import { describe, expect, it } from 'bun:test'
import { Effect, Exit } from 'effect'
import {
  CitationId,
  ProjectId,
  ResearchThreadId,
} from '@struct/domain'
import { getCitationDetail } from './citations'

const projectId = ProjectId.make('c50e8400-e29b-41d4-a716-446655440001')
const threadId = ResearchThreadId.make('c50e8400-e29b-41d4-a716-446655440002')
const citationId = CitationId.make('c50e8400-e29b-41d4-a716-446655440003')

describe('getCitationDetail', () => {
  it('renders bounded stored-source context with the cited lines marked', async () => {
    const detail = await Effect.runPromise(getCitationDetail(
      projectId,
      threadId,
      citationId,
      () => Effect.succeed({
        id: citationId,
        runId: 'c50e8400-e29b-41d4-a716-446655440004',
        sourceVersionId: 'c50e8400-e29b-41d4-a716-446655440005',
        sourceName: 'launch.txt',
        sourceVersion: 1,
        locator: 'lines:2-2',
        content: 'Before\nLaunch is July 18.\nAfter',
      }),
    ))

    expect(detail.contextLines).toContainEqual({
      lineNumber: 2,
      segments: [{ text: 'Launch is July 18.', cited: true }],
    })
    expect(detail.sourceName).toBe('launch.txt')
  })

  it('preserves an exact character locator on a long source line', async () => {
    const detail = await Effect.runPromise(getCitationDetail(
      projectId,
      threadId,
      citationId,
      () => Effect.succeed({
        id: citationId,
        runId: 'c50e8400-e29b-41d4-a716-446655440004',
        sourceVersionId: 'c50e8400-e29b-41d4-a716-446655440005',
        sourceName: 'launch.txt',
        sourceVersion: 1,
        locator: 'line:1,chars:8-13',
        content: 'Before launch after',
      }),
    ))

    expect(detail.contextLines[0]?.segments).toEqual([
      { text: 'Before ', cited: false },
      { text: 'launch', cited: true },
      { text: ' after', cited: false },
    ])
  })

  it('resolves a document locator against immutable normalized text', async () => {
    const content = 'Before\nLaunch is July 18.\nAfter'
    const cited = 'Launch is July 18.'
    const charStart = content.indexOf(cited)
    const charEnd = charStart + cited.length
    const encoder = new TextEncoder()
    const detail = await Effect.runPromise(getCitationDetail(
      projectId,
      threadId,
      citationId,
      () => Effect.succeed({
        id: citationId,
        runId: 'c50e8400-e29b-41d4-a716-446655440004',
        sourceVersionId: 'c50e8400-e29b-41d4-a716-446655440005',
        sourceName: 'launch.md',
        sourceVersion: 2,
        locator: [
          'document:section:Launch%20date',
          'paragraph:1',
          `chars:${charStart}-${charEnd}`,
          `bytes:${encoder.encode(content.slice(0, charStart)).byteLength}-${encoder.encode(content.slice(0, charEnd)).byteLength}`,
        ].join(','),
        content,
      }),
    ))

    expect(detail.contextLines).toContainEqual({
      lineNumber: 2,
      segments: [{ text: cited, cited: true }],
    })
    expect(detail.startLine).toBe(2)
    expect(detail.endLine).toBe(2)
    expect(detail.sourceVersion).toBe(2)
  })

  it('fails closed when document byte offsets do not match normalized text', async () => {
    const exit = await Effect.runPromiseExit(getCitationDetail(
      projectId,
      threadId,
      citationId,
      () => Effect.succeed({
        id: citationId,
        runId: 'c50e8400-e29b-41d4-a716-446655440004',
        sourceVersionId: 'c50e8400-e29b-41d4-a716-446655440005',
        sourceName: 'launch.md',
        sourceVersion: 1,
        locator: 'document:paragraph:1,chars:0-6,bytes:0-5',
        content: 'café launch',
      }),
    ))

    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) expect(exit.cause.toString()).toContain('NotFoundError')
  })

  it('fails closed when the preview budget cannot represent the full document range', async () => {
    const content = `Before\n${'evidence '.repeat(600)}\nAfter`
    const charStart = content.indexOf('evidence')
    const charEnd = content.lastIndexOf('evidence') + 'evidence'.length
    const encoder = new TextEncoder()
    const exit = await Effect.runPromiseExit(getCitationDetail(
      projectId,
      threadId,
      citationId,
      () => Effect.succeed({
        id: citationId,
        runId: 'c50e8400-e29b-41d4-a716-446655440004',
        sourceVersionId: 'c50e8400-e29b-41d4-a716-446655440005',
        sourceName: 'large.md',
        sourceVersion: 1,
        locator: [
          'document:paragraph:1',
          `chars:${charStart}-${charEnd}`,
          `bytes:${encoder.encode(content.slice(0, charStart)).byteLength}-${encoder.encode(content.slice(0, charEnd)).byteLength}`,
        ].join(','),
        content,
      }),
    ))

    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) expect(exit.cause.toString()).toContain('NotFoundError')
  })

  it('represents a complete document range spanning normalized lines', async () => {
    const content = 'Before\nFirst cited line.\nSecond cited line.\nAfter'
    const cited = 'First cited line.\nSecond cited line.'
    const charStart = content.indexOf(cited)
    const charEnd = charStart + cited.length
    const encoder = new TextEncoder()
    const detail = await Effect.runPromise(getCitationDetail(
      projectId,
      threadId,
      citationId,
      () => Effect.succeed({
        id: citationId,
        runId: 'c50e8400-e29b-41d4-a716-446655440004',
        sourceVersionId: 'c50e8400-e29b-41d4-a716-446655440005',
        sourceName: 'multi-line.md',
        sourceVersion: 1,
        locator: [
          'document:section:Evidence',
          `chars:${charStart}-${charEnd}`,
          `bytes:${encoder.encode(content.slice(0, charStart)).byteLength}-${encoder.encode(content.slice(0, charEnd)).byteLength}`,
        ].join(','),
        content,
      }),
    ))

    expect(detail.contextLines.filter((line) =>
      line.segments.some((segment) => segment.cited)
    )).toHaveLength(2)
    expect(detail.startLine).toBe(2)
    expect(detail.endLine).toBe(3)
  })

  it('represents a document chunk spanning normalized paragraph separators', async () => {
    const content = 'Before\nFirst cited paragraph.\n\nSecond cited paragraph.\nAfter'
    const cited = 'First cited paragraph.\n\nSecond cited paragraph.'
    const charStart = content.indexOf(cited)
    const charEnd = charStart + cited.length
    const encoder = new TextEncoder()
    const detail = await Effect.runPromise(getCitationDetail(
      projectId,
      threadId,
      citationId,
      () => Effect.succeed({
        id: citationId,
        runId: 'c50e8400-e29b-41d4-a716-446655440004',
        sourceVersionId: 'c50e8400-e29b-41d4-a716-446655440005',
        sourceName: 'multi-paragraph.md',
        sourceVersion: 1,
        locator: `document:chars:${charStart}-${charEnd},bytes:${encoder.encode(content.slice(0, charStart)).byteLength}-${encoder.encode(content.slice(0, charEnd)).byteLength}`,
        content,
      }),
    ))

    expect(detail.contextLines.filter((line) =>
      line.segments.some((segment) => segment.cited)
    )).toHaveLength(2)
    expect(detail.startLine).toBe(2)
    expect(detail.endLine).toBe(4)
  })

  it('returns a typed not-found failure for a stale locator', async () => {
    const exit = await Effect.runPromiseExit(getCitationDetail(
      projectId,
      threadId,
      citationId,
      () => Effect.succeed({
        id: citationId,
        runId: 'c50e8400-e29b-41d4-a716-446655440004',
        sourceVersionId: 'c50e8400-e29b-41d4-a716-446655440005',
        sourceName: 'launch.txt',
        sourceVersion: 1,
        locator: 'lines:9-9',
        content: 'Only one line',
      }),
    ))

    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) expect(exit.cause.toString()).toContain('NotFoundError')
  })

  it('fails closed when the context budget cannot represent every distant cited range', async () => {
    const exit = await Effect.runPromiseExit(getCitationDetail(
      projectId,
      threadId,
      citationId,
      () => Effect.succeed({
        id: citationId,
        runId: 'c50e8400-e29b-41d4-a716-446655440004',
        sourceVersionId: 'c50e8400-e29b-41d4-a716-446655440005',
        sourceName: 'launch.txt',
        sourceVersion: 1,
        locator: 'lines:2-2;lines:6-6',
        content: [
          'Before',
          'First cited fact.',
          'x'.repeat(4_000),
          'Middle',
          'Almost there',
          'Second cited fact.',
        ].join('\n'),
      }),
    ))

    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) expect(exit.cause.toString()).toContain('NotFoundError')
  })
})
