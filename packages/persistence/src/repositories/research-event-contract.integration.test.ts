import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { Effect, Exit, Layer } from 'effect'
import postgres from 'postgres'
import type postgresTypes from 'postgres'
import {
  EventJournalId,
  JobQueueId,
  ProjectId,
  ResearchRunId,
  ResearchThreadId,
  SourceId,
  SourceVersionId,
  ValidationError,
  WorkspaceId,
} from '@struct/domain'
import {
  JobQueueRepo,
  ResearchExecutionRepo,
  SqlClientLive,
} from '../index.js'

const DATABASE_URL = process.env['DATABASE_URL']
const describeIf = DATABASE_URL ? describe : describe.skip

const workspaceId = WorkspaceId.make('c60e8400-e29b-41d4-a716-446655440000')
const projectId = ProjectId.make('c60e8400-e29b-41d4-a716-446655440001')
const sourceId = SourceId.make('c60e8400-e29b-41d4-a716-446655440002')
const sourceVersionId = SourceVersionId.make('c60e8400-e29b-41d4-a716-446655440003')
const foreignSourceVersionId = SourceVersionId.make(
  'c60e8400-e29b-41d4-a716-446655440004',
)
const threadId = ResearchThreadId.make('c60e8400-e29b-41d4-a716-446655440005')
const appendRunId = ResearchRunId.make('c60e8400-e29b-41d4-a716-446655440006')
const completeRunId = ResearchRunId.make('c60e8400-e29b-41d4-a716-446655440007')
const failRunId = ResearchRunId.make('c60e8400-e29b-41d4-a716-446655440008')
const appendJobId = JobQueueId.make('c60e8400-e29b-41d4-a716-446655440009')
const completeJobId = JobQueueId.make('c60e8400-e29b-41d4-a716-44665544000a')
const failJobId = JobQueueId.make('c60e8400-e29b-41d4-a716-44665544000b')

describeIf('research event contracts (PostgreSQL, serial)', () => {
  let sql: postgresTypes.Sql
  let jobLayer: Layer.Layer<JobQueueRepo>
  let researchLayer: Layer.Layer<ResearchExecutionRepo>

  beforeAll(async () => {
    if (!DATABASE_URL) return
    sql = postgres(DATABASE_URL, { max: 1, idle_timeout: 5 })
    const sqlLayer = SqlClientLive(sql)
    jobLayer = Layer.provide(JobQueueRepo.Default, sqlLayer)
    researchLayer = Layer.provide(ResearchExecutionRepo.Default, sqlLayer)
    await sql.unsafe(
      `INSERT INTO workspaces (id, name)
       VALUES ($1, 'Research event contract workspace')`,
      [workspaceId],
    )
    await sql.unsafe(
      `INSERT INTO projects (id, workspace_id, name)
       VALUES ($1, $2, 'Research event contract project')`,
      [projectId, workspaceId],
    )
    await sql.unsafe(
      `INSERT INTO sources (id, project_id, name, kind)
       VALUES ($1, $2, 'contract.txt', 'document')`,
      [sourceId, projectId],
    )
    await sql.unsafe(
      `INSERT INTO source_versions (id, source_id, version, artifact_ref, content_hash)
       VALUES ($1, $2, 1, 'artifact://research-event-contract', 'sha256:research-event-contract')`,
      [sourceVersionId, sourceId],
    )
    await sql.unsafe(
      `INSERT INTO research_threads (id, project_id, title)
       VALUES ($1, $2, 'Research event contract')`,
      [threadId, projectId],
    )
    await sql.unsafe(
      `INSERT INTO research_runs (id, thread_id, question, status)
       VALUES
         ($1, $4, 'Append contract?', 'in-progress'),
         ($2, $4, 'Completion contract?', 'in-progress'),
         ($3, $4, 'Failure contract?', 'in-progress')`,
      [appendRunId, completeRunId, failRunId, threadId],
    )
    await sql.unsafe(
      `INSERT INTO job_queue (
         id, workspace_id, entity_type, entity_id, status, payload,
         attempts, max_attempts
       )
       VALUES
         ($1, $4, 'research', $5, 'in-progress',
          jsonb_build_object('projectId', $7::text, 'sourceVersionIds', jsonb_build_array($8::text)),
          1, 1),
         ($2, $4, 'research', $6, 'in-progress',
          jsonb_build_object('projectId', $7::text, 'sourceVersionIds', jsonb_build_array($8::text)),
          1, 1),
         ($3, $4, 'research', $9, 'in-progress',
          jsonb_build_object('projectId', $7::text, 'sourceVersionIds', jsonb_build_array($8::text)),
          1, 1)`,
      [
        appendJobId,
        completeJobId,
        failJobId,
        workspaceId,
        appendRunId,
        completeRunId,
        projectId,
        sourceVersionId,
        failRunId,
      ],
    )
  })

  afterAll(async () => {
    if (!sql) return
    await sql.unsafe(`DELETE FROM event_journal WHERE workspace_id = $1`, [workspaceId])
    await sql.unsafe(`DELETE FROM job_queue WHERE workspace_id = $1`, [workspaceId])
    await sql.unsafe(
      `DELETE FROM research_run_results
       WHERE run_id = ANY($1::uuid[])`,
      [[appendRunId, completeRunId, failRunId]],
    )
    await sql.unsafe(`DELETE FROM research_runs WHERE thread_id = $1`, [threadId])
    await sql.unsafe(`DELETE FROM research_threads WHERE id = $1`, [threadId])
    await sql.unsafe(`DELETE FROM source_versions WHERE source_id = $1`, [sourceId])
    await sql.unsafe(`DELETE FROM sources WHERE id = $1`, [sourceId])
    await sql.unsafe(`DELETE FROM projects WHERE id = $1`, [projectId])
    await sql.unsafe(`DELETE FROM workspaces WHERE id = $1`, [workspaceId])
    await sql.end()
  })

  const event = (
    id: string,
    runId: typeof appendRunId,
    eventType: string,
    payload: Record<string, unknown>,
    cursor = 0n,
  ) => ({
    id: EventJournalId.make(id),
    workspaceId,
    entityType: 'research' as const,
    entityId: runId,
    eventType,
    payload,
    cursor,
    createdAt: BigInt(Date.now()),
  })

  it('rejects forged append, complete, and fail contracts atomically and accepts valid controls', async () => {
    const appendJob = await Effect.runPromise(
      JobQueueRepo.findById(appendJobId).pipe(Effect.provide(jobLayer)),
    )
    const completeJob = await Effect.runPromise(
      JobQueueRepo.findById(completeJobId).pipe(Effect.provide(jobLayer)),
    )
    const failJob = await Effect.runPromise(
      JobQueueRepo.findById(failJobId).pipe(Effect.provide(jobLayer)),
    )

    const forgedAppendEvents = [
      event(
        'c60e8400-e29b-41d4-a716-446655440010',
        appendRunId,
        'ingestion-completed',
        {},
      ),
      event(
        'c60e8400-e29b-41d4-a716-446655440011',
        appendRunId,
        'retrieval-completed',
        { evidenceCount: 1, sourceVersionIds: [foreignSourceVersionId] },
      ),
      event(
        'c60e8400-e29b-41d4-a716-446655440012',
        appendRunId,
        'retrieval-completed',
        { evidenceCount: 1, sourceVersionIds: [] },
      ),
      event(
        'c60e8400-e29b-41d4-a716-446655440013',
        appendRunId,
        'citations-validated',
        { citationCount: 0, arbitrary: true },
      ),
      event(
        'c60e8400-e29b-41d4-a716-446655440014',
        appendRunId,
        'citations-validated',
        { citationCount: 0 },
        1n,
      ),
    ]
    for (const forgedEvent of forgedAppendEvents) {
      const exit = await Effect.runPromiseExit(
        ResearchExecutionRepo.appendInProgressEvent(
          appendJob,
          forgedEvent,
        ).pipe(Effect.provide(researchLayer)),
      )
      expect(Exit.isFailure(exit)).toBe(true)
      if (Exit.isFailure(exit)) {
        expect(String(exit.cause)).toContain(ValidationError.name)
      }
    }

    await sql.unsafe(
      `INSERT INTO event_journal (
         id, workspace_id, entity_type, entity_id, event_type, payload
       )
       VALUES (
         $1, $2, 'research', $3, 'citations-validated',
         jsonb_build_object(
           'jobId', $4::text,
           'attempt', 0,
           'citationCount', 0
         )
       )`,
      [
        'c60e8400-e29b-41d4-a716-446655440023',
        workspaceId,
        completeRunId,
        completeJobId,
      ],
    )
    const priorAttemptExit = await Effect.runPromiseExit(
      ResearchExecutionRepo.complete({
        runId: completeRunId,
        job: completeJob,
        answer: { answer: 'Must not accept prior attempt validation', citations: [] },
        citations: [],
        event: event(
          'c60e8400-e29b-41d4-a716-446655440024',
          completeRunId,
          'research-completed',
          { citationCount: 0 },
        ),
      }).pipe(Effect.provide(researchLayer)),
    )
    expect(Exit.isFailure(priorAttemptExit)).toBe(true)
    if (Exit.isFailure(priorAttemptExit)) {
      expect(String(priorAttemptExit.cause)).toContain(ValidationError.name)
    }

    await Effect.runPromise(
      ResearchExecutionRepo.appendInProgressEvent(
        appendJob,
        event(
          'c60e8400-e29b-41d4-a716-446655440015',
          appendRunId,
          'retrieval-completed',
          { evidenceCount: 1, sourceVersionIds: [sourceVersionId] },
        ),
      ).pipe(Effect.provide(researchLayer)),
    )
    await Effect.runPromise(
      ResearchExecutionRepo.appendInProgressEvent(
        appendJob,
        event(
          'c60e8400-e29b-41d4-a716-446655440016',
          appendRunId,
          'citations-validated',
          { citationCount: 0 },
        ),
      ).pipe(Effect.provide(researchLayer)),
    )
    await Effect.runPromise(
      ResearchExecutionRepo.appendInProgressEvent(
        completeJob,
        event(
          'c60e8400-e29b-41d4-a716-446655440017',
          completeRunId,
          'citations-validated',
          { citationCount: 0 },
        ),
      ).pipe(Effect.provide(researchLayer)),
    )

    const forgedCompletionEvents = [
      event(
        'c60e8400-e29b-41d4-a716-446655440018',
        completeRunId,
        'research-failed',
        { errorTag: 'ResearchWorkflowError', message: 'Research failed' },
      ),
      event(
        'c60e8400-e29b-41d4-a716-446655440019',
        completeRunId,
        'research-completed',
        { citationCount: 1 },
      ),
      event(
        'c60e8400-e29b-41d4-a716-44665544001a',
        completeRunId,
        'research-completed',
        { citationCount: 0, extra: true },
      ),
      event(
        'c60e8400-e29b-41d4-a716-44665544001b',
        completeRunId,
        'research-completed',
        { citationCount: 0 },
        1n,
      ),
    ]
    for (const forgedEvent of forgedCompletionEvents) {
      const exit = await Effect.runPromiseExit(
        ResearchExecutionRepo.complete({
          runId: completeRunId,
          job: completeJob,
          answer: { answer: 'Must not persist', citations: [] },
          citations: [],
          event: forgedEvent,
        }).pipe(Effect.provide(researchLayer)),
      )
      expect(Exit.isFailure(exit)).toBe(true)
      if (Exit.isFailure(exit)) {
        expect(String(exit.cause)).toContain(ValidationError.name)
      }
    }

    const forgedFailureEvents = [
      event(
        'c60e8400-e29b-41d4-a716-44665544001c',
        failRunId,
        'research-completed',
        { citationCount: 0 },
      ),
      event(
        'c60e8400-e29b-41d4-a716-44665544001d',
        failRunId,
        'research-failed',
        { errorTag: 'Unsafe tag!', message: 'Research failed' },
      ),
      event(
        'c60e8400-e29b-41d4-a716-44665544001e',
        failRunId,
        'research-failed',
        { errorTag: 'ResearchWorkflowError', message: 'secret detail' },
      ),
      event(
        'c60e8400-e29b-41d4-a716-44665544001f',
        failRunId,
        'research-failed',
        { errorTag: 'ResearchWorkflowError', message: 'Research failed', extra: true },
      ),
      event(
        'c60e8400-e29b-41d4-a716-446655440020',
        failRunId,
        'research-failed',
        { errorTag: 'ResearchWorkflowError', message: 'Research failed' },
        1n,
      ),
    ]
    for (const forgedEvent of forgedFailureEvents) {
      const exit = await Effect.runPromiseExit(
        ResearchExecutionRepo.fail({
          runId: failRunId,
          job: failJob,
          event: forgedEvent,
        }).pipe(Effect.provide(researchLayer)),
      )
      expect(Exit.isFailure(exit)).toBe(true)
      if (Exit.isFailure(exit)) {
        expect(String(exit.cause)).toContain(ValidationError.name)
      }
    }

    const terminalBefore = await sql.unsafe(
      `SELECT id, status
       FROM job_queue
       WHERE id = ANY($1::uuid[])
       ORDER BY id`,
      [[completeJobId, failJobId]],
    )
    expect(terminalBefore.every((row) => row['status'] === 'in-progress')).toBe(true)
    const forgedIds = [
      ...forgedAppendEvents,
      ...forgedCompletionEvents,
      ...forgedFailureEvents,
    ].map((forgedEvent) => forgedEvent.id)
    const forgedRows = await sql.unsafe(
      `SELECT id FROM event_journal WHERE id = ANY($1::uuid[])`,
      [forgedIds],
    )
    expect(forgedRows).toHaveLength(0)

    await Effect.runPromise(
      ResearchExecutionRepo.complete({
        runId: completeRunId,
        job: completeJob,
        answer: { answer: 'Valid completion', citations: [] },
        citations: [],
        event: event(
          'c60e8400-e29b-41d4-a716-446655440021',
          completeRunId,
          'research-completed',
          { citationCount: 0 },
        ),
      }).pipe(Effect.provide(researchLayer)),
    )
    await Effect.runPromise(
      ResearchExecutionRepo.fail({
        runId: failRunId,
        job: failJob,
        event: event(
          'c60e8400-e29b-41d4-a716-446655440022',
          failRunId,
          'research-failed',
          { errorTag: 'ResearchWorkflowError', message: 'Research failed' },
        ),
      }).pipe(Effect.provide(researchLayer)),
    )

    const terminalAfter = await sql.unsafe(
      `SELECT id, status
       FROM job_queue
       WHERE id = ANY($1::uuid[])
       ORDER BY id`,
      [[completeJobId, failJobId]],
    )
    expect(terminalAfter.map((row) => row['status']).sort()).toEqual([
      'completed',
      'failed',
    ])
    const validRows = await sql.unsafe(
      `SELECT event_type, payload
       FROM event_journal
       WHERE id = ANY($1::uuid[])
       ORDER BY id`,
      [[
        'c60e8400-e29b-41d4-a716-446655440015',
        'c60e8400-e29b-41d4-a716-446655440016',
        'c60e8400-e29b-41d4-a716-446655440017',
        'c60e8400-e29b-41d4-a716-446655440021',
        'c60e8400-e29b-41d4-a716-446655440022',
      ]],
    )
    expect(validRows).toHaveLength(5)
    expect(validRows.map((row) => row['event_type']).sort()).toEqual([
      'citations-validated',
      'citations-validated',
      'research-completed',
      'research-failed',
      'retrieval-completed',
    ])
  })
})
