import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Effect, Exit, Layer, Option } from 'effect'
import postgres from 'postgres'
import type postgresTypes from 'postgres'
import {
  CitationId,
  EventJournalId,
  JobQueueId,
  ProjectId,
  ResearchRunId,
  ResearchThreadId,
  SourceId,
  SourceVersionId,
  WorkspaceId,
} from '@struct/domain'
import {
  ResearchExecutionRepo,
  ResearchRunRepo,
  SourceTextReindexRepo,
  SqlClient,
  SqlClientLive,
} from '@struct/persistence'
import { TextRetrieval } from '@struct/retrieval'
import { requireEvidence, validateAnswerCitations } from '@struct/research-engine'
import { processOneResearchJob } from '../../../worker/src/jobs/run-research'
import { startResearch } from './research'

const DATABASE_URL = process.env['DATABASE_URL']
const describeIf = DATABASE_URL ? describe : describe.skip

const workspaceId = WorkspaceId.make('f50e8400-e29b-41d4-a716-446655440000')
const projectId = ProjectId.make('f50e8400-e29b-41d4-a716-446655440001')
const sourceId = SourceId.make('f50e8400-e29b-41d4-a716-446655440002')
const sourceVersionId = SourceVersionId.make('f50e8400-e29b-41d4-a716-446655440003')
const crossLineSourceId = SourceId.make('f50e8400-e29b-41d4-a716-446655440004')
const crossLineSourceVersionId = SourceVersionId.make('f50e8400-e29b-41d4-a716-446655440005')
const distantTermsSourceId = SourceId.make('f50e8400-e29b-41d4-a716-446655440006')
const distantTermsSourceVersionId = SourceVersionId.make('f50e8400-e29b-41d4-a716-446655440007')
const longLineSourceId = SourceId.make('f50e8400-e29b-41d4-a716-446655440008')
const longLineSourceVersionId = SourceVersionId.make('f50e8400-e29b-41d4-a716-446655440009')
const repeatedPhraseSourceId = SourceId.make('f50e8400-e29b-41d4-a716-44665544000a')
const repeatedPhraseSourceVersionId =
  SourceVersionId.make('f50e8400-e29b-41d4-a716-44665544000b')
const frequentTermSourceId = SourceId.make('f50e8400-e29b-41d4-a716-44665544000c')
const frequentTermSourceVersionId =
  SourceVersionId.make('f50e8400-e29b-41d4-a716-44665544000d')
const frequentPhraseSourceId = SourceId.make('f50e8400-e29b-41d4-a716-44665544000e')
const frequentPhraseSourceVersionId =
  SourceVersionId.make('f50e8400-e29b-41d4-a716-44665544000f')
const adversarialPhraseSourceId =
  SourceId.make('f50e8400-e29b-41d4-a716-446655440010')
const adversarialPhraseSourceVersionId =
  SourceVersionId.make('f50e8400-e29b-41d4-a716-446655440011')
const repeatedCrossLineSourceId =
  SourceId.make('f50e8400-e29b-41d4-a716-446655440012')
const repeatedCrossLineSourceVersionId =
  SourceVersionId.make('f50e8400-e29b-41d4-a716-446655440013')
const distantTermsContent = [
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
const longLineContent = `${'prefix '.repeat(220)}lateanchor trailing context`
const adversarialPhraseContent = [
  'alpha isolated early',
  ...Array.from({ length: 9 }, (_, index) => `filler ${index} ${'x'.repeat(36)}`),
  'omega isolated early',
  ...Array.from({ length: 18 }, (_, index) => `bridge ${index} ${'y'.repeat(36)}`),
  'alpha',
  'omega',
].join('\n')
const repeatedCrossLineFirst = `${'x'.repeat(1300)} alpha`
const repeatedCrossLineSecond = `alpha ${'y'.repeat(1300)}`
const repeatedCrossLineContent =
  `${repeatedCrossLineFirst}\n${repeatedCrossLineSecond}`

async function cleanup(sql: postgresTypes.Sql): Promise<void> {
  await sql.unsafe(`DELETE FROM event_journal WHERE workspace_id = $1`, [workspaceId])
  await sql.unsafe(`DELETE FROM job_queue WHERE workspace_id = $1`, [workspaceId])
  await sql.unsafe(
    `DELETE FROM research_threads WHERE project_id = $1`,
    [projectId],
  )
  await sql.unsafe(`DELETE FROM source_versions WHERE source_id = $1`, [longLineSourceId])
  await sql.unsafe(`DELETE FROM source_versions WHERE source_id = $1`, [repeatedCrossLineSourceId])
  await sql.unsafe(`DELETE FROM source_versions WHERE source_id = $1`, [adversarialPhraseSourceId])
  await sql.unsafe(`DELETE FROM source_versions WHERE source_id = $1`, [frequentPhraseSourceId])
  await sql.unsafe(`DELETE FROM source_versions WHERE source_id = $1`, [frequentTermSourceId])
  await sql.unsafe(`DELETE FROM source_versions WHERE source_id = $1`, [repeatedPhraseSourceId])
  await sql.unsafe(`DELETE FROM source_versions WHERE source_id = $1`, [distantTermsSourceId])
  await sql.unsafe(`DELETE FROM source_versions WHERE source_id = $1`, [crossLineSourceId])
  await sql.unsafe(`DELETE FROM source_versions WHERE source_id = $1`, [sourceId])
  await sql.unsafe(`DELETE FROM sources WHERE id = $1`, [longLineSourceId])
  await sql.unsafe(`DELETE FROM sources WHERE id = $1`, [repeatedCrossLineSourceId])
  await sql.unsafe(`DELETE FROM sources WHERE id = $1`, [adversarialPhraseSourceId])
  await sql.unsafe(`DELETE FROM sources WHERE id = $1`, [frequentPhraseSourceId])
  await sql.unsafe(`DELETE FROM sources WHERE id = $1`, [frequentTermSourceId])
  await sql.unsafe(`DELETE FROM sources WHERE id = $1`, [repeatedPhraseSourceId])
  await sql.unsafe(`DELETE FROM sources WHERE id = $1`, [distantTermsSourceId])
  await sql.unsafe(`DELETE FROM sources WHERE id = $1`, [crossLineSourceId])
  await sql.unsafe(`DELETE FROM sources WHERE id = $1`, [sourceId])
  await sql.unsafe(`DELETE FROM projects WHERE id = $1`, [projectId])
  await sql.unsafe(`DELETE FROM workspaces WHERE id = $1`, [workspaceId])
}

describeIf('research walking slice real DB integration', () => {
  let sql: postgresTypes.Sql

  beforeAll(async () => {
    if (!DATABASE_URL) return
    sql = postgres(DATABASE_URL, { max: 4, idle_timeout: 5 })
    await cleanup(sql)
    await sql.unsafe(
      `INSERT INTO workspaces (id, name) VALUES ($1, 'Research Workspace')`,
      [workspaceId],
    )
    await sql.unsafe(
      `INSERT INTO projects (id, workspace_id, name) VALUES ($1, $2, 'Research Project')`,
      [projectId, workspaceId],
    )
    await sql.unsafe(
      `INSERT INTO sources (id, project_id, name, kind)
       VALUES ($1, $2, 'launch.txt', 'document')`,
      [sourceId, projectId],
    )
    await sql.unsafe(
      `INSERT INTO source_versions (id, source_id, version, artifact_ref, content_hash)
       VALUES ($1, $2, 1, 'artifact://sha256/test', 'sha256:test')`,
      [sourceVersionId, sourceId],
    )
    await sql.unsafe(
      `INSERT INTO source_text_index (source_version_id, content)
       VALUES ($1, 'The launch date is July 18.')`,
      [sourceVersionId],
    )
    await sql.unsafe(
      `INSERT INTO sources (id, project_id, name, kind)
       VALUES ($1, $2, 'cross-line.txt', 'document')`,
      [crossLineSourceId, projectId],
    )
    await sql.unsafe(
      `INSERT INTO source_versions (id, source_id, version, artifact_ref, content_hash)
       VALUES ($1, $2, 1, 'artifact://sha256/cross-line', 'sha256:cross-line')`,
      [crossLineSourceVersionId, crossLineSourceId],
    )
    await sql.unsafe(
      `INSERT INTO source_text_index (source_version_id, content)
       VALUES ($1, 'Prologue\nalpha\nomega\nlaunch\nwindow\nEpilogue')`,
      [crossLineSourceVersionId],
    )
    await sql.unsafe(
      `INSERT INTO sources (id, project_id, name, kind)
       VALUES ($1, $2, 'distant-terms.txt', 'document')`,
      [distantTermsSourceId, projectId],
    )
    await sql.unsafe(
      `INSERT INTO source_versions (id, source_id, version, artifact_ref, content_hash)
       VALUES ($1, $2, 1, 'artifact://sha256/distant-terms', 'sha256:distant-terms')`,
      [distantTermsSourceVersionId, distantTermsSourceId],
    )
    await sql.unsafe(
      `INSERT INTO source_text_index (source_version_id, content)
       VALUES ($1, $2)`,
      [distantTermsSourceVersionId, distantTermsContent],
    )
    await sql.unsafe(
      `INSERT INTO sources (id, project_id, name, kind)
       VALUES ($1, $2, 'long-line.txt', 'document')`,
      [longLineSourceId, projectId],
    )
    await sql.unsafe(
      `INSERT INTO source_versions (id, source_id, version, artifact_ref, content_hash)
       VALUES ($1, $2, 1, 'artifact://sha256/long-line', 'sha256:long-line')`,
      [longLineSourceVersionId, longLineSourceId],
    )
    await sql.unsafe(
      `INSERT INTO source_text_index (source_version_id, content)
       VALUES ($1, $2)`,
      [longLineSourceVersionId, longLineContent],
    )
    await sql.unsafe(
      `INSERT INTO sources (id, project_id, name, kind)
       VALUES ($1, $2, 'repeated-phrase.txt', 'document')`,
      [repeatedPhraseSourceId, projectId],
    )
    await sql.unsafe(
      `INSERT INTO source_versions (id, source_id, version, artifact_ref, content_hash)
       VALUES ($1, $2, 1, 'artifact://sha256/repeated-phrase', 'sha256:repeated-phrase')`,
      [repeatedPhraseSourceVersionId, repeatedPhraseSourceId],
    )
    await sql.unsafe(
      `INSERT INTO source_text_index (source_version_id, content)
       VALUES ($1, $2)`,
      [
        repeatedPhraseSourceVersionId,
        [
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
        ].join('\n'),
      ],
    )
    await sql.unsafe(
      `INSERT INTO sources (id, project_id, name, kind)
       VALUES ($1, $2, 'frequent-term.txt', 'document'),
              ($3, $2, 'frequent-phrase.txt', 'document')`,
      [frequentTermSourceId, projectId, frequentPhraseSourceId],
    )
    await sql.unsafe(
      `INSERT INTO source_versions (id, source_id, version, artifact_ref, content_hash)
       VALUES ($1, $2, 1, 'artifact://sha256/frequent-term', 'sha256:frequent-term'),
              ($3, $4, 1, 'artifact://sha256/frequent-phrase', 'sha256:frequent-phrase')`,
      [
        frequentTermSourceVersionId,
        frequentTermSourceId,
        frequentPhraseSourceVersionId,
        frequentPhraseSourceId,
      ],
    )
    await sql.unsafe(
      `INSERT INTO source_text_index (source_version_id, content)
       VALUES ($1, $2), ($3, $4)`,
      [
        frequentTermSourceVersionId,
        Array.from({ length: 400 }, () => 'alpha').join('\n'),
        frequentPhraseSourceVersionId,
        'alpha omega '.repeat(300).trim(),
      ],
    )
    await sql.unsafe(
      `INSERT INTO sources (id, project_id, name, kind)
       VALUES
         ($1, $3, 'adversarial-phrase.txt', 'document'),
         ($2, $3, 'repeated-cross-line.txt', 'document')`,
      [adversarialPhraseSourceId, repeatedCrossLineSourceId, projectId],
    )
    await sql.unsafe(
      `INSERT INTO source_versions (
         id, source_id, version, artifact_ref, content_hash
       )
       VALUES
         ($1, $2, 1, 'artifact://sha256/adversarial-phrase', 'sha256:adversarial-phrase'),
         ($3, $4, 1, 'artifact://sha256/repeated-cross-line', 'sha256:repeated-cross-line')`,
      [
        adversarialPhraseSourceVersionId,
        adversarialPhraseSourceId,
        repeatedCrossLineSourceVersionId,
        repeatedCrossLineSourceId,
      ],
    )
    await sql.unsafe(
      `INSERT INTO source_text_index (source_version_id, content)
       VALUES ($1, $2), ($3, $4)`,
      [
        adversarialPhraseSourceVersionId,
        adversarialPhraseContent,
        repeatedCrossLineSourceVersionId,
        repeatedCrossLineContent,
      ],
    )
    await sql.unsafe(
      `UPDATE source_text_reindex_jobs
       SET status = 'completed', updated_at = NOW()
       WHERE project_id = $1`,
      [projectId],
    )
  })

  afterAll(async () => {
    if (!sql) return
    await cleanup(sql)
    await sql.end()
  })

  async function execute(
    question: string,
    suffix: '1' | '2' | '4',
    options: {
      readonly synthesisGate?: Promise<void>
      readonly onRetrievalPersisted?: () => void
      readonly failAfterRetrieval?: boolean
    } = {},
  ) {
    const sqlLayer = SqlClientLive(sql)
    const executionLayer = Layer.provide(ResearchExecutionRepo.Default, sqlLayer)
    const runLayer = Layer.provide(ResearchRunRepo.Default, sqlLayer)
    const retrievalLayer = Layer.provide(TextRetrieval.Default, sqlLayer)
    const runId = ResearchRunId.make(`f50e8400-e29b-41d4-a716-44665544001${suffix}`)
    const jobId = JobQueueId.make(`f50e8400-e29b-41d4-a716-44665544002${suffix}`)

    await Effect.runPromise(startResearch({
      workspaceId,
      projectId,
      sourceVersionIds: [sourceVersionId],
      question,
    }, {
      now: () => BigInt(Date.now()),
      randomThreadId: () =>
        ResearchThreadId.make(`f50e8400-e29b-41d4-a716-44665544003${suffix}`),
      randomRunId: () => runId,
      randomJobId: () => jobId,
      randomEventId: () =>
        EventJournalId.make(`f50e8400-e29b-41d4-a716-44665544004${suffix}`),
      register: (input) =>
        ResearchExecutionRepo.register(input).pipe(Effect.provide(executionLayer)),
    }))

    await Effect.runPromise(processOneResearchJob({
      now: () => BigInt(Date.now()),
      staleBeforeMs: Date.now() - 300_000,
      randomEventId: () => EventJournalId.make(crypto.randomUUID()),
      randomCitationId: () => CitationId.make(crypto.randomUUID()),
      jobs: {
        recoverStale: (staleBeforeMs) =>
          ResearchExecutionRepo.recoverStale(staleBeforeMs).pipe(
            Effect.provide(executionLayer),
          ),
        claimNext: () =>
          ResearchExecutionRepo.claimNext().pipe(Effect.provide(executionLayer)),
        appendInProgressEvent: (jobId, event) =>
          ResearchExecutionRepo.appendInProgressEvent(jobId, event).pipe(
            Effect.provide(executionLayer),
          ),
        complete: (input) =>
          ResearchExecutionRepo.complete(input).pipe(Effect.provide(executionLayer)),
        fail: (input) =>
          ResearchExecutionRepo.fail(input).pipe(Effect.provide(executionLayer)),
      },
      runs: {
        findById: (id) => ResearchRunRepo.findById(id).pipe(Effect.provide(runLayer)),
      },
      workflow: {
        run: ({
          run,
          workspaceId: scopeWorkspaceId,
          projectId: scopeProjectId,
          sourceVersionIds,
          onRetrievalCompleted,
        }) =>
          Effect.gen(function* () {
            const result = yield* TextRetrieval.searchText({
              workspaceId: scopeWorkspaceId,
              projectId: scopeProjectId,
              sourceVersionIds: [...sourceVersionIds],
              query: run.question,
              limit: 5,
            }).pipe(Effect.provide(retrievalLayer))
            yield* onRetrievalCompleted(result.evidence)
            options.onRetrievalPersisted?.()
            if (options.synthesisGate) {
              yield* Effect.promise(() => options.synthesisGate!)
            }
            if (options.failAfterRetrieval) {
              return yield* Effect.fail({ _tag: 'SynthesisError' })
            }
            const evidence = yield* requireEvidence(run.question, result.evidence)
            const answer = yield* validateAnswerCitations({
              answer: evidence[0].excerpt,
              citations: [{
                sourceVersionId: evidence[0].sourceVersionId,
                locator: evidence[0].locator,
              }],
            }, evidence)
            return {
              plan: {
                query: run.question,
                maxSteps: 5,
                maxToolCalls: 1,
                maxModelCalls: 1,
              },
              evidence: [...evidence],
              answer,
            }
          }),
      },
    }))
    return { runId, jobId }
  }

  it('persists a grounded answer, citation, and ordered research events', async () => {
    const { runId, jobId } = await execute('What is the launch date?', '1')
    const [run] = await sql.unsafe(`SELECT status FROM research_runs WHERE id = $1`, [runId])
    const [job] = await sql.unsafe(`SELECT status FROM job_queue WHERE id = $1`, [jobId])
    const [result] = await sql.unsafe(
      `SELECT answer, citations FROM research_run_results WHERE run_id = $1`,
      [runId],
    )
    const citations = await sql.unsafe(`SELECT locator FROM citations WHERE run_id = $1`, [runId])
    const events = await sql.unsafe(
      `SELECT event_type FROM event_journal WHERE entity_id = $1 ORDER BY cursor`,
      [runId],
    )

    expect(run['status']).toBe('completed')
    expect(job['status']).toBe('completed')
    expect(result['answer']).toContain('July 18')
    expect(citations).toHaveLength(1)
    expect(events.map((item) => item['event_type'])).toEqual([
      'research-started',
      'retrieval-completed',
      'citations-validated',
      'research-completed',
    ])
  })

  it('persists retrieval completion before blocked synthesis and retains it after synthesis fails', async () => {
    let releaseSynthesis!: () => void
    const synthesisGate = new Promise<void>((resolve) => {
      releaseSynthesis = resolve
    })
    let retrievalPersisted!: () => void
    const retrievalVisible = new Promise<void>((resolve) => {
      retrievalPersisted = resolve
    })
    const processing = execute('What is the launch date?', '4', {
      synthesisGate,
      onRetrievalPersisted: retrievalPersisted,
      failAfterRetrieval: true,
    })

    await retrievalVisible
    const blockedEvents = await sql.unsafe(
      `SELECT event_type FROM event_journal
       WHERE entity_id = $1
       ORDER BY cursor`,
      [ResearchRunId.make('f50e8400-e29b-41d4-a716-446655440014')],
    )
    const [blockedRun] = await sql.unsafe(
      `SELECT status FROM research_runs WHERE id = $1`,
      [ResearchRunId.make('f50e8400-e29b-41d4-a716-446655440014')],
    )

    expect(blockedEvents.map((item) => item['event_type'])).toEqual([
      'research-started',
      'retrieval-completed',
    ])
    expect(blockedRun['status']).toBe('in-progress')

    releaseSynthesis()
    const { runId, jobId } = await processing
    const [run] = await sql.unsafe(`SELECT status FROM research_runs WHERE id = $1`, [runId])
    const [job] = await sql.unsafe(`SELECT status FROM job_queue WHERE id = $1`, [jobId])
    const finalEvents = await sql.unsafe(
      `SELECT event_type FROM event_journal WHERE entity_id = $1 ORDER BY cursor`,
      [runId],
    )

    expect(run['status']).toBe('failed')
    expect(job['status']).toBe('failed')
    expect(finalEvents.map((item) => item['event_type'])).toEqual([
      'research-started',
      'retrieval-completed',
      'research-failed',
    ])
  })

  it('preserves a document FTS match when required terms span lines', async () => {
    const retrievalLayer = Layer.provide(TextRetrieval.Default, SqlClientLive(sql))
    const result = await Effect.runPromise(
      TextRetrieval.searchText({
        workspaceId,
        projectId,
        sourceVersionIds: [crossLineSourceVersionId],
        query: 'alpha omega',
        limit: 1,
      }).pipe(Effect.provide(retrievalLayer)),
    )

    expect(result.evidence).toHaveLength(1)
    expect(result.evidence[0]).toMatchObject({
      sourceVersionId: crossLineSourceVersionId,
      locator: 'lines:2-6',
    })
    expect(result.evidence[0]?.excerpt).toContain('alpha\nomega')
  })

  it('preserves a document FTS phrase match when the phrase spans lines', async () => {
    const retrievalLayer = Layer.provide(TextRetrieval.Default, SqlClientLive(sql))
    const result = await Effect.runPromise(
      TextRetrieval.searchText({
        workspaceId,
        projectId,
        sourceVersionIds: [crossLineSourceVersionId],
        query: '"launch window"',
        limit: 1,
      }).pipe(Effect.provide(retrievalLayer)),
    )

    expect(result.evidence).toHaveLength(1)
    expect(result.evidence[0]).toMatchObject({
      sourceVersionId: crossLineSourceVersionId,
      locator: 'lines:4-6',
    })
    expect(result.evidence[0]?.excerpt).toContain('launch\nwindow')
  })

  it('preserves the supported phrase occurrence after earlier isolated lexemes', async () => {
    const retrievalLayer = Layer.provide(TextRetrieval.Default, SqlClientLive(sql))
    const result = await Effect.runPromise(
      TextRetrieval.searchText({
        workspaceId,
        projectId,
        sourceVersionIds: [repeatedPhraseSourceVersionId],
        query: '"alpha omega"',
        limit: 1,
      }).pipe(Effect.provide(retrievalLayer)),
    )

    expect(result.evidence).toHaveLength(1)
    expect(result.evidence[0]).toMatchObject({
      sourceVersionId: repeatedPhraseSourceVersionId,
      locator: 'lines:10-10',
      excerpt: 'alpha omega phrase',
    })
  })

  it('cites the real adjacent source coordinates instead of isolated earlier lexemes', async () => {
    const retrievalLayer = Layer.provide(TextRetrieval.Default, SqlClientLive(sql))
    const result = await Effect.runPromise(
      TextRetrieval.searchText({
        workspaceId,
        projectId,
        sourceVersionIds: [adversarialPhraseSourceVersionId],
        query: '"alpha omega"',
        limit: 1,
      }).pipe(Effect.provide(retrievalLayer)),
    )

    const evidence = result.evidence[0]!
    expect(evidence.excerpt).toContain('alpha\nomega')
    expect(evidence.locator).not.toMatch(/lines?:1(?:\D|$)/)
    expect(evidence.locator).not.toMatch(/lines?:11(?:\D|$)/)
    expect(evidence.locator).toMatch(/30/)
    expect(evidence.locator).toMatch(/31/)
  })

  it('keeps a repeated-lexeme phrase across adjacent long lines bounded and exact', async () => {
    const retrievalLayer = Layer.provide(TextRetrieval.Default, SqlClientLive(sql))
    const result = await Effect.runPromise(
      TextRetrieval.searchText({
        workspaceId,
        projectId,
        sourceVersionIds: [repeatedCrossLineSourceVersionId],
        query: '"alpha alpha"',
        limit: 1,
      }).pipe(Effect.provide(retrievalLayer)),
    )

    const evidence = result.evidence[0]!
    const locator =
      /^line:1,chars:(\d+)-(\d+);line:2,chars:(\d+)-(\d+)$/.exec(evidence.locator)
    expect(locator).not.toBeNull()
    expect(evidence.excerpt).toBe([
      repeatedCrossLineFirst.slice(Number(locator?.[1]) - 1, Number(locator?.[2])),
      repeatedCrossLineSecond.slice(Number(locator?.[3]) - 1, Number(locator?.[4])),
    ].join('\n'))
    expect(evidence.excerpt).toContain('alpha\nalpha')
    expect(evidence.excerpt.length).toBeLessThanOrEqual(1200)
  })

  it('bounds high-frequency single-term evidence while preserving exact grounding', async () => {
    const retrievalLayer = Layer.provide(TextRetrieval.Default, SqlClientLive(sql))
    const result = await Effect.runPromise(
      TextRetrieval.searchText({
        workspaceId,
        projectId,
        sourceVersionIds: [frequentTermSourceVersionId],
        query: 'alpha',
        limit: 1,
      }).pipe(Effect.provide(retrievalLayer)),
    )

    const evidence = result.evidence[0]!
    expect(evidence.sourceVersionId).toBe(frequentTermSourceVersionId)
    expect(evidence.excerpt).toContain('alpha')
    expect(evidence.excerpt.length).toBeLessThanOrEqual(1200)
    await expect(
      Effect.runPromise(validateAnswerCitations({
        answer: evidence.excerpt,
        citations: [{
          sourceVersionId: evidence.sourceVersionId,
          locator: evidence.locator,
        }],
      }, result.evidence)),
    ).resolves.toMatchObject({ citations: [{ locator: evidence.locator }] })
  })

  it('bounds high-frequency phrase evidence while preserving phrase support and exact grounding', async () => {
    const retrievalLayer = Layer.provide(TextRetrieval.Default, SqlClientLive(sql))
    const result = await Effect.runPromise(
      TextRetrieval.searchText({
        workspaceId,
        projectId,
        sourceVersionIds: [frequentPhraseSourceVersionId],
        query: '"alpha omega"',
        limit: 1,
      }).pipe(Effect.provide(retrievalLayer)),
    )

    const evidence = result.evidence[0]!
    expect(evidence.sourceVersionId).toBe(frequentPhraseSourceVersionId)
    expect(evidence.excerpt).toContain('alpha omega')
    expect(evidence.excerpt.length).toBeLessThanOrEqual(1200)
    expect(evidence.locator).toMatch(/^line:1,chars:/)
    await expect(
      Effect.runPromise(validateAnswerCitations({
        answer: evidence.excerpt,
        citations: [{
          sourceVersionId: evidence.sourceVersionId,
          locator: evidence.locator,
        }],
      }, result.evidence)),
    ).resolves.toMatchObject({ citations: [{ locator: evidence.locator }] })
  })

  it('keeps every distant required term in one bounded evidence row with exact citation grounding', async () => {
    const retrievalLayer = Layer.provide(TextRetrieval.Default, SqlClientLive(sql))
    const result = await Effect.runPromise(
      TextRetrieval.searchText({
        workspaceId,
        projectId,
        sourceVersionIds: [distantTermsSourceVersionId],
        query: 'alpha omega',
        limit: 1,
      }).pipe(Effect.provide(retrievalLayer)),
    )

    expect(result.evidence).toHaveLength(1)
    const evidence = result.evidence[0]!
    expect(evidence).toMatchObject({
      sourceVersionId: distantTermsSourceVersionId,
      locator: 'lines:2-2;lines:10-10',
      excerpt: 'alpha\n…\nomega',
    })
    await expect(
      Effect.runPromise(validateAnswerCitations({
        answer: evidence.excerpt,
        citations: [{
          sourceVersionId: evidence.sourceVersionId,
          locator: evidence.locator,
        }],
      }, result.evidence)),
    ).resolves.toMatchObject({
      citations: [{ locator: evidence.locator }],
    })
  })

  it('keeps a late long-line match in its bounded excerpt with an exact character locator', async () => {
    const retrievalLayer = Layer.provide(TextRetrieval.Default, SqlClientLive(sql))
    const result = await Effect.runPromise(
      TextRetrieval.searchText({
        workspaceId,
        projectId,
        sourceVersionIds: [longLineSourceVersionId],
        query: 'lateanchor',
        limit: 1,
      }).pipe(Effect.provide(retrievalLayer)),
    )

    expect(result.evidence).toHaveLength(1)
    const evidence = result.evidence[0]!
    const locator = /^line:1,chars:(\d+)-(\d+)$/.exec(evidence.locator)
    expect(locator).not.toBeNull()
    const start = Number(locator?.[1])
    const end = Number(locator?.[2])
    expect(start).toBeGreaterThan(0)
    expect(end).toBeGreaterThan(1200)
    expect(evidence.excerpt).toContain('lateanchor')
    expect(evidence.excerpt).toBe(longLineContent.slice(start - 1, end))
    expect(evidence.excerpt.length).toBeLessThanOrEqual(1200)
    await expect(
      Effect.runPromise(validateAnswerCitations({
        answer: evidence.excerpt,
        citations: [{
          sourceVersionId: evidence.sourceVersionId,
          locator: evidence.locator,
        }],
      }, result.evidence)),
    ).resolves.toMatchObject({
      citations: [{ locator: evidence.locator }],
    })
  })

  it('persists a safe failure when deterministic retrieval finds no evidence', async () => {
    const { runId, jobId } = await execute('unicorn migration schedule', '2')
    const [run] = await sql.unsafe(`SELECT status FROM research_runs WHERE id = $1`, [runId])
    const [job] = await sql.unsafe(`SELECT status FROM job_queue WHERE id = $1`, [jobId])
    const result = await sql.unsafe(
      `SELECT answer FROM research_run_results WHERE run_id = $1`,
      [runId],
    )
    const events = await sql.unsafe(
      `SELECT event_type, payload::text AS payload
       FROM event_journal WHERE entity_id = $1 ORDER BY cursor`,
      [runId],
    )

    expect(run['status']).toBe('failed')
    expect(job['status']).toBe('failed')
    expect(result).toHaveLength(0)
    expect(events.map((item) => item['event_type'])).toEqual([
      'research-started',
      'retrieval-completed',
      'research-failed',
    ])
    expect(JSON.stringify(events)).not.toContain('The launch date is July 18.')
  })

  it('atomically terminal-fails stale work and rejects a racing completion', async () => {
    const sqlLayer = SqlClientLive(sql)
    const executionLayer = Layer.provide(ResearchExecutionRepo.Default, sqlLayer)
    const runId = ResearchRunId.make('f50e8400-e29b-41d4-a716-446655440013')
    const jobId = JobQueueId.make('f50e8400-e29b-41d4-a716-446655440023')

    await Effect.runPromise(startResearch({
      workspaceId,
      projectId,
      sourceVersionIds: [sourceVersionId],
      question: 'Can stale completion win?',
    }, {
      now: () => BigInt(Date.now()),
      randomThreadId: () =>
        ResearchThreadId.make('f50e8400-e29b-41d4-a716-446655440033'),
      randomRunId: () => runId,
      randomJobId: () => jobId,
      randomEventId: () =>
        EventJournalId.make('f50e8400-e29b-41d4-a716-446655440043'),
      register: (input) =>
        ResearchExecutionRepo.register(input).pipe(Effect.provide(executionLayer)),
    }))
    const claimed = await Effect.runPromise(
      ResearchExecutionRepo.claimNext().pipe(Effect.provide(executionLayer)),
    )
    expect(Option.isSome(claimed)).toBe(true)
    await sql.unsafe(
      `UPDATE job_queue SET updated_at = NOW() - INTERVAL '10 minutes' WHERE id = $1`,
      [jobId],
    )

    const recovered = await Effect.runPromise(
      ResearchExecutionRepo.recoverStale(Date.now() - 300_000).pipe(
        Effect.provide(executionLayer),
      ),
    )
    expect(recovered.map((item) => item.id)).toContain(jobId)

    const completion = await Effect.runPromiseExit(
      ResearchExecutionRepo.complete({
        runId,
        jobId,
        answer: {
          answer: 'This must not persist.',
          citations: [{ sourceVersionId, locator: 'lines:1-1' }],
        },
        citations: [{
          id: CitationId.make('f50e8400-e29b-41d4-a716-446655440053'),
          runId,
          sourceVersionId,
          locator: 'lines:1-1',
          status: 'validated',
          createdAt: BigInt(Date.now()),
        }],
        event: {
          id: EventJournalId.make('f50e8400-e29b-41d4-a716-446655440063'),
          workspaceId,
          entityType: 'research',
          entityId: runId,
          eventType: 'research-completed',
          payload: {},
          cursor: 0n,
          createdAt: BigInt(Date.now()),
        },
      }).pipe(Effect.provide(executionLayer)),
    )
    expect(Exit.isFailure(completion)).toBe(true)
    const lateRetrieval = await Effect.runPromiseExit(
      ResearchExecutionRepo.appendInProgressEvent(jobId, {
        id: EventJournalId.make('f50e8400-e29b-41d4-a716-446655440073'),
        workspaceId,
        entityType: 'research',
        entityId: runId,
        eventType: 'retrieval-completed',
        payload: { evidenceCount: 1, sourceVersionIds: [sourceVersionId] },
        cursor: 0n,
        createdAt: BigInt(Date.now()),
      }).pipe(Effect.provide(executionLayer)),
    )
    expect(Exit.isFailure(lateRetrieval)).toBe(true)

    const [runRow] = await sql.unsafe(
      `SELECT status FROM research_runs WHERE id = $1`,
      [runId],
    )
    const [jobRow] = await sql.unsafe(
      `SELECT status FROM job_queue WHERE id = $1`,
      [jobId],
    )
    const resultRows = await sql.unsafe(
      `SELECT run_id FROM research_run_results WHERE run_id = $1`,
      [runId],
    )
    const events = await sql.unsafe(
      `SELECT event_type, payload
       FROM event_journal
       WHERE entity_id = $1
       ORDER BY cursor`,
      [runId],
    )
    expect(runRow['status']).toBe('failed')
    expect(jobRow['status']).toBe('failed')
    expect(resultRows).toHaveLength(0)
    expect(events.map((item) => item['event_type'])).toEqual([
      'research-started',
      'research-failed',
    ])
    expect(events[1]?.['payload']).toMatchObject({
      errorTag: 'ResearchJobStaleError',
      message: 'Research failed',
    })
  })

  it('keeps polling after stale recovery fences citations and completion', async () => {
    const sqlLayer = SqlClientLive(sql)
    const executionLayer = Layer.provide(ResearchExecutionRepo.Default, sqlLayer)
    const runLayer = Layer.provide(ResearchRunRepo.Default, sqlLayer)
    const staleRunId = ResearchRunId.make('f50e8400-e29b-41d4-a716-446655440015')
    const staleJobId = JobQueueId.make('f50e8400-e29b-41d4-a716-446655440025')

    await Effect.runPromise(startResearch({
      workspaceId,
      projectId,
      sourceVersionIds: [sourceVersionId],
      question: 'Can a stale worker append validated citations?',
    }, {
      now: () => BigInt(Date.now()),
      randomThreadId: () =>
        ResearchThreadId.make('f50e8400-e29b-41d4-a716-446655440035'),
      randomRunId: () => staleRunId,
      randomJobId: () => staleJobId,
      randomEventId: () =>
        EventJournalId.make('f50e8400-e29b-41d4-a716-446655440045'),
      register: (input) =>
        ResearchExecutionRepo.register(input).pipe(Effect.provide(executionLayer)),
    }))

    const process = () => processOneResearchJob({
      now: () => BigInt(Date.now()),
      staleBeforeMs: Date.now() - 300_000,
      randomEventId: () => EventJournalId.make(crypto.randomUUID()),
      randomCitationId: () => CitationId.make(crypto.randomUUID()),
      jobs: {
        recoverStale: (staleBeforeMs) =>
          ResearchExecutionRepo.recoverStale(staleBeforeMs).pipe(
            Effect.provide(executionLayer),
          ),
        claimNext: () =>
          ResearchExecutionRepo.claimNext().pipe(Effect.provide(executionLayer)),
        appendInProgressEvent: (jobId, researchEvent) =>
          ResearchExecutionRepo.appendInProgressEvent(jobId, researchEvent).pipe(
            Effect.provide(executionLayer),
          ),
        complete: (input) =>
          ResearchExecutionRepo.complete(input).pipe(Effect.provide(executionLayer)),
        fail: (input) =>
          ResearchExecutionRepo.fail(input).pipe(Effect.provide(executionLayer)),
      },
      runs: {
        findById: (id) => ResearchRunRepo.findById(id).pipe(Effect.provide(runLayer)),
      },
      workflow: {
        run: ({ onRetrievalCompleted }) =>
          Effect.gen(function* () {
            const retrieved = [{
              sourceVersionId,
              locator: 'lines:1-1',
              excerpt: 'The launch date is July 18.',
              rank: 1,
            }]
            yield* onRetrievalCompleted(retrieved)
            yield* Effect.promise(() =>
              sql.unsafe(
                `UPDATE job_queue
                 SET updated_at = NOW() - INTERVAL '10 minutes'
                 WHERE id = $1`,
                [staleJobId],
              ),
            )
            yield* ResearchExecutionRepo.recoverStale(Date.now() - 300_000).pipe(
              Effect.provide(executionLayer),
            )
            return {
              plan: {
                query: 'Can a stale worker append validated citations?',
                maxSteps: 5,
                maxToolCalls: 1,
                maxModelCalls: 1,
              },
              evidence: retrieved,
              answer: {
                answer: 'The launch date is July 18.',
                citations: [{ sourceVersionId, locator: 'lines:1-1' }],
              },
            }
          }),
      },
    })

    await expect(Effect.runPromise(process())).resolves.toEqual({
      processed: true,
      jobId: staleJobId,
    })
    await expect(Effect.runPromise(process())).resolves.toEqual({
      processed: false,
    })

    const [runRow] = await sql.unsafe(
      `SELECT status FROM research_runs WHERE id = $1`,
      [staleRunId],
    )
    const [jobRow] = await sql.unsafe(
      `SELECT status FROM job_queue WHERE id = $1`,
      [staleJobId],
    )
    const results = await sql.unsafe(
      `SELECT run_id FROM research_run_results WHERE run_id = $1`,
      [staleRunId],
    )
    const events = await sql.unsafe(
      `SELECT event_type, payload
       FROM event_journal
       WHERE entity_id = $1
       ORDER BY cursor`,
      [staleRunId],
    )

    expect(runRow['status']).toBe('failed')
    expect(jobRow['status']).toBe('failed')
    expect(results).toHaveLength(0)
    expect(events.map((item) => item['event_type'])).toEqual([
      'research-started',
      'retrieval-completed',
      'research-failed',
    ])
    expect(JSON.stringify(events)).not.toContain('citations-validated')
    expect(events[2]?.['payload']).toMatchObject({
      errorTag: 'ResearchJobStaleError',
      message: 'Research failed',
    })
  })

  it('rejects stale reindex completion and failure after a newer claim owns the lease', async () => {
    const sqlLayer = SqlClientLive(sql)
    const reindexLayer = Layer.provide(SourceTextReindexRepo.Default, sqlLayer)
    const retrievalLayer = Layer.provide(TextRetrieval.Default, sqlLayer)
    await sql.unsafe(
      `UPDATE source_text_reindex_jobs
       SET status = 'pending', attempts = 0, updated_at = NOW()
       WHERE source_version_id = $1`,
      [sourceVersionId],
    )

    const first = await Effect.runPromise(
      SourceTextReindexRepo.claimNext().pipe(Effect.provide(reindexLayer)),
    )
    if (Option.isNone(first)) throw new Error('first reindex lease was not claimed')
    await sql.unsafe(
      `UPDATE source_text_reindex_jobs
       SET updated_at = NOW() - INTERVAL '10 minutes'
       WHERE source_version_id = $1`,
      [sourceVersionId],
    )
    await Effect.runPromise(
      SourceTextReindexRepo.recoverStale(Date.now() - 300_000).pipe(
        Effect.provide(reindexLayer),
      ),
    )
    const second = await Effect.runPromise(
      SourceTextReindexRepo.claimNext().pipe(Effect.provide(reindexLayer)),
    )
    if (Option.isNone(second)) throw new Error('second reindex lease was not claimed')

    const staleFailure = await Effect.runPromiseExit(
      SourceTextReindexRepo.recordFailure(
        first.value,
        'artifact-unavailable',
      ).pipe(Effect.provide(reindexLayer)),
    )
    const staleCompletion = await Effect.runPromiseExit(
      TextRetrieval.indexText({
        workspaceId,
        projectId,
        sourceVersionId,
        content: 'The launch date is July 18.',
        reindexAttempt: first.value.attempts,
      }).pipe(Effect.provide(retrievalLayer)),
    )
    const [owned] = await sql.unsafe(
      `SELECT status, attempts, last_error_code
       FROM source_text_reindex_jobs
       WHERE source_version_id = $1`,
      [sourceVersionId],
    )

    expect(Exit.isFailure(staleFailure)).toBe(true)
    expect(Exit.isFailure(staleCompletion)).toBe(true)
    expect(owned).toMatchObject({
      status: 'in-progress',
      attempts: second.value.attempts,
      last_error_code: null,
    })

    await Effect.runPromise(
      TextRetrieval.indexText({
        workspaceId,
        projectId,
        sourceVersionId,
        content: 'The launch date is July 18.',
        reindexAttempt: second.value.attempts,
      }).pipe(Effect.provide(retrievalLayer)),
    )
    const [completed] = await sql.unsafe(
      `SELECT status, attempts
       FROM source_text_reindex_jobs
       WHERE source_version_id = $1`,
      [sourceVersionId],
    )
    expect(completed).toMatchObject({
      status: 'completed',
      attempts: second.value.attempts,
    })
  })

  it('serializes ingestion indexing with a claimed reindex lease without stealing ownership', async () => {
    const sqlLayer = SqlClientLive(sql)
    const reindexLayer = Layer.provide(SourceTextReindexRepo.Default, sqlLayer)
    const retrievalLayer = Layer.provide(TextRetrieval.Default, sqlLayer)
    await sql.unsafe(
      `DELETE FROM source_text_index WHERE source_version_id = $1`,
      [sourceVersionId],
    )
    await sql.unsafe(
      `UPDATE source_text_reindex_jobs
       SET status = 'pending',
           attempts = 0,
           last_error_code = NULL,
           updated_at = NOW()
       WHERE source_version_id = $1`,
      [sourceVersionId],
    )

    let transitionReachedResolve!: () => void
    const transitionReached = new Promise<void>((resolve) => {
      transitionReachedResolve = resolve
    })
    let releaseTransitionResolve!: () => void
    const releaseTransition = new Promise<void>((resolve) => {
      releaseTransitionResolve = resolve
    })
    const racingSqlLayer = Layer.succeed(SqlClient, {
      unsafe: (query, params) =>
        sql.unsafe(query, params as any[])
          .then((rows) => rows as readonly Record<string, unknown>[]),
      transaction: <A>(run: (executor: {
        readonly unsafe: (
          query: string,
          params?: readonly unknown[],
        ) => Promise<readonly Record<string, unknown>[]>
      }) => Promise<A>): Promise<A> =>
        sql.begin(async (transactionSql) =>
          run({
            unsafe: async (query, params) => {
              if (
                query.includes('UPDATE source_text_reindex_jobs')
                && query.includes("status IN ('pending', 'failed', 'in-progress', 'completed')")
              ) {
                transitionReachedResolve()
                await releaseTransition
              }
              return transactionSql.unsafe(query, params as any[])
                .then((rows) => rows as readonly Record<string, unknown>[])
            },
          }),
        ) as Promise<A>,
    })
    const racingRetrievalLayer = Layer.provide(TextRetrieval.Default, racingSqlLayer)

    const ingestionIndex = Effect.runPromise(
      TextRetrieval.indexText({
        workspaceId,
        projectId,
        sourceVersionId,
        content: 'The launch date is July 18.',
      }).pipe(Effect.provide(racingRetrievalLayer)),
    )
    await transitionReached
    const claimed = await (async () => {
      try {
        return await Effect.runPromise(
          SourceTextReindexRepo.claimNext().pipe(Effect.provide(reindexLayer)),
        )
      } finally {
        releaseTransitionResolve()
      }
    })()
    if (Option.isNone(claimed)) throw new Error('reindex lease was not claimed')
    await ingestionIndex

    const [owned] = await sql.unsafe(
      `SELECT status, attempts
       FROM source_text_reindex_jobs
       WHERE source_version_id = $1`,
      [sourceVersionId],
    )
    expect(owned).toMatchObject({
      status: 'in-progress',
      attempts: claimed.value.attempts,
    })

    await Effect.runPromise(
      TextRetrieval.indexText({
        workspaceId,
        projectId,
        sourceVersionId,
        content: 'The launch date is July 18.',
        reindexAttempt: claimed.value.attempts,
      }).pipe(Effect.provide(retrievalLayer)),
    )
    await Effect.runPromise(
      TextRetrieval.indexText({
        workspaceId,
        projectId,
        sourceVersionId,
        content: 'The launch date is July 18.',
      }).pipe(Effect.provide(retrievalLayer)),
    )

    const conflict = await Effect.runPromiseExit(
      TextRetrieval.indexText({
        workspaceId,
        projectId,
        sourceVersionId,
        content: 'conflicting immutable content',
      }).pipe(Effect.provide(retrievalLayer)),
    )
    const [finalState] = await sql.unsafe(
      `SELECT reindex.status, reindex.attempts, text_index.content
       FROM source_text_reindex_jobs reindex
       JOIN source_text_index text_index
         ON text_index.source_version_id = reindex.source_version_id
       WHERE reindex.source_version_id = $1`,
      [sourceVersionId],
    )
    expect(Exit.isFailure(conflict)).toBe(true)
    expect(finalState).toMatchObject({
      status: 'completed',
      attempts: claimed.value.attempts,
      content: 'The launch date is July 18.',
    })
  })
})
