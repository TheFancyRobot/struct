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

async function cleanup(sql: postgresTypes.Sql): Promise<void> {
  await sql.unsafe(`DELETE FROM event_journal WHERE workspace_id = $1`, [workspaceId])
  await sql.unsafe(`DELETE FROM job_queue WHERE workspace_id = $1`, [workspaceId])
  await sql.unsafe(
    `DELETE FROM research_threads WHERE project_id = $1`,
    [projectId],
  )
  await sql.unsafe(`DELETE FROM source_versions WHERE source_id = $1`, [longLineSourceId])
  await sql.unsafe(`DELETE FROM source_versions WHERE source_id = $1`, [distantTermsSourceId])
  await sql.unsafe(`DELETE FROM source_versions WHERE source_id = $1`, [crossLineSourceId])
  await sql.unsafe(`DELETE FROM source_versions WHERE source_id = $1`, [sourceId])
  await sql.unsafe(`DELETE FROM sources WHERE id = $1`, [longLineSourceId])
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
    sql = postgres(DATABASE_URL, { max: 1, idle_timeout: 5 })
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
        appendEvent: (event) =>
          ResearchExecutionRepo.appendEvent(event).pipe(
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
    expect(start).toBeGreaterThan(1200)
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
})
