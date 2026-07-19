import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { Effect, Exit, Layer } from 'effect'
import postgres from 'postgres'
import type postgresTypes from 'postgres'
import {
  CitationId,
  EventJournalId,
  JobQueue,
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
  IngestionJobOwnershipLostError,
  JobQueueRepo,
  QueryError,
  ResearchExecutionRepo,
  ResearchJobOwnershipLostError,
  SourceVersionRepo,
  SqlClientLive,
} from '../index.js'

const DATABASE_URL = process.env['DATABASE_URL']
const describeIf = DATABASE_URL ? describe : describe.skip
const workspaceId = WorkspaceId.make('b60e8400-e29b-41d4-a716-446655440000')
const foreignWorkspaceId = WorkspaceId.make('b60e8400-e29b-41d4-a716-446655440001')
const projectId = ProjectId.make('b60e8400-e29b-41d4-a716-446655440002')
const sourceId = SourceId.make('b60e8400-e29b-41d4-a716-446655440003')
const eventJobId = JobQueueId.make('b60e8400-e29b-41d4-a716-446655440004')
const versionJobId = JobQueueId.make('b60e8400-e29b-41d4-a716-446655440005')
const researchJobId = JobQueueId.make('b60e8400-e29b-41d4-a716-446655440006')
const runId = ResearchRunId.make('b60e8400-e29b-41d4-a716-446655440007')
const leaseJobId = JobQueueId.make('b60e8400-e29b-41d4-a716-44665544000e')
const threadId = ResearchThreadId.make('b60e8400-e29b-41d4-a716-446655440020')
const completeJobId = JobQueueId.make('b60e8400-e29b-41d4-a716-446655440021')
const completeRunId = ResearchRunId.make('b60e8400-e29b-41d4-a716-446655440022')
const failJobId = JobQueueId.make('b60e8400-e29b-41d4-a716-446655440023')
const failRunId = ResearchRunId.make('b60e8400-e29b-41d4-a716-446655440024')
const authorizedSourceVersionId = SourceVersionId.make('b60e8400-e29b-41d4-a716-446655440030')
const foreignProjectId = ProjectId.make('b60e8400-e29b-41d4-a716-446655440031')
const foreignSourceId = SourceId.make('b60e8400-e29b-41d4-a716-446655440032')
const foreignSourceVersionId = SourceVersionId.make('b60e8400-e29b-41d4-a716-446655440033')
const scopeJobId = JobQueueId.make('b60e8400-e29b-41d4-a716-446655440034')
const scopeRunId = ResearchRunId.make('b60e8400-e29b-41d4-a716-446655440035')
const duplicateJobId = JobQueueId.make('b60e8400-e29b-41d4-a716-446655440036')
const duplicateRunId = ResearchRunId.make('b60e8400-e29b-41d4-a716-446655440037')
const resultConflictJobId = JobQueueId.make('b60e8400-e29b-41d4-a716-446655440038')
const resultConflictRunId = ResearchRunId.make('b60e8400-e29b-41d4-a716-446655440039')
const citationConflictJobId = JobQueueId.make('b60e8400-e29b-41d4-a716-44665544003a')
const citationConflictRunId = ResearchRunId.make('b60e8400-e29b-41d4-a716-44665544003b')
const citationOwnerJobId = JobQueueId.make('b60e8400-e29b-41d4-a716-44665544003c')
const citationOwnerRunId = ResearchRunId.make('b60e8400-e29b-41d4-a716-44665544003d')
const conflictingCitationId = CitationId.make('b60e8400-e29b-41d4-a716-44665544003e')
const duplicateCitationId = CitationId.make('b60e8400-e29b-41d4-a716-44665544003f')
const serializedPayloadJobId = JobQueueId.make('b60e8400-e29b-41d4-a716-446655440046')
const serializedPayloadRunId = ResearchRunId.make('b60e8400-e29b-41d4-a716-446655440047')
const serializedPayloadCitationId = CitationId.make('b60e8400-e29b-41d4-a716-446655440048')
const serializedPayloadEventId = EventJournalId.make('b60e8400-e29b-41d4-a716-446655440049')
const ingestionAppendJobId = JobQueueId.make('b60e8400-e29b-41d4-a716-446655440030')
const ingestionCompleteJobId = JobQueueId.make('b60e8400-e29b-41d4-a716-446655440031')
const ingestionPendingJobId = JobQueueId.make('b60e8400-e29b-41d4-a716-446655440032')
const ingestionFailJobId = JobQueueId.make('b60e8400-e29b-41d4-a716-446655440033')
const forgedWorkspaceVersionId = SourceVersionId.make('b60e8400-e29b-41d4-a716-446655440040')
const forgedEntityVersionId = SourceVersionId.make('b60e8400-e29b-41d4-a716-446655440041')
const ingestionManifestRef =
  'artifact://sha256/cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc'
const ingestionContentHash =
  'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'

describeIf('attempt and workspace ownership persistence (PostgreSQL)', () => {
  let sql: postgresTypes.Sql
  let jobLayer: Layer.Layer<JobQueueRepo>
  let versionLayer: Layer.Layer<SourceVersionRepo>
  let researchLayer: Layer.Layer<ResearchExecutionRepo>

  beforeAll(async () => {
    if (!DATABASE_URL) return
    sql = postgres(DATABASE_URL, { max: 2, idle_timeout: 5 })
    const sqlLayer = SqlClientLive(sql)
    jobLayer = Layer.provide(JobQueueRepo.Default, sqlLayer)
    versionLayer = Layer.provide(SourceVersionRepo.Default, sqlLayer)
    researchLayer = Layer.provide(ResearchExecutionRepo.Default, sqlLayer)
    await sql.unsafe(
      `INSERT INTO workspaces (id, name)
       VALUES ($1, 'Ownership Workspace'), ($2, 'Foreign Workspace')`,
      [workspaceId, foreignWorkspaceId],
    )
    await sql.unsafe(
      `INSERT INTO projects (id, workspace_id, name)
       VALUES
         ($1, $2, 'Ownership Project'),
         ($3, $4, 'Foreign Project')`,
      [projectId, workspaceId, foreignProjectId, foreignWorkspaceId],
    )
    await sql.unsafe(
      `INSERT INTO sources (id, project_id, name, kind)
       VALUES
         ($1, $2, 'ownership.txt', 'document'),
         ($3, $4, 'foreign.txt', 'document')`,
      [sourceId, projectId, foreignSourceId, foreignProjectId],
    )
    await sql.unsafe(
      `INSERT INTO source_versions (id, source_id, version, artifact_ref, content_hash)
       VALUES
         ($1, $2, 100, $5, $6),
         ($3, $4, 100, 'artifact://ownership-foreign', 'sha256:ownership-foreign')`,
      [
        authorizedSourceVersionId,
        sourceId,
        foreignSourceVersionId,
        foreignSourceId,
        ingestionManifestRef,
        ingestionContentHash,
      ],
    )
    await sql.unsafe(
      `INSERT INTO research_threads (id, project_id, title)
       VALUES ($1, $2, 'Ownership research')`,
      [threadId, projectId],
    )
    await sql.unsafe(
      `INSERT INTO research_runs (id, thread_id, question, status)
       VALUES
         ($1, $4, 'Append ownership?', 'in-progress'),
         ($2, $4, 'Complete ownership?', 'in-progress'),
         ($3, $4, 'Failure ownership?', 'in-progress'),
         ($5, $4, 'Scope authorization?', 'in-progress'),
         ($6, $4, 'Duplicate citations?', 'in-progress'),
         ($7, $4, 'Result conflict?', 'in-progress'),
         ($8, $4, 'Citation conflict?', 'in-progress'),
         ($9, $4, 'Citation owner?', 'completed')`,
      [
        runId,
        completeRunId,
        failRunId,
        threadId,
        scopeRunId,
        duplicateRunId,
        resultConflictRunId,
        citationConflictRunId,
        citationOwnerRunId,
      ],
    )
    await sql.unsafe(
      `INSERT INTO job_queue (
         id, workspace_id, entity_type, entity_id, status, payload,
         attempts, max_attempts, created_at, updated_at
       )
       VALUES
         ($1, $4, 'ingestion', $5, 'in-progress', '{"byteLength":12}'::jsonb, 1, 3, NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour'),
         ($2, $4, 'ingestion', $5, 'in-progress', '{"byteLength":12}'::jsonb, 1, 3, NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour'),
         ($3, $4, 'research', $6, 'in-progress', '{}'::jsonb, 1, 1, NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour'),
         ($7, $4, 'ingestion', $5, 'in-progress', '{"byteLength":12}'::jsonb, 1, 3, NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour'),
         ($8, $4, 'research', $9, 'in-progress', '{}'::jsonb, 1, 1, NOW(), NOW()),
         ($10, $4, 'research', $11, 'in-progress', '{}'::jsonb, 1, 1, NOW(), NOW()),
         ($12, $4, 'research', $13, 'in-progress', '{}'::jsonb, 1, 1, NOW(), NOW()),
         ($14, $4, 'research', $15, 'in-progress', '{}'::jsonb, 1, 1, NOW(), NOW()),
         ($16, $4, 'research', $17, 'in-progress', '{}'::jsonb, 1, 1, NOW(), NOW()),
         ($18, $4, 'research', $19, 'in-progress', '{}'::jsonb, 1, 1, NOW(), NOW()),
         ($20, $4, 'research', $21, 'completed', '{}'::jsonb, 1, 1, NOW(), NOW())`,
      [
        eventJobId,
        versionJobId,
        researchJobId,
        workspaceId,
        sourceId,
        runId,
        leaseJobId,
        completeJobId,
        completeRunId,
        failJobId,
        failRunId,
        scopeJobId,
        scopeRunId,
        duplicateJobId,
        duplicateRunId,
        resultConflictJobId,
        resultConflictRunId,
        citationConflictJobId,
        citationConflictRunId,
        citationOwnerJobId,
        citationOwnerRunId,
      ],
    )
    await sql.unsafe(
      `UPDATE job_queue
       SET payload = jsonb_build_object(
         'projectId', $1::text,
         'sourceVersionIds', jsonb_build_array($2::text)
       )
       WHERE id = ANY($3::uuid[])`,
      [
        projectId,
        authorizedSourceVersionId,
        [
          researchJobId,
          completeJobId,
          failJobId,
          duplicateJobId,
          resultConflictJobId,
          citationConflictJobId,
          citationOwnerJobId,
        ],
      ],
    )
    await sql.unsafe(
      `UPDATE job_queue
       SET payload = jsonb_build_object(
         'projectId', $1::text,
         'sourceVersionIds', jsonb_build_array($2::text)
       )
       WHERE id = $3`,
      [projectId, foreignSourceVersionId, scopeJobId],
    )
    await sql.unsafe(
      `INSERT INTO research_run_results (run_id, answer, citations)
       VALUES ($1, 'Preexisting result', '[]'::jsonb)`,
      [resultConflictRunId],
    )
    await sql.unsafe(
      `INSERT INTO citations (id, run_id, source_version_id, locator, status)
       VALUES ($1, $2, $3, 'lines:1-1', 'validated')`,
      [conflictingCitationId, citationOwnerRunId, authorizedSourceVersionId],
    )
    await sql.unsafe(
      `INSERT INTO job_queue (
         id, workspace_id, entity_type, entity_id, status, payload,
         attempts, max_attempts, created_at, updated_at
       )
       SELECT transition_id, $2, 'ingestion', $3, 'in-progress',
              '{"byteLength":12}'::jsonb,
              CASE WHEN transition_id = $4 THEN 3 ELSE 1 END,
              3, NOW(), NOW()
       FROM unnest($1::uuid[]) AS transitions(transition_id)`,
      [
        [
          ingestionAppendJobId,
          ingestionCompleteJobId,
          ingestionPendingJobId,
          ingestionFailJobId,
        ],
        workspaceId,
        sourceId,
        ingestionFailJobId,
      ],
    )
  })

  afterAll(async () => {
    if (!sql) return
    await sql.unsafe(
      `DELETE FROM event_journal WHERE workspace_id = ANY($1::uuid[])`,
      [[workspaceId, foreignWorkspaceId]],
    )
    await sql.unsafe(
      `DELETE FROM job_queue WHERE workspace_id = ANY($1::uuid[])`,
      [[workspaceId, foreignWorkspaceId]],
    )
    await sql.unsafe(
      `DELETE FROM research_run_results WHERE run_id = ANY($1::uuid[])`,
      [[
        runId,
        completeRunId,
        failRunId,
        scopeRunId,
        duplicateRunId,
        resultConflictRunId,
        citationConflictRunId,
        citationOwnerRunId,
      ]],
    )
    await sql.unsafe(`DELETE FROM research_runs WHERE thread_id = $1`, [threadId])
    await sql.unsafe(`DELETE FROM research_threads WHERE id = $1`, [threadId])
    await sql.unsafe(
      `DELETE FROM source_versions WHERE source_id = ANY($1::uuid[])`,
      [[sourceId, foreignSourceId]],
    )
    await sql.unsafe(
      `DELETE FROM sources WHERE id = ANY($1::uuid[])`,
      [[sourceId, foreignSourceId]],
    )
    await sql.unsafe(
      `DELETE FROM projects WHERE id = ANY($1::uuid[])`,
      [[projectId, foreignProjectId]],
    )
    await sql.unsafe(
      `DELETE FROM workspaces WHERE id = ANY($1::uuid[])`,
      [[workspaceId, foreignWorkspaceId]],
    )
    await sql.end()
  })

  it('renews the current exact ingestion lease and rejects a stale attempt', async () => {
    const job = await Effect.runPromise(
      JobQueueRepo.findById(leaseJobId).pipe(Effect.provide(jobLayer)),
    )
    await Effect.runPromise(
      JobQueueRepo.renewLease(job).pipe(Effect.provide(jobLayer)),
    )
    const [renewed] = await sql.unsafe(
      `SELECT updated_at > NOW() - INTERVAL '5 seconds' AS fresh
       FROM job_queue WHERE id = $1`,
      [leaseJobId],
    )
    expect(renewed?.['fresh']).toBe(true)

    await sql.unsafe(
      `UPDATE job_queue
       SET attempts = attempts + 1, updated_at = NOW() - INTERVAL '1 hour'
       WHERE id = $1`,
      [leaseJobId],
    )
    const stale = await Effect.runPromiseExit(
      JobQueueRepo.renewLease(job).pipe(Effect.provide(jobLayer)),
    )
    expect(Exit.isFailure(stale)).toBe(true)
    if (Exit.isFailure(stale)) {
      expect(String(stale.cause)).toContain(IngestionJobOwnershipLostError.name)
    }
    const [notRenewed] = await sql.unsafe(
      `SELECT updated_at < NOW() - INTERVAL '59 minutes' AS still_stale
       FROM job_queue WHERE id = $1`,
      [leaseJobId],
    )
    expect(notRenewed?.['still_stale']).toBe(true)
  })

  it('renews an in-progress event lease and rejects stale attempts without heartbeat', async () => {
    const job = await Effect.runPromise(
      JobQueueRepo.findById(eventJobId).pipe(Effect.provide(jobLayer)),
    )
    await Effect.runPromise(
      JobQueueRepo.appendInProgressEvent(job, {
        id: EventJournalId.make('b60e8400-e29b-41d4-a716-446655440008'),
        workspaceId,
        entityType: 'ingestion',
        entityId: sourceId,
        eventType: 'file-processed',
        payload: {
          jobId: eventJobId,
          attempt: 1,
          sourceVersionId: authorizedSourceVersionId,
          manifestRef: ingestionManifestRef,
          contentHash: ingestionContentHash,
          byteLength: 12,
        },
        cursor: 0n,
        createdAt: BigInt(Date.now()),
      }).pipe(Effect.provide(jobLayer)),
    )
    const [renewed] = await sql.unsafe(
      `SELECT updated_at > NOW() - INTERVAL '5 seconds' AS fresh
       FROM job_queue WHERE id = $1`,
      [eventJobId],
    )
    expect(renewed?.['fresh']).toBe(true)

    await sql.unsafe(
      `UPDATE job_queue
       SET attempts = 2, updated_at = NOW() - INTERVAL '1 hour'
       WHERE id = $1`,
      [eventJobId],
    )
    const stale = await Effect.runPromiseExit(
      JobQueueRepo.appendInProgressEvent(job, {
        id: EventJournalId.make('b60e8400-e29b-41d4-a716-446655440009'),
        workspaceId,
        entityType: 'ingestion',
        entityId: sourceId,
        eventType: 'file-processed',
        payload: {
          jobId: eventJobId,
          attempt: 1,
          sourceVersionId: authorizedSourceVersionId,
          manifestRef: ingestionManifestRef,
          contentHash: ingestionContentHash,
          byteLength: 12,
        },
        cursor: 0n,
        createdAt: BigInt(Date.now()),
      }).pipe(Effect.provide(jobLayer)),
    )
    expect(Exit.isFailure(stale)).toBe(true)
    if (Exit.isFailure(stale)) {
      expect(String(stale.cause)).toContain(IngestionJobOwnershipLostError.name)
    }
    const [notRenewed] = await sql.unsafe(
      `SELECT updated_at < NOW() - INTERVAL '59 minutes' AS still_stale
       FROM job_queue WHERE id = $1`,
      [eventJobId],
    )
    expect(notRenewed?.['still_stale']).toBe(true)
    const staleEvent = await sql.unsafe(
      `SELECT id FROM event_journal WHERE id = $1`,
      ['b60e8400-e29b-41d4-a716-446655440009'],
    )
    expect(staleEvent).toHaveLength(0)
  })

  it('renews source-version creation and rejects stale attempts without heartbeat', async () => {
    const job = await Effect.runPromise(
      JobQueueRepo.findById(versionJobId).pipe(Effect.provide(jobLayer)),
    )
    const [beforeForgedWorkspace] = await sql.unsafe(
      `SELECT updated_at FROM job_queue WHERE id = $1`,
      [versionJobId],
    )
    const forgedWorkspace = await Effect.runPromiseExit(
      SourceVersionRepo.createForIngestionAttempt(
        { ...job!, workspaceId: foreignWorkspaceId },
        {
          id: forgedWorkspaceVersionId,
          sourceId,
          version: 1,
          artifactRef: 'artifact://sha256/forged-workspace-real',
          contentHash: 'sha256:forged-workspace-real',
          createdAt: BigInt(Date.now()),
        },
      ).pipe(Effect.provide(versionLayer)),
    )
    expect(Exit.isFailure(forgedWorkspace)).toBe(true)
    if (Exit.isFailure(forgedWorkspace)) {
      expect(String(forgedWorkspace.cause)).toContain(IngestionJobOwnershipLostError.name)
    }
    const [afterForgedWorkspace] = await sql.unsafe(
      `SELECT updated_at FROM job_queue WHERE id = $1`,
      [versionJobId],
    )
    expect(afterForgedWorkspace?.['updated_at']).toEqual(beforeForgedWorkspace?.['updated_at'])
    expect(await sql.unsafe(
      `SELECT id FROM source_versions WHERE id = $1`,
      [forgedWorkspaceVersionId],
    )).toHaveLength(0)

    const forgedEntity = await Effect.runPromiseExit(
      SourceVersionRepo.createForIngestionAttempt(
        { ...job!, entityId: foreignSourceId },
        {
          id: forgedEntityVersionId,
          sourceId,
          version: 1,
          artifactRef: 'artifact://sha256/forged-entity-real',
          contentHash: 'sha256:forged-entity-real',
          createdAt: BigInt(Date.now()),
        },
      ).pipe(Effect.provide(versionLayer)),
    )
    expect(Exit.isFailure(forgedEntity)).toBe(true)
    if (Exit.isFailure(forgedEntity)) {
      expect(String(forgedEntity.cause)).toContain(IngestionJobOwnershipLostError.name)
    }
    expect(await sql.unsafe(
      `SELECT id FROM source_versions WHERE id = $1`,
      [forgedEntityVersionId],
    )).toHaveLength(0)

    await Effect.runPromise(
      SourceVersionRepo.createForIngestionAttempt(job, {
        id: SourceVersionId.make('b60e8400-e29b-41d4-a716-44665544000a'),
        sourceId,
        version: 1,
        artifactRef: 'artifact://sha256/ownership-real',
        contentHash: 'sha256:ownership-real',
        createdAt: BigInt(Date.now()),
      }).pipe(Effect.provide(versionLayer)),
    )
    const [renewed] = await sql.unsafe(
      `SELECT updated_at > NOW() - INTERVAL '5 seconds' AS fresh
       FROM job_queue WHERE id = $1`,
      [versionJobId],
    )
    expect(renewed?.['fresh']).toBe(true)

    await sql.unsafe(
      `UPDATE job_queue
       SET attempts = 2, updated_at = NOW() - INTERVAL '1 hour'
       WHERE id = $1`,
      [versionJobId],
    )
    const stale = await Effect.runPromiseExit(
      SourceVersionRepo.createForIngestionAttempt(job, {
        id: SourceVersionId.make('b60e8400-e29b-41d4-a716-44665544000b'),
        sourceId,
        version: 2,
        artifactRef: 'artifact://sha256/stale-real',
        contentHash: 'sha256:stale-real',
        createdAt: BigInt(Date.now()),
      }).pipe(Effect.provide(versionLayer)),
    )
    expect(Exit.isFailure(stale)).toBe(true)
    if (Exit.isFailure(stale)) {
      expect(String(stale.cause)).toContain(IngestionJobOwnershipLostError.name)
    }
    const [notRenewed] = await sql.unsafe(
      `SELECT updated_at < NOW() - INTERVAL '59 minutes' AS still_stale
       FROM job_queue WHERE id = $1`,
      [versionJobId],
    )
    expect(notRenewed?.['still_stale']).toBe(true)
    const staleVersion = await sql.unsafe(
      `SELECT id FROM source_versions WHERE id = $1`,
      ['b60e8400-e29b-41d4-a716-44665544000b'],
    )
    expect(staleVersion).toHaveLength(0)
  })

  it('rejects forged ingestion transition aggregates and accepts exact owned controls', async () => {
    const [appendJob, completeJob, pendingJob, failedJob] = await Promise.all(
      [
        ingestionAppendJobId,
        ingestionCompleteJobId,
        ingestionPendingJobId,
        ingestionFailJobId,
      ].map((id) =>
        Effect.runPromise(JobQueueRepo.findById(id).pipe(Effect.provide(jobLayer)))),
    )
    const makeEvent = (
      id: string,
      eventType: string,
      eventWorkspaceId: typeof WorkspaceId.Type,
      ownershipJob: typeof JobQueue.Type,
    ) => ({
      id: EventJournalId.make(id),
      workspaceId: eventWorkspaceId,
      entityType: 'ingestion' as const,
      entityId: sourceId,
      eventType,
      payload: eventType === 'file-processed'
        ? {
            jobId: ownershipJob.id,
            attempt: ownershipJob.attempts,
            sourceVersionId: authorizedSourceVersionId,
            manifestRef: ingestionManifestRef,
            contentHash: ingestionContentHash,
            byteLength: 12,
          }
        : eventType === 'ingestion-completed'
          ? {
              jobId: ownershipJob.id,
              attempt: ownershipJob.attempts,
              sourceVersionId: authorizedSourceVersionId,
              manifestRef: ingestionManifestRef,
              contentHash: ingestionContentHash,
            }
          : {
              jobId: ownershipJob.id,
              attempt: ownershipJob.attempts,
              errorTag: 'IngestionFailure',
              message: 'Ingestion failed',
              retryable: true,
            },
      cursor: 0n,
      createdAt: BigInt(Date.now()),
    })
    const forgedEventIds = [
      'b60e8400-e29b-41d4-a716-446655440034',
      'b60e8400-e29b-41d4-a716-446655440035',
      'b60e8400-e29b-41d4-a716-446655440036',
      'b60e8400-e29b-41d4-a716-446655440037',
    ] as const
    const forgedEventTransitions = [
      JobQueueRepo.appendInProgressEvent(
        appendJob!,
        makeEvent(forgedEventIds[0], 'file-processed', foreignWorkspaceId, appendJob!),
      ),
      JobQueueRepo.markCompleted(
        completeJob!,
        makeEvent(forgedEventIds[1], 'ingestion-completed', foreignWorkspaceId, completeJob!),
      ),
      JobQueueRepo.markPending(
        pendingJob!,
        makeEvent(forgedEventIds[2], 'ingestion-failed', foreignWorkspaceId, pendingJob!),
      ),
      JobQueueRepo.markFailed(
        failedJob!,
        makeEvent(forgedEventIds[3], 'ingestion-failed', foreignWorkspaceId, failedJob!),
      ),
    ]
    for (const transition of forgedEventTransitions) {
      const exit = await Effect.runPromiseExit(transition.pipe(Effect.provide(jobLayer)))
      expect(Exit.isFailure(exit)).toBe(true)
      if (Exit.isFailure(exit)) {
        expect(String(exit.cause)).toContain(IngestionJobOwnershipLostError.name)
      }
    }

    const forgedJobEventIds = [
      'b60e8400-e29b-41d4-a716-446655440038',
      'b60e8400-e29b-41d4-a716-446655440039',
      'b60e8400-e29b-41d4-a716-44665544003a',
      'b60e8400-e29b-41d4-a716-44665544003b',
    ] as const
    const forgedJobs = [appendJob!, completeJob!, pendingJob!, failedJob!].map(
      (job) => ({ ...job, workspaceId: foreignWorkspaceId }),
    )
    const forgedJobTransitions = [
      JobQueueRepo.appendInProgressEvent(
        forgedJobs[0]!,
        makeEvent(forgedJobEventIds[0], 'file-processed', foreignWorkspaceId, forgedJobs[0]!),
      ),
      JobQueueRepo.markCompleted(
        forgedJobs[1]!,
        makeEvent(forgedJobEventIds[1], 'ingestion-completed', foreignWorkspaceId, forgedJobs[1]!),
      ),
      JobQueueRepo.markPending(
        forgedJobs[2]!,
        makeEvent(forgedJobEventIds[2], 'ingestion-failed', foreignWorkspaceId, forgedJobs[2]!),
      ),
      JobQueueRepo.markFailed(
        forgedJobs[3]!,
        makeEvent(forgedJobEventIds[3], 'ingestion-failed', foreignWorkspaceId, forgedJobs[3]!),
      ),
    ]
    for (const transition of forgedJobTransitions) {
      const exit = await Effect.runPromiseExit(transition.pipe(Effect.provide(jobLayer)))
      expect(Exit.isFailure(exit)).toBe(true)
      if (Exit.isFailure(exit)) {
        expect(String(exit.cause)).toContain(IngestionJobOwnershipLostError.name)
      }
    }

    const validEventIds = [
      'b60e8400-e29b-41d4-a716-44665544003c',
      'b60e8400-e29b-41d4-a716-44665544003d',
      'b60e8400-e29b-41d4-a716-44665544003e',
      'b60e8400-e29b-41d4-a716-44665544003f',
    ] as const
    const validTransitions = [
      JobQueueRepo.appendInProgressEvent(
        appendJob!,
        makeEvent(validEventIds[0], 'file-processed', workspaceId, appendJob!),
      ),
      JobQueueRepo.markCompleted(
        completeJob!,
        makeEvent(validEventIds[1], 'ingestion-completed', workspaceId, completeJob!),
      ),
      JobQueueRepo.markPending(
        pendingJob!,
        makeEvent(validEventIds[2], 'ingestion-failed', workspaceId, pendingJob!),
      ),
      JobQueueRepo.markFailed(
        failedJob!,
        makeEvent(validEventIds[3], 'ingestion-failed', workspaceId, failedJob!),
      ),
    ]
    for (const transition of validTransitions) {
      await Effect.runPromise(transition.pipe(Effect.provide(jobLayer)))
    }

    const statuses = await sql.unsafe(
      `SELECT id, status
       FROM job_queue
       WHERE id = ANY($1::uuid[])`,
      [[
        ingestionAppendJobId,
        ingestionCompleteJobId,
        ingestionPendingJobId,
        ingestionFailJobId,
      ]],
    )
    const statusById = new Map(
      statuses.map((row) => [String(row['id']), String(row['status'])]),
    )
    expect(statusById.get(ingestionAppendJobId)).toBe('in-progress')
    expect(statusById.get(ingestionCompleteJobId)).toBe('completed')
    expect(statusById.get(ingestionPendingJobId)).toBe('pending')
    expect(statusById.get(ingestionFailJobId)).toBe('failed')
    const forgedEvents = await sql.unsafe(
      `SELECT id FROM event_journal WHERE id = ANY($1::uuid[])`,
      [[...forgedEventIds, ...forgedJobEventIds]],
    )
    expect(forgedEvents).toHaveLength(0)
    const validEvents = await sql.unsafe(
      `SELECT workspace_id, entity_id
       FROM event_journal
       WHERE id = ANY($1::uuid[])`,
      [validEventIds],
    )
    expect(validEvents).toHaveLength(4)
    expect(validEvents.every((row) =>
      String(row['workspace_id']) === workspaceId
      && String(row['entity_id']) === sourceId)).toBe(true)
  })

  it('rejects cross-workspace research event metadata with typed ownership loss', async () => {
    const researchJob = await Effect.runPromise(
      JobQueueRepo.findById(researchJobId).pipe(Effect.provide(jobLayer)),
    )
    const mismatched = await Effect.runPromiseExit(
      ResearchExecutionRepo.appendInProgressEvent(researchJob, {
        id: EventJournalId.make('b60e8400-e29b-41d4-a716-44665544000c'),
        workspaceId: foreignWorkspaceId,
        entityType: 'research',
        entityId: runId,
        eventType: 'retrieval-completed',
        payload: { evidenceCount: 0, sourceVersionIds: [] },
        cursor: 0n,
        createdAt: BigInt(Date.now()),
      }).pipe(Effect.provide(researchLayer)),
    )
    expect(Exit.isFailure(mismatched)).toBe(true)
    if (Exit.isFailure(mismatched)) {
      expect(String(mismatched.cause)).toContain(ResearchJobOwnershipLostError.name)
    }
    const foreignEvent = await sql.unsafe(
      `SELECT id FROM event_journal WHERE id = $1`,
      ['b60e8400-e29b-41d4-a716-44665544000c'],
    )
    expect(foreignEvent).toHaveLength(0)

    await Effect.runPromise(
      ResearchExecutionRepo.appendInProgressEvent(researchJob, {
        id: EventJournalId.make('b60e8400-e29b-41d4-a716-44665544000d'),
        workspaceId,
        entityType: 'research',
        entityId: runId,
        eventType: 'retrieval-completed',
        payload: { evidenceCount: 0, sourceVersionIds: [] },
        cursor: 0n,
        createdAt: BigInt(Date.now()),
      }).pipe(Effect.provide(researchLayer)),
    )
    const [ownedEvent] = await sql.unsafe(
      `SELECT workspace_id FROM event_journal WHERE id = $1`,
      ['b60e8400-e29b-41d4-a716-44665544000d'],
    )
    expect(String(ownedEvent?.['workspace_id'])).toBe(workspaceId)
  })

  it('rejects append, complete, and fail from an incremented stale research attempt', async () => {
    const staleJob = await Effect.runPromise(
      JobQueueRepo.findById(researchJobId).pipe(Effect.provide(jobLayer)),
    )
    await sql.unsafe(
      `UPDATE job_queue SET attempts = attempts + 1 WHERE id = $1`,
      [researchJobId],
    )
    const eventIds = [
      'b60e8400-e29b-41d4-a716-446655440025',
      'b60e8400-e29b-41d4-a716-446655440026',
      'b60e8400-e29b-41d4-a716-446655440027',
    ] as const
    const makeEvent = (id: string, eventType: string) => ({
      id: EventJournalId.make(id),
      workspaceId,
      entityType: 'research' as const,
      entityId: runId,
      eventType,
      payload: {},
      cursor: 0n,
      createdAt: BigInt(Date.now()),
    })
    const transitions = [
      ResearchExecutionRepo.appendInProgressEvent(
        staleJob,
        makeEvent(eventIds[0], 'retrieval-completed'),
      ),
      ResearchExecutionRepo.complete({
        runId,
        job: staleJob,
        answer: { answer: 'Must not persist', citations: [] },
        citations: [],
        event: makeEvent(eventIds[1], 'research-completed'),
      }),
      ResearchExecutionRepo.fail({
        runId,
        job: staleJob,
        event: makeEvent(eventIds[2], 'research-failed'),
      }),
    ]

    for (const transition of transitions) {
      const exit = await Effect.runPromiseExit(
        transition.pipe(Effect.provide(researchLayer)),
      )
      expect(Exit.isFailure(exit)).toBe(true)
      if (Exit.isFailure(exit)) {
        expect(String(exit.cause)).toContain(ResearchJobOwnershipLostError.name)
      }
    }

    const [jobRow] = await sql.unsafe(
      `SELECT status, attempts FROM job_queue WHERE id = $1`,
      [researchJobId],
    )
    const [runRow] = await sql.unsafe(
      `SELECT status FROM research_runs WHERE id = $1`,
      [runId],
    )
    const events = await sql.unsafe(
      `SELECT id FROM event_journal WHERE id = ANY($1::uuid[])`,
      [eventIds],
    )
    const results = await sql.unsafe(
      `SELECT run_id FROM research_run_results WHERE run_id = $1`,
      [runId],
    )
    expect(jobRow).toMatchObject({ status: 'in-progress', attempts: 2 })
    expect(runRow?.['status']).toBe('in-progress')
    expect(events).toHaveLength(0)
    expect(results).toHaveLength(0)
  })

  it('rejects forged terminal workspace metadata and accepts current owned terminal attempts', async () => {
    const currentJob = await Effect.runPromise(
      JobQueueRepo.findById(researchJobId).pipe(Effect.provide(jobLayer)),
    )
    const forged = await Effect.runPromiseExit(
      ResearchExecutionRepo.complete({
        runId,
        job: currentJob,
        answer: { answer: 'Must not persist', citations: [] },
        citations: [],
        event: {
          id: EventJournalId.make('b60e8400-e29b-41d4-a716-446655440028'),
          workspaceId: foreignWorkspaceId,
          entityType: 'research',
          entityId: runId,
          eventType: 'research-completed',
          payload: { citationCount: 0 },
          cursor: 0n,
          createdAt: BigInt(Date.now()),
        },
      }).pipe(Effect.provide(researchLayer)),
    )
    expect(Exit.isFailure(forged)).toBe(true)
    if (Exit.isFailure(forged)) {
      expect(String(forged.cause)).toContain(ResearchJobOwnershipLostError.name)
    }

    const completeJob = await Effect.runPromise(
      JobQueueRepo.findById(completeJobId).pipe(Effect.provide(jobLayer)),
    )
    const failJob = await Effect.runPromise(
      JobQueueRepo.findById(failJobId).pipe(Effect.provide(jobLayer)),
    )
    await Effect.runPromise(
      ResearchExecutionRepo.appendInProgressEvent(completeJob, {
        id: EventJournalId.make('b60e8400-e29b-41d4-a716-446655440050'),
        workspaceId,
        entityType: 'research',
        entityId: completeRunId,
        eventType: 'citations-validated',
        payload: { citationCount: 0 },
        cursor: 0n,
        createdAt: BigInt(Date.now()),
      }).pipe(Effect.provide(researchLayer)),
    )
    await Effect.runPromise(
      ResearchExecutionRepo.complete({
        runId: completeRunId,
        job: completeJob,
        answer: { answer: 'Owned completion', citations: [] },
        citations: [],
        event: {
          id: EventJournalId.make('b60e8400-e29b-41d4-a716-446655440029'),
          workspaceId,
          entityType: 'research',
          entityId: completeRunId,
          eventType: 'research-completed',
          payload: { citationCount: 0 },
          cursor: 0n,
          createdAt: BigInt(Date.now()),
        },
      }).pipe(Effect.provide(researchLayer)),
    )
    await Effect.runPromise(
      ResearchExecutionRepo.fail({
        runId: failRunId,
        job: failJob,
        event: {
          id: EventJournalId.make('b60e8400-e29b-41d4-a716-44665544002a'),
          workspaceId,
          entityType: 'research',
          entityId: failRunId,
          eventType: 'research-failed',
          payload: {
            errorTag: 'ResearchWorkflowError',
            message: 'Research failed',
          },
          cursor: 0n,
          createdAt: BigInt(Date.now()),
        },
      }).pipe(Effect.provide(researchLayer)),
    )

    const terminalRows = await sql.unsafe(
      `SELECT id, status FROM job_queue WHERE id = ANY($1::uuid[]) ORDER BY id`,
      [[completeJobId, failJobId]],
    )
    const terminalEvents = await sql.unsafe(
      `SELECT workspace_id, entity_id
       FROM event_journal
       WHERE id = ANY($1::uuid[])
       ORDER BY id`,
      [[
        'b60e8400-e29b-41d4-a716-446655440029',
        'b60e8400-e29b-41d4-a716-44665544002a',
      ]],
    )
    expect(terminalRows.map((row) => row['status']).sort()).toEqual([
      'completed',
      'failed',
    ])
    expect(terminalEvents).toHaveLength(2)
    expect(terminalEvents.every((row) => String(row['workspace_id']) === workspaceId)).toBe(true)
    expect(terminalEvents.map((row) => String(row['entity_id'])).sort()).toEqual(
      [completeRunId, failRunId].sort(),
    )
  })

  it('completes directly from the serialized PostgreSQL JSONB job payload', async () => {
    await sql.unsafe(
      `INSERT INTO research_runs (id, thread_id, question, status)
       VALUES ($1, $2, 'Can serialized ownership complete?', 'in-progress')`,
      [serializedPayloadRunId, threadId],
    )
    await sql.unsafe(
      `INSERT INTO job_queue (
         id, workspace_id, entity_type, entity_id, status, payload,
         attempts, max_attempts
       )
       VALUES (
         $1, $2, 'research', $3, 'in-progress',
         jsonb_build_object(
           'projectId', $4::text,
           'sourceVersionIds', jsonb_build_array($5::text)
         ),
         1, 1
       )`,
      [
        serializedPayloadJobId,
        workspaceId,
        serializedPayloadRunId,
        projectId,
        authorizedSourceVersionId,
      ],
    )
    const job = await Effect.runPromise(
      JobQueueRepo.findById(serializedPayloadJobId).pipe(Effect.provide(jobLayer)),
    )
    await Effect.runPromise(
      ResearchExecutionRepo.appendInProgressEvent(job, {
        id: EventJournalId.make('b60e8400-e29b-41d4-a716-446655440051'),
        workspaceId,
        entityType: 'research',
        entityId: serializedPayloadRunId,
        eventType: 'citations-validated',
        payload: { citationCount: 1 },
        cursor: 0n,
        createdAt: BigInt(Date.now()),
      }).pipe(Effect.provide(researchLayer)),
    )

    await Effect.runPromise(
      ResearchExecutionRepo.complete({
        runId: serializedPayloadRunId,
        job,
        answer: {
          answer: 'Serialized JSONB is normalized.',
          citations: [{
            sourceVersionId: authorizedSourceVersionId,
            locator: 'lines:1-1',
          }],
        },
        citations: [{
          id: serializedPayloadCitationId,
          runId: serializedPayloadRunId,
          sourceVersionId: authorizedSourceVersionId,
          locator: 'lines:1-1',
          status: 'validated',
          createdAt: BigInt(Date.now()),
        }],
        event: {
          id: serializedPayloadEventId,
          workspaceId,
          entityType: 'research',
          entityId: serializedPayloadRunId,
          eventType: 'research-completed',
          payload: { citationCount: 1 },
          cursor: 0n,
          createdAt: BigInt(Date.now()),
        },
      }).pipe(Effect.provide(researchLayer)),
    )

    const [jobRow] = await sql.unsafe(
      `SELECT status FROM job_queue WHERE id = $1`,
      [serializedPayloadJobId],
    )
    const [runRow] = await sql.unsafe(
      `SELECT status FROM research_runs WHERE id = $1`,
      [serializedPayloadRunId],
    )
    const resultRows = await sql.unsafe(
      `SELECT run_id FROM research_run_results WHERE run_id = $1`,
      [serializedPayloadRunId],
    )
    const citationRows = await sql.unsafe(
      `SELECT id FROM citations WHERE id = $1 AND run_id = $2`,
      [serializedPayloadCitationId, serializedPayloadRunId],
    )
    const eventRows = await sql.unsafe(
      `SELECT id FROM event_journal WHERE id = $1
         AND workspace_id = $2 AND entity_id = $3`,
      [serializedPayloadEventId, workspaceId, serializedPayloadRunId],
    )
    expect(jobRow?.['status']).toBe('completed')
    expect(runRow?.['status']).toBe('completed')
    expect(resultRows).toHaveLength(1)
    expect(citationRows).toHaveLength(1)
    expect(eventRows).toHaveLength(1)
  })

  it('atomically fences completion source scope and result/citation conflicts', async () => {
    const completionEvent = (
      id: string,
      targetRunId: typeof runId,
      citationCount = 0,
    ) => ({
      id: EventJournalId.make(id),
      workspaceId,
      entityType: 'research' as const,
      entityId: targetRunId,
      eventType: 'research-completed',
      payload: { citationCount },
      cursor: 0n,
      createdAt: BigInt(Date.now()),
    })
    const assertInProgress = async (
      jobId: typeof researchJobId,
      targetRunId: typeof runId,
    ) => {
      const [jobRow] = await sql.unsafe(
        `SELECT status FROM job_queue WHERE id = $1`,
        [jobId],
      )
      const [runRow] = await sql.unsafe(
        `SELECT status FROM research_runs WHERE id = $1`,
        [targetRunId],
      )
      expect(jobRow?.['status']).toBe('in-progress')
      expect(runRow?.['status']).toBe('in-progress')
    }
    const appendCitationValidation = (
      job: typeof JobQueue.Type,
      targetRunId: typeof runId,
      citationCount: number,
      id: string,
    ) =>
      ResearchExecutionRepo.appendInProgressEvent(job, {
        id: EventJournalId.make(id),
        workspaceId,
        entityType: 'research',
        entityId: targetRunId,
        eventType: 'citations-validated',
        payload: { citationCount },
        cursor: 0n,
        createdAt: BigInt(Date.now()),
      }).pipe(Effect.provide(researchLayer))

    const scopeJob = await Effect.runPromise(
      JobQueueRepo.findById(scopeJobId).pipe(Effect.provide(jobLayer)),
    )
    await Effect.runPromise(
      appendCitationValidation(
        scopeJob,
        scopeRunId,
        0,
        'b60e8400-e29b-41d4-a716-446655440052',
      ),
    )
    const scopeExit = await Effect.runPromiseExit(
      ResearchExecutionRepo.complete({
        runId: scopeRunId,
        job: scopeJob,
        answer: { answer: 'Must not authorize a foreign source', citations: [] },
        citations: [],
        event: completionEvent(
          'b60e8400-e29b-41d4-a716-446655440040',
          scopeRunId,
        ),
      }).pipe(Effect.provide(researchLayer)),
    )
    expect(Exit.isFailure(scopeExit)).toBe(true)
    if (Exit.isFailure(scopeExit)) {
      expect(String(scopeExit.cause)).toContain('AuthorizationError')
    }
    await assertInProgress(scopeJobId, scopeRunId)

    const duplicateJob = await Effect.runPromise(
      JobQueueRepo.findById(duplicateJobId).pipe(Effect.provide(jobLayer)),
    )
    const duplicateCitations = [
      {
        id: duplicateCitationId,
        runId: duplicateRunId,
        sourceVersionId: authorizedSourceVersionId,
        locator: 'lines:1-1',
        status: 'validated',
        createdAt: BigInt(Date.now()),
      },
      {
        id: duplicateCitationId,
        runId: duplicateRunId,
        sourceVersionId: authorizedSourceVersionId,
        locator: 'lines:2-2',
        status: 'validated',
        createdAt: BigInt(Date.now()),
      },
    ] as const
    const duplicateExit = await Effect.runPromiseExit(
      ResearchExecutionRepo.complete({
        runId: duplicateRunId,
        job: duplicateJob,
        answer: {
          answer: 'Must reject duplicate citation IDs',
          citations: duplicateCitations.map(({ sourceVersionId, locator }) => ({
            sourceVersionId,
            locator,
          })),
        },
        citations: duplicateCitations,
        event: completionEvent(
          'b60e8400-e29b-41d4-a716-446655440041',
          duplicateRunId,
        ),
      }).pipe(Effect.provide(researchLayer)),
    )
    expect(Exit.isFailure(duplicateExit)).toBe(true)
    if (Exit.isFailure(duplicateExit)) {
      expect(String(duplicateExit.cause)).toContain(ValidationError.name)
    }
    await assertInProgress(duplicateJobId, duplicateRunId)

    const resultConflictJob = await Effect.runPromise(
      JobQueueRepo.findById(resultConflictJobId).pipe(Effect.provide(jobLayer)),
    )
    await Effect.runPromise(
      appendCitationValidation(
        resultConflictJob,
        resultConflictRunId,
        0,
        'b60e8400-e29b-41d4-a716-446655440053',
      ),
    )
    const resultConflictExit = await Effect.runPromiseExit(
      ResearchExecutionRepo.complete({
        runId: resultConflictRunId,
        job: resultConflictJob,
        answer: { answer: 'Must not replace the result', citations: [] },
        citations: [],
        event: completionEvent(
          'b60e8400-e29b-41d4-a716-446655440042',
          resultConflictRunId,
        ),
      }).pipe(Effect.provide(researchLayer)),
    )
    expect(Exit.isFailure(resultConflictExit)).toBe(true)
    if (Exit.isFailure(resultConflictExit)) {
      expect(String(resultConflictExit.cause)).toContain(QueryError.name)
    }
    await assertInProgress(resultConflictJobId, resultConflictRunId)
    const [preservedResult] = await sql.unsafe(
      `SELECT answer FROM research_run_results WHERE run_id = $1`,
      [resultConflictRunId],
    )
    expect(preservedResult?.['answer']).toBe('Preexisting result')

    const citationConflictJob = await Effect.runPromise(
      JobQueueRepo.findById(citationConflictJobId).pipe(Effect.provide(jobLayer)),
    )
    await Effect.runPromise(
      appendCitationValidation(
        citationConflictJob,
        citationConflictRunId,
        1,
        'b60e8400-e29b-41d4-a716-446655440054',
      ),
    )
    const citationConflictExit = await Effect.runPromiseExit(
      ResearchExecutionRepo.complete({
        runId: citationConflictRunId,
        job: citationConflictJob,
        answer: {
          answer: 'Must not steal a citation ID',
          citations: [{
            sourceVersionId: authorizedSourceVersionId,
            locator: 'lines:3-3',
          }],
        },
        citations: [{
          id: conflictingCitationId,
          runId: citationConflictRunId,
          sourceVersionId: authorizedSourceVersionId,
          locator: 'lines:3-3',
          status: 'validated',
          createdAt: BigInt(Date.now()),
        }],
        event: completionEvent(
          'b60e8400-e29b-41d4-a716-446655440043',
          citationConflictRunId,
          1,
        ),
      }).pipe(Effect.provide(researchLayer)),
    )
    expect(Exit.isFailure(citationConflictExit)).toBe(true)
    if (Exit.isFailure(citationConflictExit)) {
      expect(String(citationConflictExit.cause)).toContain(QueryError.name)
    }
    await assertInProgress(citationConflictJobId, citationConflictRunId)
    const conflictResults = await sql.unsafe(
      `SELECT run_id FROM research_run_results WHERE run_id = $1`,
      [citationConflictRunId],
    )
    const [preservedCitation] = await sql.unsafe(
      `SELECT run_id, locator FROM citations WHERE id = $1`,
      [conflictingCitationId],
    )
    expect(conflictResults).toHaveLength(0)
    expect(String(preservedCitation?.['run_id'])).toBe(citationOwnerRunId)
    expect(preservedCitation?.['locator']).toBe('lines:1-1')

    const validCitationId = CitationId.make(
      'b60e8400-e29b-41d4-a716-446655440044',
    )
    await Effect.runPromise(
      appendCitationValidation(
        duplicateJob,
        duplicateRunId,
        1,
        'b60e8400-e29b-41d4-a716-446655440055',
      ),
    )
    await Effect.runPromise(
      ResearchExecutionRepo.complete({
        runId: duplicateRunId,
        job: duplicateJob,
        answer: {
          answer: 'Current owned completion',
          citations: [{
            sourceVersionId: authorizedSourceVersionId,
            locator: 'lines:4-4',
          }],
        },
        citations: [{
          id: validCitationId,
          runId: duplicateRunId,
          sourceVersionId: authorizedSourceVersionId,
          locator: 'lines:4-4',
          status: 'validated',
          createdAt: BigInt(Date.now()),
        }],
        event: completionEvent(
          'b60e8400-e29b-41d4-a716-446655440045',
          duplicateRunId,
          1,
        ),
      }).pipe(Effect.provide(researchLayer)),
    )
    const [validJob] = await sql.unsafe(
      `SELECT status FROM job_queue WHERE id = $1`,
      [duplicateJobId],
    )
    const [validRun] = await sql.unsafe(
      `SELECT status FROM research_runs WHERE id = $1`,
      [duplicateRunId],
    )
    const validResults = await sql.unsafe(
      `SELECT run_id FROM research_run_results WHERE run_id = $1`,
      [duplicateRunId],
    )
    const validCitations = await sql.unsafe(
      `SELECT id FROM citations WHERE id = $1 AND run_id = $2`,
      [validCitationId, duplicateRunId],
    )
    expect(validJob?.['status']).toBe('completed')
    expect(validRun?.['status']).toBe('completed')
    expect(validResults).toHaveLength(1)
    expect(validCitations).toHaveLength(1)
  })

  it('rolls back inconsistent research registration before its first write', async () => {
    const mismatchedThreadId = ResearchThreadId.make(
      'b60e8400-e29b-41d4-a716-44665544002b',
    )
    const mismatchedRunId = ResearchRunId.make(
      'b60e8400-e29b-41d4-a716-44665544002c',
    )
    const mismatchedJobId = JobQueueId.make(
      'b60e8400-e29b-41d4-a716-44665544002d',
    )
    const mismatchedEventId = EventJournalId.make(
      'b60e8400-e29b-41d4-a716-44665544002e',
    )
    const sourceVersionId = SourceVersionId.make(
      'b60e8400-e29b-41d4-a716-44665544002f',
    )
    const exit = await Effect.runPromiseExit(
      ResearchExecutionRepo.register({
        workspaceId,
        projectId,
        sourceVersionIds: [sourceVersionId],
        thread: {
          id: mismatchedThreadId,
          projectId,
          title: 'Must roll back',
          createdAt: BigInt(Date.now()),
          updatedAt: BigInt(Date.now()),
        },
        run: {
          id: mismatchedRunId,
          threadId: mismatchedThreadId,
          question: 'Must this roll back?',
          status: 'pending',
          createdAt: BigInt(Date.now()),
          updatedAt: BigInt(Date.now()),
        },
        job: {
          id: mismatchedJobId,
          workspaceId: foreignWorkspaceId,
          entityType: 'research',
          entityId: mismatchedRunId,
          status: 'pending',
          payload: { projectId, sourceVersionIds: [sourceVersionId] },
          attempts: 0,
          maxAttempts: 1,
          createdAt: BigInt(Date.now()),
          updatedAt: BigInt(Date.now()),
        },
        event: {
          id: mismatchedEventId,
          workspaceId,
          entityType: 'research',
          entityId: mismatchedRunId,
          eventType: 'research-started',
          payload: { jobId: mismatchedJobId, threadId: mismatchedThreadId },
          cursor: 0n,
          createdAt: BigInt(Date.now()),
        },
      }).pipe(Effect.provide(researchLayer)),
    )
    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      expect(String(exit.cause)).toContain(ValidationError.name)
    }
    const rowSets = await Promise.all([
      sql.unsafe(`SELECT id FROM research_threads WHERE id = $1`, [mismatchedThreadId]),
      sql.unsafe(`SELECT id FROM research_runs WHERE id = $1`, [mismatchedRunId]),
      sql.unsafe(`SELECT id FROM job_queue WHERE id = $1`, [mismatchedJobId]),
      sql.unsafe(`SELECT id FROM event_journal WHERE id = $1`, [mismatchedEventId]),
    ])
    expect(rowSets.every((rows) => rows.length === 0)).toBe(true)
  })
})
