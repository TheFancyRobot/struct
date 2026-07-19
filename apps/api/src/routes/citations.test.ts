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
