import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Effect, Layer } from 'effect'
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

async function cleanup(sql: postgresTypes.Sql): Promise<void> {
  await sql.unsafe(`DELETE FROM event_journal WHERE workspace_id = $1`, [workspaceId])
  await sql.unsafe(`DELETE FROM job_queue WHERE workspace_id = $1`, [workspaceId])
  await sql.unsafe(
    `DELETE FROM research_threads WHERE project_id = $1`,
    [projectId],
  )
  await sql.unsafe(`DELETE FROM source_versions WHERE source_id = $1`, [sourceId])
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
      `INSERT INTO source_text_index (source_version_id, workspace_id, project_id, content)
       VALUES ($1, $2, $3, 'The launch date is July 18.')`,
      [sourceVersionId, workspaceId, projectId],
    )
  })

  afterAll(async () => {
    if (!sql) return
    await cleanup(sql)
    await sql.end()
  })

  async function execute(question: string, suffix: '1' | '2') {
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
        markInProgress: (id) =>
          ResearchExecutionRepo.markInProgress(id).pipe(
            Effect.provide(executionLayer),
          ),
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
        run: ({ run, workspaceId: scopeWorkspaceId, projectId: scopeProjectId, sourceVersionIds }) =>
          Effect.gen(function* () {
            const result = yield* TextRetrieval.searchText({
              workspaceId: scopeWorkspaceId,
              projectId: scopeProjectId,
              sourceVersionIds: [...sourceVersionIds],
              query: run.question,
              limit: 5,
            }).pipe(Effect.provide(retrievalLayer))
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
      'research-failed',
    ])
    expect(JSON.stringify(events)).not.toContain('The launch date is July 18.')
  })
})
