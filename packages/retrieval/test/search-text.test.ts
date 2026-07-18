import { describe, expect, it } from 'vitest'
import { Effect, Layer } from 'effect'
import {
  ProjectId,
  SourceVersionId,
  WorkspaceId,
} from '@struct/domain'
import { SqlClientTest } from '@struct/persistence'
import { TextRetrieval } from '../src/search-text'

const workspaceId = WorkspaceId.make('a50e8400-e29b-41d4-a716-446655440000')
const projectId = ProjectId.make('a50e8400-e29b-41d4-a716-446655440001')
const sourceVersionId = SourceVersionId.make('a50e8400-e29b-41d4-a716-446655440002')

describe('TextRetrieval', () => {
  it('uses bounded PostgreSQL FTS scoped to workspace, project, and immutable versions', async () => {
    const calls: Array<{ query: string; params?: readonly unknown[] }> = []
    const sqlLayer = SqlClientTest(async (query, params) => {
      calls.push({ query, params })
      if (query.includes('AS ready_count')) return [{ ready_count: 1 }]
      return [{
        source_version_id: sourceVersionId,
        content: 'Alpha\nThe launch date is July 18.\nOmega',
        rank: 0.75,
        match_line: 2,
        match_passages: [{
          line_number: 2,
          highlighted_line: `The \uE000launch\uE001 \uE000date\uE001 is July 18.`,
        }],
      }]
    })
    const layer = Layer.provide(TextRetrieval.Default, sqlLayer)

    const result = await Effect.runPromise(
      TextRetrieval.searchText({
        workspaceId,
        projectId,
        sourceVersionIds: [sourceVersionId],
        query: 'launch date',
        limit: 3,
      }).pipe(Effect.provide(layer)),
    )

    expect(calls[0]?.query).toMatch(/source_text_reindex_jobs/)
    expect(calls[0]?.query).toMatch(/status = 'completed'/)
    expect(calls[1]?.query).toMatch(/websearch_to_tsquery/)
    expect(calls[1]?.query).toMatch(/JOIN projects/)
    expect(calls[1]?.query).toMatch(/source_version_id = ANY/)
    expect(calls[1]?.query).toMatch(/WITH ORDINALITY/)
    expect(calls[1]?.query).toMatch(/LEFT JOIN LATERAL/)
    expect(calls[1]?.query).toMatch(/locator_query/)
    expect(calls[1]?.query).toMatch(/ts_headline/)
    expect(calls[0]?.params?.slice(0, 3)).toEqual([
      workspaceId,
      projectId,
      [sourceVersionId],
    ])
    expect(result.evidence).toEqual([{
      sourceVersionId,
      locator: 'lines:2-3',
      excerpt: 'The launch date is July 18.\nOmega',
      rank: 0.75,
    }])
  })

  it('indexes normalized text idempotently without changing source-version identity', async () => {
    const calls: string[] = []
    const sqlLayer = SqlClientTest(async (query) => {
      calls.push(query)
      return [{ source_version_id: sourceVersionId }]
    })
    const layer = Layer.provide(TextRetrieval.Default, sqlLayer)

    await Effect.runPromise(
      TextRetrieval.indexText({
        workspaceId,
        projectId,
        sourceVersionId,
        content: 'normalized text',
      }).pipe(Effect.provide(layer)),
    )

    expect(calls.join('\n')).toMatch(/JOIN projects/)
    expect(calls.join('\n')).toMatch(/DO UPDATE SET content = source_text_index\.content/)
    expect(calls.join('\n')).toMatch(/source_text_index\.content = EXCLUDED\.content/)
    expect(calls.join('\n')).toMatch(/UPDATE source_text_reindex_jobs/)
    expect(calls.join('\n')).toMatch(/THEN 'completed'/)
    expect(calls.join('\n')).toMatch(/status IN \('pending', 'failed', 'in-progress', 'completed'\)/)
  })

  it('completes reindexing only for the worker claim attempt that produced the text', async () => {
    const calls: Array<{ query: string; params?: readonly unknown[] }> = []
    const sqlLayer = SqlClientTest(async (query, params) => {
      calls.push({ query, params })
      return [{ source_version_id: sourceVersionId }]
    })
    const layer = Layer.provide(TextRetrieval.Default, sqlLayer)

    await Effect.runPromise(
      TextRetrieval.indexText({
        workspaceId,
        projectId,
        sourceVersionId,
        content: 'normalized text',
        reindexAttempt: 2,
      }).pipe(Effect.provide(layer)),
    )

    const completion = calls.find(({ query }) =>
      query.includes('UPDATE source_text_reindex_jobs'))
    expect(completion?.query).toMatch(/status = 'in-progress'/)
    expect(completion?.query).toMatch(/attempts = \$4/)
    expect(completion?.params).toEqual([
      sourceVersionId,
      workspaceId,
      projectId,
      2,
    ])
  })

  it('fails closed before changing reindex state when indexed immutable content conflicts', async () => {
    const calls: Array<{ query: string; params?: readonly unknown[] }> = []
    const sqlLayer = SqlClientTest(async (query, params) => {
      calls.push({ query, params })
      return []
    })
    const layer = Layer.provide(TextRetrieval.Default, sqlLayer)

    const exit = await Effect.runPromiseExit(
      TextRetrieval.indexText({
        workspaceId,
        projectId,
        sourceVersionId,
        content: 'conflicting text',
      }).pipe(Effect.provide(layer)),
    )

    expect(exit._tag).toBe('Failure')
    expect(calls).toHaveLength(1)
    expect(calls[0]?.query).toMatch(/source_text_index\.content = EXCLUDED\.content/)
    expect(calls[0]?.query).not.toMatch(/UPDATE source_text_reindex_jobs/)
  })

  it('fails explicitly while a requested source version is not durably indexed', async () => {
    const calls: string[] = []
    const sqlLayer = SqlClientTest(async (query) => {
      calls.push(query)
      return [{ ready_count: 0 }]
    })
    const layer = Layer.provide(TextRetrieval.Default, sqlLayer)

    const exit = await Effect.runPromiseExit(
      TextRetrieval.searchText({
        workspaceId,
        projectId,
        sourceVersionIds: [sourceVersionId],
        query: 'launch',
        limit: 1,
      }).pipe(Effect.provide(layer)),
    )

    expect(exit._tag).toBe('Failure')
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatch(/source_text_reindex_jobs/)
  })

  it('anchors a stem-only match after the first six lines to the PostgreSQL match line', async () => {
    const sqlLayer = SqlClientTest(async (query) => query.includes('AS ready_count')
      ? [{ ready_count: 1 }]
      : [{
      source_version_id: sourceVersionId,
      content: [
        'Unrelated one',
        'Unrelated two',
        'Unrelated three',
        'Unrelated four',
        'Unrelated five',
        'Unrelated six',
        'The service runs nightly.',
        'Relevant continuation.',
      ].join('\n'),
      rank: 0.5,
      match_line: 7,
      match_passages: [{
        line_number: 7,
        highlighted_line: `The service \uE000runs\uE001 nightly.`,
      }],
      }])
    const layer = Layer.provide(TextRetrieval.Default, sqlLayer)

    const result = await Effect.runPromise(
      TextRetrieval.searchText({
        workspaceId,
        projectId,
        sourceVersionIds: [sourceVersionId],
        query: 'running',
        limit: 1,
      }).pipe(Effect.provide(layer)),
    )

    expect(result.evidence[0]).toMatchObject({
      locator: 'lines:7-8',
      excerpt: 'The service runs nightly.\nRelevant continuation.',
    })
  })

  it('assembles distant required terms into one bounded, accurately located evidence row', async () => {
    const content = [
      'Prologue',
      'alpha',
      'filler one',
      'filler two',
      'filler three',
      'filler four',
      'filler five',
      'filler six',
      'filler seven',
      'omega',
      'Epilogue',
    ].join('\n')
    const sqlLayer = SqlClientTest(async (query) => query.includes('AS ready_count')
      ? [{ ready_count: 1 }]
      : [{
      source_version_id: sourceVersionId,
      content,
      rank: 0.4,
      match_line: 2,
      match_passages: [
        { line_number: 2, highlighted_line: `\uE000alpha\uE001` },
        { line_number: 10, highlighted_line: `\uE000omega\uE001` },
      ],
      }])
    const layer = Layer.provide(TextRetrieval.Default, sqlLayer)

    const result = await Effect.runPromise(
      TextRetrieval.searchText({
        workspaceId,
        projectId,
        sourceVersionIds: [sourceVersionId],
        query: 'alpha omega',
        limit: 1,
      }).pipe(Effect.provide(layer)),
    )

    expect(result.evidence).toEqual([{
      sourceVersionId,
      locator: 'lines:2-2;lines:10-10',
      excerpt: 'alpha\n…\nomega',
      rank: 0.4,
    }])
  })

  it('centers a long-line excerpt on a late PostgreSQL match and locates its exact characters', async () => {
    const content = `${'prefix '.repeat(220)}lateanchor trailing context`
    const highlightedLine = `${'prefix '.repeat(220)}\uE000lateanchor\uE001 trailing context`
    const sqlLayer = SqlClientTest(async (query) => query.includes('AS ready_count')
      ? [{ ready_count: 1 }]
      : [{
      source_version_id: sourceVersionId,
      content,
      rank: 0.3,
      match_line: 1,
      match_passages: [{ line_number: 1, highlighted_line: highlightedLine }],
      }])
    const layer = Layer.provide(TextRetrieval.Default, sqlLayer)

    const result = await Effect.runPromise(
      TextRetrieval.searchText({
        workspaceId,
        projectId,
        sourceVersionIds: [sourceVersionId],
        query: 'lateanchor',
        limit: 1,
      }).pipe(Effect.provide(layer)),
    )

    const evidence = result.evidence[0]!
    const locator = /^line:1,chars:(\d+)-(\d+)$/.exec(evidence.locator)
    expect(locator).not.toBeNull()
    const start = Number(locator?.[1])
    const end = Number(locator?.[2])
    expect(start).toBeGreaterThan(1200)
    expect(evidence.excerpt).toContain('lateanchor')
    expect(evidence.excerpt).toBe(content.slice(start - 1, end))
    expect(evidence.excerpt.length).toBeLessThanOrEqual(1200)
  })
})
