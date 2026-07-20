import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { Effect, Exit, Layer, Option } from 'effect'
import postgres from 'postgres'
import {
  EventJournalId,
  JobQueue,
  JobQueueId,
  ProjectId,
  ResearchCheckpointId,
  ResearchContractValidationError,
  ResearchPlanId,
  ResearchPlanNodeId,
  ResearchRunId,
  ResearchThreadId,
  SourceId,
  SourceVersionId,
  WorkspaceId,
  type ResearchExecutionCheckpoint,
  type ResearchPlan,
} from '@struct/domain'
import { SqlClientLive } from '../sql-client'
import { ResearchExecutionRepo } from './research-execution'

const DATABASE_URL = process.env['DATABASE_URL']
const describeIf = DATABASE_URL ? describe : describe.skip
const id = (suffix: string) => `c70e8400-e29b-41d4-a716-${suffix}`
const workspaceId = WorkspaceId.make(id('446655440001'))
const projectId = ProjectId.make(id('446655440002'))
const sourceId = SourceId.make(id('446655440003'))
const sourceVersionId = SourceVersionId.make(id('446655440004'))
const threadId = ResearchThreadId.make(id('446655440005'))
const runId = ResearchRunId.make(id('446655440006'))
const failureRunId = ResearchRunId.make(id('446655440007'))
const stalePlanningRunId = ResearchRunId.make(id('446655440012'))
const jobId = JobQueueId.make(id('446655440008'))
const failureJobId = JobQueueId.make(id('446655440009'))
const stalePlanningJobId = JobQueueId.make(id('446655440013'))
const planId = ResearchPlanId.make(id('446655440010'))
const nodeId = ResearchPlanNodeId.make(id('446655440011'))

const budget = {
  maximumSteps: 1,
  maximumModelCalls: 1,
  maximumToolCalls: 1,
  maximumTokens: 1_000,
  maximumElapsedMilliseconds: 60_000,
  maximumEstimatedCostMicros: 10_000,
  maximumFanOut: 1,
  maximumRevisions: 0,
} as const

const plan: ResearchPlan = {
  version: '1',
  id: planId,
  runId,
  workspaceId,
  projectId,
  objective: 'Read one immutable source.',
  sourceScopes: [{ kind: 'document', sourceVersionId }],
  nodes: [{
    id: nodeId,
    kind: 'document-retrieval',
    goal: 'Retrieve evidence.',
    dependencies: [],
    inputRefs: [{ kind: 'source-version', sourceVersionId }],
    evidenceRefs: [],
  }],
  evidenceRequirements: [],
  toolPolicy: {
    grants: [{
      toolId: 'hybrid-retrieval',
      capability: 'document:retrieve',
      maximumCalls: 1,
    }],
  },
  budget,
}

const checkpoint = (
  checkpointId: string,
  steps: number,
  limits: ResearchPlan['budget'] = budget,
): ResearchExecutionCheckpoint => ({
  version: '1',
  id: ResearchCheckpointId.make(checkpointId),
  state: {
    version: '1',
    runId,
    planId,
    status: 'running',
    currentNodeId: nodeId,
    completed: [],
    budget: {
      limits,
      used: {
        steps,
        modelCalls: 0,
        toolCalls: steps,
        tokens: 0,
        elapsedMilliseconds: steps,
        estimatedCostMicros: 0,
        revisions: 0,
      },
    },
    cancellation: 'none',
    duplicateActionCount: 0,
    noProgressCount: 0,
    fredCorrelation: 'fred-restart-test',
    lastEventSequence: steps,
  },
})

describeIf('research durability (PostgreSQL, serial)', () => {
  const sql = postgres(DATABASE_URL ?? '', { max: 1, idle_timeout: 5 })
  const layer = Layer.provide(ResearchExecutionRepo.Default, SqlClientLive(sql))
  const job: typeof JobQueue.Type = {
    id: jobId,
    workspaceId,
    entityType: 'research',
    entityId: runId,
    status: 'in-progress',
    payload: { projectId, sourceVersionIds: [sourceVersionId] },
    attempts: 1,
    maxAttempts: 3,
    createdAt: 1n,
    updatedAt: 1n,
  }
  const failureJob: typeof JobQueue.Type = {
    ...job,
    id: failureJobId,
    entityId: failureRunId,
  }

  beforeAll(async () => {
    await sql.unsafe(
      `INSERT INTO workspaces (id, name) VALUES ($1, 'Durability workspace')`,
      [workspaceId],
    )
    await sql.unsafe(
      `INSERT INTO projects (id, workspace_id, name)
       VALUES ($1, $2, 'Durability project')`,
      [projectId, workspaceId],
    )
    await sql.unsafe(
      `INSERT INTO sources (id, project_id, name, kind)
       VALUES ($1, $2, 'durable.txt', 'document')`,
      [sourceId, projectId],
    )
    await sql.unsafe(
      `INSERT INTO source_versions (
         id, source_id, version, artifact_ref, content_hash
       ) VALUES ($1, $2, 1, 'artifact://durable', $3)`,
      [sourceVersionId, sourceId, `sha256:${'a'.repeat(64)}`],
    )
    await sql.unsafe(
      `INSERT INTO research_threads (id, project_id, title)
       VALUES ($1, $2, 'Durability')`,
      [threadId, projectId],
    )
    await sql.unsafe(
      `INSERT INTO research_runs (id, thread_id, question, status)
       VALUES
         ($1, $3, 'Resume?', 'in-progress'),
         ($2, $3, 'Planning failure?', 'in-progress'),
         ($4, $3, 'Stale while planning?', 'in-progress')`,
      [runId, failureRunId, threadId, stalePlanningRunId],
    )
    await sql.unsafe(
      `INSERT INTO job_queue (
         id, workspace_id, entity_type, entity_id, status, payload, attempts,
         max_attempts
       ) VALUES
         ($1, $3, 'research', $4, 'in-progress', $6::jsonb, 1, 3),
         ($2, $3, 'research', $5, 'in-progress', $6::jsonb, 1, 3),
         ($7, $3, 'research', $8, 'in-progress', $6::jsonb, 1, 3)`,
      [
        jobId,
        failureJobId,
        workspaceId,
        runId,
        failureRunId,
        JSON.stringify({ projectId, sourceVersionIds: [sourceVersionId] }),
        stalePlanningJobId,
        stalePlanningRunId,
      ],
    )
    await sql.unsafe(
      `UPDATE job_queue
       SET updated_at = NOW() - INTERVAL '2 hours'
       WHERE id = $1`,
      [stalePlanningJobId],
    )
  })

  afterAll(async () => {
    await sql.unsafe(
      `DELETE FROM research_cancellation_requests
       WHERE run_id = ANY($1::uuid[])`,
      [[runId, failureRunId, stalePlanningRunId]],
    )
    await sql.unsafe('DELETE FROM event_journal WHERE workspace_id = $1', [workspaceId])
    await sql.unsafe('DELETE FROM job_queue WHERE workspace_id = $1', [workspaceId])
    await sql.unsafe('DELETE FROM research_runs WHERE thread_id = $1', [threadId])
    await sql.unsafe('DELETE FROM research_threads WHERE id = $1', [threadId])
    await sql.unsafe('DELETE FROM source_versions WHERE source_id = $1', [sourceId])
    await sql.unsafe('DELETE FROM sources WHERE id = $1', [sourceId])
    await sql.unsafe('DELETE FROM projects WHERE id = $1', [projectId])
    await sql.unsafe('DELETE FROM workspaces WHERE id = $1', [workspaceId])
    await sql.end()
  })

  it('reconstructs committed state, rejects budget rollback, and fences cancellation', async () => {
    await Effect.runPromise(ResearchExecutionRepo.persistPlan({
      workspaceId,
      projectId,
      job,
      plan,
      eventId: EventJournalId.make(id('446655440020')),
      createdAt: 10n,
    }).pipe(Effect.provide(layer)))
    await Effect.runPromise(ResearchExecutionRepo.persistCheckpoint({
      workspaceId,
      projectId,
      job,
      checkpoint: checkpoint(id('446655440021'), 1),
      eventId: EventJournalId.make(id('446655440022')),
      createdAt: 20n,
    }).pipe(Effect.provide(layer)))

    const reconstructed = await Effect.runPromise(
      ResearchExecutionRepo.loadDurableState(workspaceId, projectId, runId)
        .pipe(Effect.provide(layer)),
    )
    expect(Option.isSome(reconstructed)).toBe(true)
    if (Option.isSome(reconstructed)) {
      expect(Option.getOrUndefined(reconstructed.value.plan)?.id).toBe(planId)
      expect(
        Option.getOrUndefined(reconstructed.value.checkpoint)?.state.budget.used.steps,
      ).toBe(1)
      expect(reconstructed.value.lastEventCursor).toBeGreaterThan(0n)
    }

    const rollback = await Effect.runPromiseExit(
      ResearchExecutionRepo.persistCheckpoint({
        workspaceId,
        projectId,
        job,
        checkpoint: checkpoint(id('446655440023'), 0),
        eventId: EventJournalId.make(id('446655440024')),
        createdAt: 30n,
      }).pipe(Effect.provide(layer)),
    )
    expect(Exit.isFailure(rollback)).toBe(true)
    const expandedBudget = await Effect.runPromiseExit(
      ResearchExecutionRepo.persistCheckpoint({
        workspaceId,
        projectId,
        job,
        checkpoint: checkpoint(
          id('446655440027'),
          1,
          { ...budget, maximumToolCalls: 2 },
        ),
        eventId: EventJournalId.make(id('446655440028')),
        createdAt: 35n,
      }).pipe(Effect.provide(layer)),
    )
    expect(Exit.isFailure(expandedBudget)).toBe(true)

    const cancelled = await Effect.runPromise(
      ResearchExecutionRepo.requestCancellation({
        workspaceId,
        projectId,
        runId,
        idempotencyKey: 'cancel-once',
        eventId: EventJournalId.make(id('446655440025')),
        createdAt: 40n,
      }).pipe(Effect.provide(layer)),
    )
    const replay = await Effect.runPromise(
      ResearchExecutionRepo.requestCancellation({
        workspaceId,
        projectId,
        runId,
        idempotencyKey: 'cancel-once',
        eventId: EventJournalId.make(id('446655440026')),
        createdAt: 50n,
      }).pipe(Effect.provide(layer)),
    )
    expect(cancelled).toEqual({ result: 'cancelled', replayed: false })
    expect(replay).toEqual({ result: 'cancelled', replayed: true })
    const terminalEvents = await sql.unsafe(
      `SELECT event_type FROM event_journal
       WHERE entity_id = $1
         AND event_type IN (
           'research-completed', 'research-failed',
           'research-planning-failed', 'research-cancelled'
         )`,
      [runId],
    )
    expect(terminalEvents.map((row) => row['event_type']))
      .toEqual(['research-cancelled'])
  })

  it('persists a typed planning failure before executable state', async () => {
    await Effect.runPromise(ResearchExecutionRepo.persistPlanningFailure({
      workspaceId,
      projectId,
      job: failureJob,
      failure: new ResearchContractValidationError({
        contract: 'plan',
        reason: 'malformed',
        path: 'nodes',
        message: 'Plan validation failed',
      }),
      eventId: EventJournalId.make(id('446655440030')),
      createdAt: 60n,
    }).pipe(Effect.provide(layer)))
    const reconstructed = await Effect.runPromise(
      ResearchExecutionRepo.loadDurableState(
        workspaceId,
        projectId,
        failureRunId,
      ).pipe(Effect.provide(layer)),
    )
    expect(Option.isSome(reconstructed)).toBe(true)
    if (Option.isSome(reconstructed)) {
      expect(
        Option.getOrUndefined(reconstructed.value.planningFailure)?.reason,
      ).toBe('malformed')
      expect(Option.isNone(reconstructed.value.checkpoint)).toBe(true)
    }
  })

  it('turns a pre-plan stale worker into a reconstructable typed planning failure', async () => {
    const recovered = await Effect.runPromise(
      ResearchExecutionRepo.recoverStale(3_600_000).pipe(
        Effect.provide(layer),
      ),
    )
    expect(recovered.map((candidate) => candidate.id))
      .toContain(stalePlanningJobId)
    const reconstructed = await Effect.runPromise(
      ResearchExecutionRepo.loadDurableState(
        workspaceId,
        projectId,
        stalePlanningRunId,
      ).pipe(Effect.provide(layer)),
    )
    expect(Option.isSome(reconstructed)).toBe(true)
    if (Option.isSome(reconstructed)) {
      expect(
        Option.getOrUndefined(reconstructed.value.planningFailure)?.contract,
      ).toBe('plan')
      expect(Option.isNone(reconstructed.value.plan)).toBe(true)
      expect(Option.isNone(reconstructed.value.checkpoint)).toBe(true)
      expect(Option.getOrUndefined(reconstructed.value.terminalStatus))
        .toBe('failed')
    }
    const events = await sql.unsafe(
      `SELECT event_type FROM event_journal WHERE entity_id = $1`,
      [stalePlanningRunId],
    )
    expect(events.map((event) => event['event_type']))
      .toEqual(['research-failed'])
  })
})
