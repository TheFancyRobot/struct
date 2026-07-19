import { describe, expect, it } from 'bun:test'
import { Effect, Layer } from 'effect'
import {
  ProjectId,
  SourceVersionId,
  WorkspaceId,
} from '@struct/domain'
import {
  SourceTextReindexOwnershipLostError,
  SqlClient,
  SqlClientTest,
} from '@struct/persistence'
import { TextRetrieval } from '../src/search-text'

const workspaceId = WorkspaceId.make('a50e8400-e29b-41d4-a716-446655440000')
const projectId = ProjectId.make('a50e8400-e29b-41d4-a716-446655440001')
const sourceVersionId = SourceVersionId.make('a50e8400-e29b-41d4-a716-446655440002')
const testStartMarker = '\uE000'
const testEndMarker = '\uE001'

function matchPassage(
  line_number: number,
  highlighted_line: string,
  start_marker = testStartMarker,
  end_marker = testEndMarker,
) {
  return { line_number, highlighted_line, start_marker, end_marker }
}

describe('TextRetrieval', () => {
  it('uses bounded PostgreSQL FTS scoped to workspace, project, and immutable versions', async () => {
    const calls: Array<{ query: string; params?: readonly unknown[] }> = []
    const sqlLayer = SqlClientTest(async (query, params) => {
      calls.push({ query, params })
      if (query.includes('AS ready_count')) return [{ ready_count: 1 }]
      if (query.includes('AS candidates(excerpt, candidate_number)')) {
        return [{ candidate_number: 1 }]
      }
      return [{
        source_version_id: sourceVersionId,
        content: 'Alpha\nThe launch date is July 18.\nOmega',
        rank: 0.75,
        match_line: 2,
        match_passages: [
          matchPassage(2, `The \uE000launch\uE001 \uE000date\uE001 is July 18.`),
        ],
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

    expect(calls[0]?.query).toMatch(/source_text_index/)
    expect(calls[0]?.query).not.toMatch(/source_text_reindex_jobs/)
    expect(calls[1]?.query).toMatch(/websearch_to_tsquery/)
    expect(calls[1]?.query).toMatch(/JOIN projects/)
    expect(calls[1]?.query).toMatch(/source_version_id = ANY/)
    expect(calls[1]?.query).toMatch(/WITH ORDINALITY/)
    expect(calls[1]?.query).toMatch(/LEFT JOIN LATERAL/)
    expect(calls[1]?.query).toMatch(/locator_query/)
    expect(calls[1]?.query).toMatch(/has_query_match/)
    expect(calls[1]?.query).toMatch(/ts_headline/)
    expect(calls[1]?.query).toMatch(/WITH RECURSIVE marker_candidates/)
    expect(calls[1]?.query).toMatch(/position\(start_marker IN source_lines\.line\) = 0/)
    expect(calls[1]?.query).toMatch(/'start_marker', match_markers\.start_marker/)
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

  it('treats literal former headline delimiters as source content', async () => {
    const content = `prefix \uE000 literal \uE001 target suffix`
    const startMarker = '__struct_test_start__'
    const endMarker = '__struct_test_end__'
    const sqlLayer = SqlClientTest(async (query) => {
      if (query.includes('AS ready_count')) return [{ ready_count: 1 }]
      if (query.includes('AS candidates(excerpt, candidate_number)')) {
        return [{ candidate_number: 1 }]
      }
      return [{
        source_version_id: sourceVersionId,
        content,
        rank: 0.7,
        match_line: 1,
        match_passages: [
          matchPassage(
            1,
            `prefix \uE000 literal \uE001 ${startMarker}target${endMarker} suffix`,
            startMarker,
            endMarker,
          ),
        ],
      }]
    })
    const layer = Layer.provide(TextRetrieval.Default, sqlLayer)

    const result = await Effect.runPromise(
      TextRetrieval.searchText({
        workspaceId,
        projectId,
        sourceVersionIds: [sourceVersionId],
        query: 'target',
        limit: 1,
      }).pipe(Effect.provide(layer)),
    )

    expect(result.evidence).toEqual([{
      sourceVersionId,
      locator: 'lines:1-1',
      excerpt: content,
      rank: 0.7,
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
    const ownershipCheck = calls.find(({ query }) =>
      query.includes('FROM source_text_reindex_jobs')
      && query.includes('attempts = $4'))
    expect(ownershipCheck?.query).toMatch(/status = 'in-progress'/)
    expect(ownershipCheck?.query).toMatch(/attempts = \$4/)
    expect(ownershipCheck?.params).toEqual([
      sourceVersionId,
      workspaceId,
      projectId,
      2,
    ])
    expect(completion?.query).toMatch(/status = 'in-progress'/)
    expect(completion?.query).toMatch(/attempts = \$4/)
    expect(completion?.params).toEqual([
      sourceVersionId,
      workspaceId,
      projectId,
      2,
    ])
  })

  it('rejects transferred reindex ownership before any index mutation', async () => {
    const calls: string[] = []
    const sqlLayer = SqlClientTest(async (query) => {
      calls.push(query)
      return []
    })
    const layer = Layer.provide(TextRetrieval.Default, sqlLayer)

    const exit = await Effect.runPromiseExit(
      TextRetrieval.indexText({
        workspaceId,
        projectId,
        sourceVersionId,
        content: 'stale text',
        reindexAttempt: 1,
      }).pipe(Effect.provide(layer)),
    )

    expect(exit._tag).toBe('Failure')
    expect(String(exit)).toContain(SourceTextReindexOwnershipLostError.name)
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatch(/attempts = \$4/)
    expect(calls[0]).not.toMatch(/INSERT INTO source_text_index/)
  })

  it('rolls back a staged index mutation when the completion fence is lost', async () => {
    const transactionCalls: string[] = []
    const committedCalls: string[] = []
    const sqlLayer = Layer.succeed(SqlClient, {
      unsafe: async () => [],
      transaction: async <A>(run: (executor: {
        readonly unsafe: (
          query: string,
          params?: readonly unknown[],
        ) => Promise<readonly Record<string, unknown>[]>
      }) => Promise<A>): Promise<A> => {
        const stagedCalls: string[] = []
        const result = await run({
          unsafe: async (query) => {
            transactionCalls.push(query)
            stagedCalls.push(query)
            if (
              query.includes('UPDATE source_text_reindex_jobs')
              && query.includes("SET status = 'completed'")
            ) {
              return []
            }
            return [{ source_version_id: sourceVersionId }]
          },
        })
        committedCalls.push(...stagedCalls)
        return result
      },
    })
    const layer = Layer.provide(TextRetrieval.Default, sqlLayer)

    const exit = await Effect.runPromiseExit(
      TextRetrieval.indexText({
        workspaceId,
        projectId,
        sourceVersionId,
        content: 'stale text',
        reindexAttempt: 1,
      }).pipe(Effect.provide(layer)),
    )

    expect(exit._tag).toBe('Failure')
    expect(String(exit)).toContain(SourceTextReindexOwnershipLostError.name)
    expect(transactionCalls.some((query) =>
      query.includes('INSERT INTO source_text_index'))).toBe(true)
    expect(transactionCalls.some((query) =>
      query.includes("SET status = 'completed'"))).toBe(true)
    expect(committedCalls).toEqual([])
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

  it('searches an immutable index row even while its background reindex lease is active', async () => {
    const calls: string[] = []
    const sqlLayer = SqlClientTest(async (query) => {
      calls.push(query)
      if (query.includes('AS ready_count')) {
        // A completed-status join would make this source appear unavailable while
        // its trigger-created reindex job is actively leased by another worker.
        return [{ ready_count: query.includes('source_text_reindex_jobs') ? 0 : 1 }]
      }
      if (query.includes('AS candidates(excerpt, candidate_number)')) {
        return [{ candidate_number: 1 }]
      }
      return [{
        source_version_id: sourceVersionId,
        content: 'The immutable indexed launch plan is ready.',
        rank: 0.8,
        match_line: 1,
        match_passages: [
          matchPassage(1, 'The immutable indexed \uE000launch\uE001 plan is ready.'),
        ],
      }]
    })
    const layer = Layer.provide(TextRetrieval.Default, sqlLayer)

    const result = await Effect.runPromise(
      TextRetrieval.searchText({
        workspaceId,
        projectId,
        sourceVersionIds: [sourceVersionId],
        query: 'launch',
        limit: 1,
      }).pipe(Effect.provide(layer)),
    )

    expect(calls[0]).toMatch(/JOIN source_text_index/)
    expect(calls[0]).not.toMatch(/source_text_reindex_jobs/)
    expect(result.evidence).toEqual([{
      sourceVersionId,
      locator: 'lines:1-1',
      excerpt: 'The immutable indexed launch plan is ready.',
      rank: 0.8,
    }])
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
    expect(calls[0]).toMatch(/source_text_index/)
    expect(calls[0]).not.toMatch(/source_text_reindex_jobs/)
  })

  it('anchors a stem-only match after the first six lines to the PostgreSQL match line', async () => {
    const sqlLayer = SqlClientTest(async (query) => {
      if (query.includes('AS ready_count')) return [{ ready_count: 1 }]
      if (query.includes('AS candidates(excerpt, candidate_number)')) return [{ candidate_number: 1 }]
      return [{
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
      match_passages: [
        matchPassage(7, `The service \uE000runs\uE001 nightly.`),
      ],
      }]
    })
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
    const sqlLayer = SqlClientTest(async (query, params) => {
      if (query.includes('AS ready_count')) return [{ ready_count: 1 }]
      if (query.includes('AS candidates(excerpt, candidate_number)')) {
        const excerpts = params?.[0] as ReadonlyArray<string>
        const candidate = excerpts.findIndex((excerpt) => excerpt === 'alpha\n…\nomega')
        return candidate === -1 ? [] : [{ candidate_number: candidate + 1 }]
      }
      return [{
      source_version_id: sourceVersionId,
      content,
      rank: 0.4,
      match_line: 2,
      match_passages: [
        matchPassage(2, `\uE000alpha\uE001`),
        matchPassage(10, `\uE000omega\uE001`),
      ],
      }]
    })
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

  it('preserves a later phrase match when the same lexemes occur earlier in isolation', async () => {
    const content = [
      'alpha isolated',
      'filler one',
      'omega isolated',
      'filler two',
      'filler three',
      'filler four',
      'filler five',
      'filler six',
      'filler seven',
      'alpha omega phrase',
    ].join('\n')
    const sqlLayer = SqlClientTest(async (query, params) => {
      if (query.includes('AS ready_count')) return [{ ready_count: 1 }]
      if (query.includes('AS candidates(excerpt, candidate_number)')) {
        const excerpts = params?.[0] as ReadonlyArray<string>
        const candidate = excerpts.findIndex((excerpt) => excerpt === 'alpha omega phrase')
        return candidate === -1 ? [] : [{ candidate_number: candidate + 1 }]
      }
      return [{
      source_version_id: sourceVersionId,
      content,
      rank: 0.6,
      match_line: 1,
      query_is_positional: true,
      match_passages: [
        matchPassage(1, `\uE000alpha\uE001 isolated`),
        matchPassage(3, `\uE000omega\uE001 isolated`),
        matchPassage(10, `\uE000alpha\uE001 \uE000omega\uE001 phrase`),
      ],
      }]
    })
    const layer = Layer.provide(TextRetrieval.Default, sqlLayer)

    const result = await Effect.runPromise(
      TextRetrieval.searchText({
        workspaceId,
        projectId,
        sourceVersionIds: [sourceVersionId],
        query: '"alpha omega"',
        limit: 1,
      }).pipe(Effect.provide(layer)),
    )

    expect(result.evidence).toEqual([{
      sourceVersionId,
      locator: 'lines:10-10',
      excerpt: 'alpha omega phrase',
      rank: 0.6,
    }])
  })

  it('never manufactures positional support by joining distant source ranges', async () => {
    const lines = [
      'alpha isolated early',
      ...Array.from({ length: 9 }, (_, index) => `filler ${index} ${'x'.repeat(36)}`),
      'omega isolated early',
      ...Array.from({ length: 18 }, (_, index) => `bridge ${index} ${'y'.repeat(36)}`),
      'alpha',
      'omega',
    ]
    const content = lines.join('\n')
    const sqlLayer = SqlClientTest(async (query, params) => {
      if (query.includes('AS ready_count')) return [{ ready_count: 1 }]
      if (query.includes('AS candidates(excerpt, candidate_number)')) {
        const excerpts = params?.[0] as ReadonlyArray<string>
        expect(excerpts.every((excerpt) => !excerpt.includes('\n…\n'))).toBe(true)
        const candidate = excerpts.findIndex((excerpt) => excerpt.includes('alpha\nomega'))
        return candidate === -1 ? [] : [{ candidate_number: candidate + 1 }]
      }
      return [{
        source_version_id: sourceVersionId,
        content,
        rank: 0.65,
        match_line: 1,
        query_is_positional: true,
        match_passages: [
          matchPassage(1, `\uE000alpha\uE001 isolated early`),
          matchPassage(11, `\uE000omega\uE001 isolated early`),
          matchPassage(30, `\uE000alpha\uE001`),
          matchPassage(31, `\uE000omega\uE001`),
        ],
      }]
    })
    const layer = Layer.provide(TextRetrieval.Default, sqlLayer)

    const result = await Effect.runPromise(
      TextRetrieval.searchText({
        workspaceId,
        projectId,
        sourceVersionIds: [sourceVersionId],
        query: '"alpha omega"',
        limit: 1,
      }).pipe(Effect.provide(layer)),
    )

    const evidence = result.evidence[0]!
    expect(evidence.excerpt).toContain('alpha\nomega')
    expect(evidence.locator).not.toMatch(/lines?:1(?:\D|$)/)
    expect(evidence.locator).not.toMatch(/lines?:11(?:\D|$)/)
    expect(evidence.locator).toMatch(/30/)
    expect(evidence.locator).toMatch(/31/)
  })

  it('preserves repeated positional lexeme multiplicity across adjacent long lines', async () => {
    const firstLine = `${'x'.repeat(1300)} alpha`
    const secondLine = `alpha ${'y'.repeat(1300)}`
    const content = `${firstLine}\n${secondLine}`
    const sqlLayer = SqlClientTest(async (query, params) => {
      if (query.includes('AS ready_count')) return [{ ready_count: 1 }]
      if (query.includes('AS candidates(excerpt, candidate_number)')) {
        const excerpts = params?.[0] as ReadonlyArray<string>
        const candidate = excerpts.findIndex((excerpt) => excerpt.includes('alpha\nalpha'))
        return candidate === -1 ? [] : [{ candidate_number: candidate + 1 }]
      }
      return [{
        source_version_id: sourceVersionId,
        content,
        rank: 0.66,
        match_line: 1,
        query_is_positional: true,
        match_passages: [
          matchPassage(1, `${'x'.repeat(1300)} \uE000alpha\uE001`),
          matchPassage(2, `\uE000alpha\uE001 ${'y'.repeat(1300)}`),
        ],
      }]
    })
    const layer = Layer.provide(TextRetrieval.Default, sqlLayer)

    const result = await Effect.runPromise(
      TextRetrieval.searchText({
        workspaceId,
        projectId,
        sourceVersionIds: [sourceVersionId],
        query: '"alpha alpha"',
        limit: 1,
      }).pipe(Effect.provide(layer)),
    )

    const evidence = result.evidence[0]!
    const locator =
      /^line:1,chars:(\d+)-(\d+);line:2,chars:(\d+)-(\d+)$/.exec(evidence.locator)
    expect(locator).not.toBeNull()
    const reconstructed = [
      firstLine.slice(Number(locator?.[1]) - 1, Number(locator?.[2])),
      secondLine.slice(Number(locator?.[3]) - 1, Number(locator?.[4])),
    ].join('\n')
    expect(evidence.excerpt).toBe(reconstructed)
    expect(evidence.excerpt).toContain('alpha\nalpha')
    expect(evidence.excerpt.length).toBeLessThanOrEqual(1200)
  })

  it('selects bounded supported evidence for a high-frequency single-term match', async () => {
    const content = Array.from({ length: 400 }, () => 'alpha').join('\n')
    const matchPassages = Array.from(
      { length: 400 },
      (_, index) => matchPassage(index + 1, `\uE000alpha\uE001`),
    )
    const sqlLayer = SqlClientTest(async (query) => {
      if (query.includes('AS ready_count')) return [{ ready_count: 1 }]
      if (query.includes('AS candidates(excerpt, candidate_number)')) return [{ candidate_number: 1 }]
      return [{
        source_version_id: sourceVersionId,
        content,
        rank: 0.8,
        match_line: 1,
        match_passages: matchPassages,
      }]
    })
    const layer = Layer.provide(TextRetrieval.Default, sqlLayer)

    const result = await Effect.runPromise(
      TextRetrieval.searchText({
        workspaceId,
        projectId,
        sourceVersionIds: [sourceVersionId],
        query: 'alpha',
        limit: 1,
      }).pipe(Effect.provide(layer)),
    )

    expect(result.evidence[0]?.excerpt).toContain('alpha')
    expect(result.evidence[0]?.excerpt.length).toBeLessThanOrEqual(1200)
    expect(result.evidence[0]?.locator).toBe('lines:1-1')
  })

  it('selects bounded supported evidence for a high-frequency phrase match', async () => {
    const content = 'alpha omega '.repeat(300).trim()
    const highlightedLine = '\uE000alpha\uE001 \uE000omega\uE001 '.repeat(300).trim()
    const sqlLayer = SqlClientTest(async (query) => {
      if (query.includes('AS ready_count')) return [{ ready_count: 1 }]
      if (query.includes('AS candidates(excerpt, candidate_number)')) return [{ candidate_number: 1 }]
      return [{
        source_version_id: sourceVersionId,
        content,
        rank: 0.7,
        match_line: 1,
        query_is_positional: true,
        match_passages: [matchPassage(1, highlightedLine)],
      }]
    })
    const layer = Layer.provide(TextRetrieval.Default, sqlLayer)

    const result = await Effect.runPromise(
      TextRetrieval.searchText({
        workspaceId,
        projectId,
        sourceVersionIds: [sourceVersionId],
        query: '"alpha omega"',
        limit: 1,
      }).pipe(Effect.provide(layer)),
    )

    expect(result.evidence[0]?.excerpt).toContain('alpha omega')
    expect(result.evidence[0]?.excerpt.length).toBeLessThanOrEqual(1200)
    expect(result.evidence[0]?.locator).toMatch(/^line:1,chars:/)
  })

  it('discovers the sole supported middle phrase beyond bounded marker head/tail samples', async () => {
    const preface = Array.from(
      { length: 15 },
      () => `alpha ${'x '.repeat(700)}`,
    ).join('')
    const suffix = Array.from(
      { length: 15 },
      () => `${'y '.repeat(700)}omega `,
    ).join('')
    const content = `${preface}alpha omega${suffix}`
    const highlightedLine = content
      .replaceAll('alpha', '\uE000alpha\uE001')
      .replaceAll('omega', '\uE000omega\uE001')
    let maximumProbeCount = 0
    let initialCandidateCount = 0
    let initialCandidateChars = 0
    const sqlLayer = SqlClientTest(async (query, params) => {
      if (query.includes('AS ready_count')) return [{ ready_count: 1 }]
      if (query.includes('WITH positional_ranges')) {
        const starts = params?.[0] as ReadonlyArray<number>
        const lengths = params?.[1] as ReadonlyArray<number>
        maximumProbeCount = Math.max(maximumProbeCount, starts.length)
        return starts.flatMap((start, index) =>
          content.slice(start - 1, start - 1 + lengths[index]!).includes('alpha omega')
            ? [{ candidate_number: index + 1 }]
            : [])
      }
      if (query.includes('AS candidates(excerpt, candidate_number)')) {
        const excerpts = params?.[0] as ReadonlyArray<string>
        initialCandidateCount = excerpts.length
        initialCandidateChars = excerpts.reduce(
          (total, excerpt) => total + excerpt.length,
          0,
        )
        const supported = excerpts.findIndex((excerpt) =>
          excerpt.includes('alpha omega'))
        return supported === -1 ? [] : [{ candidate_number: supported + 1 }]
      }
      if (query.includes('SELECT 1')) {
        return String(params?.[0]).includes('alpha omega') ? [{ supported: 1 }] : []
      }
      return [{
        source_version_id: sourceVersionId,
        content,
        rank: 0.95,
        match_line: 1,
        query_is_positional: true,
        match_passages: [matchPassage(1, highlightedLine)],
      }]
    })
    const layer = Layer.provide(TextRetrieval.Default, sqlLayer)

    const result = await Effect.runPromise(
      TextRetrieval.searchText({
        workspaceId,
        projectId,
        sourceVersionIds: [sourceVersionId],
        query: '"alpha omega"',
        limit: 1,
      }).pipe(Effect.provide(layer)),
    )

    const evidence = result.evidence[0]!
    expect(evidence.excerpt).toContain('alpha omega')
    expect(evidence.excerpt.length).toBeLessThanOrEqual(1200)
    expect(evidence.locator).toMatch(/^line:1,chars:/)
    expect(maximumProbeCount).toBeLessThanOrEqual(2)
    expect(initialCandidateCount).toBeLessThanOrEqual(80)
    expect(initialCandidateChars).toBeLessThanOrEqual(80 * 1200)
  })

  it('discovers a sole cross-line middle phrase omitted by bounded line head/tail samples', async () => {
    const lines = Array.from({ length: 50 }, (_, index) => {
      if (index === 24) return 'alpha'
      if (index === 25) return 'omega'
      return index < 24
        ? `alpha isolated ${index} ${'x'.repeat(200)}`
        : `omega isolated ${index} ${'y'.repeat(200)}`
    })
    const content = lines.join('\n')
    const sampledPassages = [
      ...lines.slice(0, 12).map((line, index) =>
        matchPassage(index + 1, line.replace('alpha', '\uE000alpha\uE001'))),
      ...lines.slice(-12).map((line, index) =>
        matchPassage(
          lines.length - 11 + index,
          line.replace('omega', '\uE000omega\uE001'),
        )),
    ]
    const sqlLayer = SqlClientTest(async (query, params) => {
      if (query.includes('AS ready_count')) return [{ ready_count: 1 }]
      if (query.includes('WITH positional_ranges')) {
        const starts = params?.[0] as ReadonlyArray<number>
        const lengths = params?.[1] as ReadonlyArray<number>
        return starts.flatMap((start, index) =>
          content.slice(start - 1, start - 1 + lengths[index]!).includes('alpha\nomega')
            ? [{ candidate_number: index + 1 }]
            : [])
      }
      if (query.includes('AS candidates(excerpt, candidate_number)')) return []
      if (query.includes('SELECT 1')) {
        return String(params?.[0]).includes('alpha\nomega')
          ? [{ supported: 1 }]
          : []
      }
      return [{
        source_version_id: sourceVersionId,
        content,
        rank: 0.9,
        match_line: 1,
        query_is_positional: true,
        match_passages: sampledPassages,
      }]
    })
    const layer = Layer.provide(TextRetrieval.Default, sqlLayer)

    const result = await Effect.runPromise(
      TextRetrieval.searchText({
        workspaceId,
        projectId,
        sourceVersionIds: [sourceVersionId],
        query: '"alpha omega"',
        limit: 1,
      }).pipe(Effect.provide(layer)),
    )

    const evidence = result.evidence[0]!
    expect(evidence.sourceVersionId).toBe(sourceVersionId)
    expect(evidence.excerpt).toContain('alpha\nomega')
    expect(evidence.locator).toMatch(/25/)
    expect(evidence.locator).toMatch(/26/)
    expect(evidence.excerpt.length).toBeLessThanOrEqual(1200)
  })

  it('bounds candidate materialization and support-query parameters for near-max common text', async () => {
    const content = 'alpha '.repeat(100_000).trim()
    const highlightedLine = '\uE000alpha\uE001 '.repeat(100_000).trim()
    let candidateCount = 0
    let candidateChars = 0
    const sqlLayer = SqlClientTest(async (query, params) => {
      if (query.includes('AS ready_count')) return [{ ready_count: 1 }]
      if (query.includes('AS candidates(excerpt, candidate_number)')) {
        const excerpts = params?.[0] as ReadonlyArray<string>
        candidateCount = excerpts.length
        candidateChars = excerpts.reduce((total, excerpt) => total + excerpt.length, 0)
        const supported = excerpts.findIndex((excerpt) => excerpt.includes('alpha'))
        return supported === -1 ? [] : [{ candidate_number: supported + 1 }]
      }
      expect(params?.[5]).toBe(24)
      expect(query).toMatch(/forward_location/)
      expect(query).toMatch(/reverse_location/)
      return [{
        source_version_id: sourceVersionId,
        content,
        rank: 0.9,
        match_line: 1,
        match_passages: [matchPassage(1, highlightedLine)],
      }]
    })
    const layer = Layer.provide(TextRetrieval.Default, sqlLayer)

    const result = await Effect.runPromise(
      TextRetrieval.searchText({
        workspaceId,
        projectId,
        sourceVersionIds: [sourceVersionId],
        query: 'alpha',
        limit: 1,
      }).pipe(Effect.provide(layer)),
    )

    expect(content.length).toBeGreaterThan(500_000)
    expect(candidateCount).toBeGreaterThan(0)
    expect(candidateCount).toBeLessThanOrEqual(80)
    expect(candidateChars).toBeLessThanOrEqual(80 * 1200)
    expect(result.evidence[0]?.excerpt).toContain('alpha')
    expect(result.evidence[0]?.excerpt.length).toBeLessThanOrEqual(1200)
  })

  it('centers a long-line excerpt on a late PostgreSQL match and locates its exact characters', async () => {
    const content = `${'prefix '.repeat(220)}lateanchor trailing context`
    const highlightedLine = `${'prefix '.repeat(220)}\uE000lateanchor\uE001 trailing context`
    const sqlLayer = SqlClientTest(async (query) => {
      if (query.includes('AS ready_count')) return [{ ready_count: 1 }]
      if (query.includes('AS candidates(excerpt, candidate_number)')) return [{ candidate_number: 1 }]
      return [{
      source_version_id: sourceVersionId,
      content,
      rank: 0.3,
      match_line: 1,
      match_passages: [matchPassage(1, highlightedLine)],
      }]
    })
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
    expect(start).toBeGreaterThan(0)
    expect(end).toBeGreaterThan(1200)
    expect(evidence.excerpt).toContain('lateanchor')
    expect(evidence.excerpt).toBe(content.slice(start - 1, end))
    expect(evidence.excerpt.length).toBeLessThanOrEqual(1200)
  })
})
