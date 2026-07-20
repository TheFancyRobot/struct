import { describe, expect, it } from 'bun:test'
import { Effect, Exit, Layer } from 'effect'
import {
  AuthorizationError,
  CitationId,
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
  IngestionJobOwnershipLostError,
  JobQueueRepo,
  QueryError,
  ResearchExecutionRepo,
  ResearchJobOwnershipLostError,
  SourceVersionRepo,
  SqlClientTest,
} from '../index.js'

const workspaceId = WorkspaceId.make('660e8400-e29b-41d4-a716-446655440000')
const foreignWorkspaceId = WorkspaceId.make('660e8400-e29b-41d4-a716-446655440001')
const sourceId = SourceId.make('660e8400-e29b-41d4-a716-446655440002')
const runId = ResearchRunId.make('660e8400-e29b-41d4-a716-446655440003')
const ingestionJobId = JobQueueId.make('660e8400-e29b-41d4-a716-446655440004')
const researchJobId = JobQueueId.make('660e8400-e29b-41d4-a716-446655440005')
const projectId = ProjectId.make('660e8400-e29b-41d4-a716-44665544000b')
const threadId = ResearchThreadId.make('660e8400-e29b-41d4-a716-44665544000c')
const registrationJobId = JobQueueId.make('660e8400-e29b-41d4-a716-44665544000d')
const registrationSourceVersionId = SourceVersionId.make(
  '660e8400-e29b-41d4-a716-44665544000e',
)
const foreignSourceVersionId = SourceVersionId.make(
  '660e8400-e29b-41d4-a716-446655440016',
)
const ingestionSourceVersionId = SourceVersionId.make(
  '660e8400-e29b-41d4-a716-446655440025',
)
const manifestRef =
  'artifact://sha256/cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc'
const ingestionContentHash =
  'sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd'

const ingestionJob = {
  id: ingestionJobId,
  workspaceId,
  entityType: 'ingestion',
  entityId: sourceId,
  status: 'in-progress',
  payload: {},
  attempts: 1,
  maxAttempts: 3,
  createdAt: 0n,
  updatedAt: 0n,
} as const

const ingestionEvent = {
  id: EventJournalId.make('660e8400-e29b-41d4-a716-446655440006'),
  workspaceId,
  entityType: 'ingestion',
  entityId: sourceId,
  eventType: 'file-processed',
  payload: {
    jobId: ingestionJobId,
    attempt: 1,
    sourceVersionId: ingestionSourceVersionId,
    manifestRef,
    contentHash: ingestionContentHash,
    byteLength: 12,
  },
  cursor: 0n,
  createdAt: 0n,
} as const

const ingestionTransitionEvent = (
  id: string,
  eventType: string,
  eventWorkspaceId = workspaceId,
  attempt = 1,
) => ({
  id: EventJournalId.make(id),
  workspaceId: eventWorkspaceId,
  entityType: 'ingestion',
  entityId: sourceId,
  eventType,
  payload: eventType === 'file-processed'
    ? {
        jobId: ingestionJobId,
        attempt,
        sourceVersionId: ingestionSourceVersionId,
        manifestRef,
        contentHash: ingestionContentHash,
        byteLength: 12,
      }
    : eventType === 'ingestion-completed'
      ? {
          jobId: ingestionJobId,
          attempt,
          sourceVersionId: ingestionSourceVersionId,
          manifestRef,
          contentHash: ingestionContentHash,
        }
      : {
          jobId: ingestionJobId,
          attempt,
          errorTag: 'IngestionFailure',
          message: 'Ingestion failed',
          retryable: true,
        },
  cursor: 0n,
  createdAt: 0n,
} as const)

const exhaustedIngestionJob = {
  ...ingestionJob,
  attempts: 3,
} as const

const researchJob = {
  id: researchJobId,
  workspaceId,
  entityType: 'research',
  entityId: runId,
  status: 'in-progress',
  payload: { projectId, sourceVersionIds: [registrationSourceVersionId] },
  attempts: 1,
  maxAttempts: 1,
  createdAt: 0n,
  updatedAt: 0n,
} as const

const researchEvent = (
  id: string,
  eventType: string,
  eventWorkspaceId = workspaceId,
) => ({
  id: EventJournalId.make(id),
  workspaceId: eventWorkspaceId,
  entityType: 'research',
  entityId: runId,
  eventType,
  payload: eventType === 'retrieval-completed'
    ? { evidenceCount: 0, sourceVersionIds: [] }
    : eventType === 'citations-validated' || eventType === 'research-completed'
      ? { citationCount: 0 }
      : eventType === 'research-failed'
        ? { errorTag: 'ResearchWorkflowError', message: 'Research failed' }
        : {},
  cursor: 0n,
  createdAt: 0n,
} as const)

const registrationInput = {
  workspaceId,
  projectId,
  sourceVersionIds: [registrationSourceVersionId],
  thread: {
    id: threadId,
    projectId,
    title: 'Ownership registration',
    createdAt: 0n,
    updatedAt: 0n,
  },
  run: {
    id: runId,
    threadId,
    question: 'Is the aggregate consistent?',
    status: 'pending',
    createdAt: 0n,
    updatedAt: 0n,
  },
  job: {
    id: registrationJobId,
    workspaceId,
    entityType: 'research',
    entityId: runId,
    status: 'pending',
    payload: {
      projectId,
      sourceVersionIds: [registrationSourceVersionId],
    },
    attempts: 0,
    maxAttempts: 1,
    createdAt: 0n,
    updatedAt: 0n,
  },
  event: {
    id: EventJournalId.make('660e8400-e29b-41d4-a716-44665544000f'),
    workspaceId,
    entityType: 'research',
    entityId: runId,
    eventType: 'research-started',
    payload: { jobId: registrationJobId, threadId },
    cursor: 0n,
    createdAt: 0n,
  },
} as const

describe('ingestion attempt ownership heartbeats', () => {
  it('renews only the exact workspace, source, and attempt', async () => {
    const calls: Array<{ readonly query: string; readonly params?: readonly unknown[] }> = []
    const sqlLayer = SqlClientTest(async (query, params) => {
      calls.push({ query, params })
      return [{ id: ingestionJobId }]
    })
    const layer = Layer.provide(JobQueueRepo.Default, sqlLayer)

    await Effect.runPromise(
      JobQueueRepo.renewLease(ingestionJob).pipe(Effect.provide(layer)),
    )

    const renewal = calls[0]
    expect(renewal?.query).toMatch(/SET updated_at = NOW\(\)/i)
    expect(renewal?.query).toMatch(/entity_type = 'ingestion'/i)
    expect(renewal?.query).toMatch(/entity_id = \$2/i)
    expect(renewal?.query).toMatch(/workspace_id = \$3/i)
    expect(renewal?.query).toMatch(/status = 'in-progress'/i)
    expect(renewal?.query).toMatch(/attempts = \$4/i)
    expect(renewal?.params).toEqual([
      ingestionJobId,
      sourceId,
      workspaceId,
      1,
    ])
  })

  it('returns typed ownership loss when the exact ingestion lease is absent', async () => {
    const layer = Layer.provide(
      JobQueueRepo.Default,
      SqlClientTest(async () => []),
    )

    const exit = await Effect.runPromiseExit(
      JobQueueRepo.renewLease(ingestionJob).pipe(Effect.provide(layer)),
    )

    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      expect(String(exit.cause)).toContain(IngestionJobOwnershipLostError.name)
    }
  })

  it('renews the exact attempt while atomically appending an in-progress event', async () => {
    const calls: Array<{ readonly query: string; readonly params?: readonly unknown[] }> = []
    const sqlLayer = SqlClientTest(async (query, params) => {
      calls.push({ query, params })
      if (query.includes('FROM job_queue job')) {
        return [{
          id: ingestionJobId,
          attempts: 1,
          max_attempts: 3,
          payload: { byteLength: 12 },
        }]
      }
      if (query.includes('FROM source_versions version')) {
        return [{
          id: ingestionSourceVersionId,
          artifact_ref: manifestRef,
          content_hash: ingestionContentHash,
        }]
      }
      return query.includes('UPDATE job_queue') ? [{ id: ingestionJobId }] : []
    })
    const layer = Layer.provide(JobQueueRepo.Default, sqlLayer)

    await Effect.runPromise(
      JobQueueRepo.appendInProgressEvent(ingestionJob, ingestionEvent).pipe(
        Effect.provide(layer),
      ),
    )

    const ownership = calls.find((call) => call.query.includes('UPDATE job_queue'))
    expect(ownership?.query).toMatch(/SET updated_at = NOW\(\)/i)
    expect(ownership?.query).toMatch(/entity_id = \$2/i)
    expect(ownership?.query).toMatch(/workspace_id = \$3/i)
    expect(ownership?.query).toMatch(/status = 'in-progress'/i)
    expect(ownership?.query).toMatch(/attempts = \$4/i)
    expect(ownership?.query).toMatch(/RETURNING id/i)
    expect(ownership?.params).toEqual([
      ingestionJobId,
      sourceId,
      workspaceId,
      1,
    ])
    expect(calls.some((call) => call.query.includes('INSERT INTO event_journal'))).toBe(true)
  })

  it('does not heartbeat or append for a stale ingestion attempt', async () => {
    const calls: string[] = []
    const sqlLayer = SqlClientTest(async (query) => {
      calls.push(query)
      return []
    })
    const layer = Layer.provide(JobQueueRepo.Default, sqlLayer)

    const exit = await Effect.runPromiseExit(
      JobQueueRepo.appendInProgressEvent(ingestionJob, ingestionEvent).pipe(
        Effect.provide(layer),
      ),
    )

    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      expect(String(exit.cause)).toContain(IngestionJobOwnershipLostError.name)
    }
    expect(calls.filter((query) => query.includes('UPDATE job_queue'))).toHaveLength(0)
    expect(calls.some((query) => query.includes('INSERT INTO event_journal'))).toBe(false)
  })

  it('renews the exact attempt before atomically creating its source version', async () => {
    const calls: Array<{ readonly query: string; readonly params?: readonly unknown[] }> = []
    const version = {
      id: SourceVersionId.make('660e8400-e29b-41d4-a716-446655440007'),
      sourceId,
      version: 1,
      artifactRef: 'artifact://sha256/ownership-unit',
      contentHash: 'sha256:ownership-unit',
      createdAt: 0n,
    }
    const sqlLayer = SqlClientTest(async (query, params) => {
      calls.push({ query, params })
      if (query.includes('UPDATE job_queue')) return [{ id: ingestionJobId }]
      return [{
        id: version.id,
        source_id: sourceId,
        version: 1,
        artifact_ref: version.artifactRef,
        content_hash: version.contentHash,
        created_at: new Date(0),
      }]
    })
    const layer = Layer.provide(SourceVersionRepo.Default, sqlLayer)

    await Effect.runPromise(
      SourceVersionRepo.createForIngestionAttempt(ingestionJob, version).pipe(
        Effect.provide(layer),
      ),
    )

    const ownership = calls.find((call) => call.query.includes('UPDATE job_queue'))
    expect(ownership?.query).toMatch(/SET updated_at = NOW\(\)/i)
    expect(ownership?.query).toMatch(/job\.entity_id = \$2/i)
    expect(ownership?.query).toMatch(/job\.workspace_id = \$3/i)
    expect(ownership?.query).toMatch(/job\.attempts = \$4/i)
    expect(ownership?.query).toMatch(/source\.id = \$2/i)
    expect(ownership?.query).toMatch(/project\.workspace_id = \$3/i)
    expect(ownership?.query).toMatch(/RETURNING job\.id/i)
    expect(ownership?.params).toEqual([ingestionJobId, sourceId, workspaceId, 1])
    expect(calls.some((call) => call.query.includes('INSERT INTO source_versions'))).toBe(true)
  })

  it('rejects forged source-version job aggregates before SQL', async () => {
    const calls: string[] = []
    const layer = Layer.provide(
      SourceVersionRepo.Default,
      SqlClientTest(async (query) => {
        calls.push(query)
        return []
      }),
    )
    const version = {
      id: SourceVersionId.make('660e8400-e29b-41d4-a716-446655440023'),
      sourceId,
      version: 1,
      artifactRef: 'artifact://sha256/forged-unit',
      contentHash: 'sha256:forged-unit',
      createdAt: 0n,
    }
    const forgedJobs = [
      { ...ingestionJob, entityType: 'research' as const },
      { ...ingestionJob, status: 'pending' as const },
      {
        ...ingestionJob,
        entityId: SourceId.make('660e8400-e29b-41d4-a716-446655440024'),
      },
    ]

    for (const forgedJob of forgedJobs) {
      const exit = await Effect.runPromiseExit(
        SourceVersionRepo.createForIngestionAttempt(forgedJob, version).pipe(
          Effect.provide(layer),
        ),
      )
      expect(Exit.isFailure(exit)).toBe(true)
      if (Exit.isFailure(exit)) {
        expect(String(exit.cause)).toContain(IngestionJobOwnershipLostError.name)
      }
    }
    expect(calls).toHaveLength(0)
  })

  it('fences forged source-version workspace scope before insert', async () => {
    const calls: Array<{ readonly query: string; readonly params?: readonly unknown[] }> = []
    const layer = Layer.provide(
      SourceVersionRepo.Default,
      SqlClientTest(async (query, params) => {
        calls.push({ query, params })
        return []
      }),
    )
    const forgedJob = { ...ingestionJob, workspaceId: foreignWorkspaceId }
    const exit = await Effect.runPromiseExit(
      SourceVersionRepo.createForIngestionAttempt(forgedJob, {
        id: SourceVersionId.make('660e8400-e29b-41d4-a716-446655440025'),
        sourceId,
        version: 1,
        artifactRef: 'artifact://sha256/forged-workspace-unit',
        contentHash: 'sha256:forged-workspace-unit',
        createdAt: 0n,
      }).pipe(Effect.provide(layer)),
    )

    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      expect(String(exit.cause)).toContain(IngestionJobOwnershipLostError.name)
    }
    expect(calls).toHaveLength(1)
    expect(calls[0]?.query).toMatch(/job\.workspace_id = \$3/i)
    expect(calls[0]?.query).toMatch(/project\.workspace_id = \$3/i)
    expect(calls[0]?.params).toEqual([
      ingestionJobId,
      sourceId,
      foreignWorkspaceId,
      1,
    ])
    expect(calls.some((call) => call.query.includes('INSERT INTO source_versions'))).toBe(false)
  })

  it('does not heartbeat or create a version for a stale ingestion attempt', async () => {
    const calls: string[] = []
    const sqlLayer = SqlClientTest(async (query) => {
      calls.push(query)
      return []
    })
    const layer = Layer.provide(SourceVersionRepo.Default, sqlLayer)

    const exit = await Effect.runPromiseExit(
      SourceVersionRepo.createForIngestionAttempt(ingestionJob, {
        id: SourceVersionId.make('660e8400-e29b-41d4-a716-446655440008'),
        sourceId,
        version: 1,
        artifactRef: 'artifact://sha256/stale-unit',
        contentHash: 'sha256:stale-unit',
        createdAt: 0n,
      }).pipe(Effect.provide(layer)),
    )

    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      expect(String(exit.cause)).toContain(IngestionJobOwnershipLostError.name)
    }
    expect(calls.filter((query) => query.includes('UPDATE job_queue'))).toHaveLength(1)
    expect(calls.some((query) => query.includes('INSERT INTO source_versions'))).toBe(false)
  })

  it('rejects forged event scope for append and every terminal transition before SQL', async () => {
    const calls: string[] = []
    const layer = Layer.provide(
      JobQueueRepo.Default,
      SqlClientTest(async (query) => {
        calls.push(query)
        return []
      }),
    )
    const transitions = [
      JobQueueRepo.appendInProgressEvent(
        ingestionJob,
        ingestionTransitionEvent(
          '660e8400-e29b-41d4-a716-446655440016',
          'file-processed',
          foreignWorkspaceId,
        ),
      ),
      JobQueueRepo.markCompleted(
        ingestionJob,
        ingestionTransitionEvent(
          '660e8400-e29b-41d4-a716-446655440017',
          'ingestion-completed',
          foreignWorkspaceId,
        ),
      ),
      JobQueueRepo.markPending(
        ingestionJob,
        ingestionTransitionEvent(
          '660e8400-e29b-41d4-a716-446655440018',
          'ingestion-failed',
          foreignWorkspaceId,
        ),
      ),
      JobQueueRepo.markFailed(
        exhaustedIngestionJob,
        ingestionTransitionEvent(
          '660e8400-e29b-41d4-a716-446655440019',
          'ingestion-failed',
          foreignWorkspaceId,
          3,
        ),
      ),
      JobQueueRepo.appendInProgressEvent(
        ingestionJob,
        {
          ...ingestionTransitionEvent(
            '660e8400-e29b-41d4-a716-446655440022',
            'file-processed',
          ),
          entityType: 'research',
        },
      ),
    ]

    for (const transition of transitions) {
      const exit = await Effect.runPromiseExit(transition.pipe(Effect.provide(layer)))
      expect(Exit.isFailure(exit)).toBe(true)
      if (Exit.isFailure(exit)) {
        expect(String(exit.cause)).toContain(IngestionJobOwnershipLostError.name)
      }
    }
    expect(calls).toHaveLength(0)
  })

  it('rejects forged job scope for append and every terminal transition', async () => {
    const calls: Array<{ readonly query: string; readonly params?: readonly unknown[] }> = []
    const layer = Layer.provide(
      JobQueueRepo.Default,
      SqlClientTest(async (query, params) => {
        calls.push({ query, params })
        return params?.[2] === workspaceId ? [{ id: ingestionJobId }] : []
      }),
    )
    const forgedJob = { ...ingestionJob, workspaceId: foreignWorkspaceId }
    const exhaustedForgedJob = {
      ...exhaustedIngestionJob,
      workspaceId: foreignWorkspaceId,
    }
    const transitions = [
      JobQueueRepo.appendInProgressEvent(
        forgedJob,
        ingestionTransitionEvent(
          '660e8400-e29b-41d4-a716-44665544001a',
          'file-processed',
          foreignWorkspaceId,
        ),
      ),
      JobQueueRepo.markCompleted(
        forgedJob,
        ingestionTransitionEvent(
          '660e8400-e29b-41d4-a716-44665544001b',
          'ingestion-completed',
          foreignWorkspaceId,
        ),
      ),
      JobQueueRepo.markPending(
        forgedJob,
        ingestionTransitionEvent(
          '660e8400-e29b-41d4-a716-44665544001c',
          'ingestion-failed',
          foreignWorkspaceId,
        ),
      ),
      JobQueueRepo.markFailed(
        exhaustedForgedJob,
        ingestionTransitionEvent(
          '660e8400-e29b-41d4-a716-44665544001d',
          'ingestion-failed',
          foreignWorkspaceId,
          3,
        ),
      ),
    ]

    for (const transition of transitions) {
      const exit = await Effect.runPromiseExit(transition.pipe(Effect.provide(layer)))
      expect(Exit.isFailure(exit)).toBe(true)
      if (Exit.isFailure(exit)) {
        expect(String(exit.cause)).toContain(IngestionJobOwnershipLostError.name)
      }
    }
    expect(calls.filter((call) => call.query.includes('UPDATE job_queue'))).toHaveLength(0)
    expect(calls.some((call) => call.query.includes('INSERT INTO event_journal'))).toBe(false)
    for (const call of calls) {
      expect(call.query).toMatch(/entity_id = \$2/i)
      expect(call.query).toMatch(/workspace_id = \$3/i)
      expect(call.query).toMatch(/attempts = \$4/i)
      expect(call.params?.slice(0, 3)).toEqual([
        ingestionJobId,
        sourceId,
        foreignWorkspaceId,
      ])
    }
  })

  it('accepts valid append and terminal aggregates with exact full-scope predicates', async () => {
    const calls: Array<{ readonly query: string; readonly params?: readonly unknown[] }> = []
    const layer = Layer.provide(
      JobQueueRepo.Default,
      SqlClientTest(async (query, params) => {
        calls.push({ query, params })
        if (query.includes('FROM job_queue job')) {
          return [{
            id: ingestionJobId,
            workspace_id: workspaceId,
            entity_type: 'ingestion',
            entity_id: sourceId,
            attempts: params?.[3],
            max_attempts: 3,
            payload: { byteLength: 12 },
          }]
        }
        if (query.includes('FROM source_versions version')) {
          return [{
            id: ingestionSourceVersionId,
            artifact_ref: manifestRef,
            content_hash: ingestionContentHash,
          }]
        }
        return query.includes('UPDATE job_queue') ? [{ id: ingestionJobId }] : []
      }),
    )
    const transitions = [
      JobQueueRepo.appendInProgressEvent(
        ingestionJob,
        ingestionTransitionEvent(
          '660e8400-e29b-41d4-a716-44665544001e',
          'file-processed',
        ),
      ),
      JobQueueRepo.markCompleted(
        ingestionJob,
        ingestionTransitionEvent(
          '660e8400-e29b-41d4-a716-44665544001f',
          'ingestion-completed',
        ),
      ),
      JobQueueRepo.markPending(
        ingestionJob,
        ingestionTransitionEvent(
          '660e8400-e29b-41d4-a716-446655440020',
          'ingestion-failed',
        ),
      ),
      JobQueueRepo.markFailed(
        exhaustedIngestionJob,
        ingestionTransitionEvent(
          '660e8400-e29b-41d4-a716-446655440021',
          'ingestion-failed',
          workspaceId,
          3,
        ),
      ),
    ]

    for (const transition of transitions) {
      await Effect.runPromise(transition.pipe(Effect.provide(layer)))
    }
    const updates = calls.filter((call) => call.query.includes('UPDATE job_queue'))
    expect(updates).toHaveLength(4)
    expect(updates.every((call) =>
      call.params?.[0] === ingestionJobId
      && call.params?.[1] === sourceId
      && call.params?.[2] === workspaceId
      && (call.params?.[3] === 1 || call.params?.[3] === 3))).toBe(true)
    expect(calls.filter((call) => call.query.includes('INSERT INTO event_journal'))).toHaveLength(4)
  })
})

describe('research event workspace ownership', () => {
  it('requires the event workspace to match the in-progress research job', async () => {
    const calls: Array<{ readonly query: string; readonly params?: readonly unknown[] }> = []
    const sqlLayer = SqlClientTest(async (query, params) => {
      calls.push({ query, params })
      if (query.includes('FROM job_queue')) {
        return params?.[2] === workspaceId && params?.[3] === researchJob.attempts
          ? [{ id: researchJobId, payload: researchJob.payload }]
          : []
      }
      return []
    })
    const layer = Layer.provide(ResearchExecutionRepo.Default, sqlLayer)
    const event = (eventWorkspaceId: typeof WorkspaceId.Type) => ({
      id: EventJournalId.make(
        eventWorkspaceId === workspaceId
          ? '660e8400-e29b-41d4-a716-446655440009'
          : '660e8400-e29b-41d4-a716-44665544000a',
      ),
      workspaceId: eventWorkspaceId,
      entityType: 'research',
      entityId: runId,
      eventType: 'retrieval-completed',
      payload: { evidenceCount: 0, sourceVersionIds: [] },
      cursor: 0n,
      createdAt: 0n,
    } as const)

    const mismatched = await Effect.runPromiseExit(
      ResearchExecutionRepo.appendInProgressEvent(
        researchJob,
        event(foreignWorkspaceId),
      ).pipe(Effect.provide(layer)),
    )

    expect(Exit.isFailure(mismatched)).toBe(true)
    if (Exit.isFailure(mismatched)) {
      expect(String(mismatched.cause)).toContain(ResearchJobOwnershipLostError.name)
    }
    expect(calls.some((call) => call.query.includes('INSERT INTO event_journal'))).toBe(false)

    await Effect.runPromise(
      ResearchExecutionRepo.appendInProgressEvent(
        researchJob,
        event(workspaceId),
      ).pipe(Effect.provide(layer)),
    )
    const ownership = calls.find((call) => call.query.includes('FROM job_queue'))
    expect(ownership?.query).toMatch(/workspace_id = \$3/i)
    expect(ownership?.query).toMatch(/attempts = \$4/i)
    expect(ownership?.params).toEqual([
      researchJobId,
      runId,
      workspaceId,
      researchJob.attempts,
    ])
    expect(calls.some((call) => call.query.includes('INSERT INTO event_journal'))).toBe(true)
  })

  it('canonicalizes recursive progress and rejects tampered owned identities', async () => {
    const inserts: Array<readonly unknown[]> = []
    const sqlLayer = SqlClientTest(async (query, params) => {
      if (query.includes('FROM job_queue')) {
        return [{ id: researchJobId, payload: researchJob.payload }]
      }
      if (query.includes('INSERT INTO event_journal') && params !== undefined) {
        inserts.push(params)
      }
      return []
    })
    const layer = Layer.provide(ResearchExecutionRepo.Default, sqlLayer)
    const recursiveEvent = (
      id: string,
      eventWorkspaceId: typeof WorkspaceId.Type,
      attempt: number,
    ) => ({
      id: EventJournalId.make(id),
      workspaceId,
      entityType: 'research',
      entityId: runId,
      eventType: 'recursive-run-progress-committed',
      payload: {
        jobId: researchJobId,
        attempt,
        workspaceId: eventWorkspaceId,
        requestId: `sha256:${'1'.repeat(64)}`,
        planId: `sha256:${'2'.repeat(64)}`,
        status: 'running',
        cancellation: 'none',
        recoveryCount: 0,
        expectedPartitions: 2,
        committedPartitions: 0,
        failedPartitions: 0,
        untrustedExtra: 'must-not-persist',
      },
      cursor: 0n,
      createdAt: 0n,
    } as const)

    await Effect.runPromise(
      ResearchExecutionRepo.appendInProgressEvent(
        researchJob,
        recursiveEvent(
          '660e8400-e29b-41d4-a716-44665544002a',
          workspaceId,
          researchJob.attempts,
        ),
      ).pipe(Effect.provide(layer)),
    )
    const persisted = JSON.parse(String(inserts[0]?.[4])) as Record<string, unknown>
    expect(persisted['jobId']).toBe(researchJobId)
    expect(persisted['attempt']).toBe(researchJob.attempts)
    expect(persisted['untrustedExtra']).toBeUndefined()

    for (const tampered of [
      recursiveEvent(
        '660e8400-e29b-41d4-a716-44665544002b',
        foreignWorkspaceId,
        researchJob.attempts,
      ),
      recursiveEvent(
        '660e8400-e29b-41d4-a716-44665544002c',
        workspaceId,
        researchJob.attempts + 1,
      ),
    ]) {
      const exit = await Effect.runPromiseExit(
        ResearchExecutionRepo.appendInProgressEvent(
          researchJob,
          tampered,
        ).pipe(Effect.provide(layer)),
      )
      expect(Exit.isFailure(exit)).toBe(true)
      if (Exit.isFailure(exit)) {
        expect(String(exit.cause)).toContain(ValidationError.name)
      }
    }
    expect(inserts).toHaveLength(1)
  })

  it('accepts exact recursive event replay and rejects an ID collision', async () => {
    const persisted = new Map<string, string>()
    const sqlLayer = SqlClientTest(async (query, params) => {
      if (query.includes('FROM job_queue')) {
        return [{ id: researchJobId, payload: researchJob.payload }]
      }
      if (query.includes('WITH inserted AS')) {
        const id = String(params?.[0])
        const canonical = JSON.stringify({
          workspaceId: params?.[1],
          entityId: params?.[2],
          eventType: params?.[3],
          payload: params?.[4],
        })
        const previous = persisted.get(id)
        if (previous !== undefined && previous !== canonical) {
          throw new Error('event-id-collision')
        }
        persisted.set(id, canonical)
        return [{ replay_verified: 1 }]
      }
      return []
    })
    const layer = Layer.provide(ResearchExecutionRepo.Default, sqlLayer)
    const event = (status: 'running' | 'partial') => ({
      id: EventJournalId.make('660e8400-e29b-41d4-a716-44665544002d'),
      workspaceId,
      entityType: 'research',
      entityId: runId,
      eventType: 'recursive-run-progress-committed',
      payload: {
        jobId: researchJobId,
        attempt: researchJob.attempts,
        workspaceId,
        requestId: `sha256:${'1'.repeat(64)}`,
        planId: `sha256:${'2'.repeat(64)}`,
        status,
        cancellation: 'none',
        recoveryCount: 0,
        expectedPartitions: 2,
        committedPartitions: 0,
        failedPartitions: 0,
      },
      cursor: 0n,
      createdAt: 0n,
    } as const)

    await Effect.runPromise(
      ResearchExecutionRepo.appendInProgressEvent(
        researchJob,
        event('running'),
      ).pipe(Effect.provide(layer)),
    )
    await Effect.runPromise(
      ResearchExecutionRepo.appendInProgressEvent(
        researchJob,
        event('running'),
      ).pipe(Effect.provide(layer)),
    )
    expect(persisted).toHaveLength(1)

    const collision = await Effect.runPromiseExit(
      ResearchExecutionRepo.appendInProgressEvent(
        researchJob,
        event('partial'),
      ).pipe(Effect.provide(layer)),
    )
    expect(Exit.isFailure(collision)).toBe(true)
    if (Exit.isFailure(collision)) {
      expect(String(collision.cause)).toContain(QueryError.name)
    }
  })

  it('rejects a stale attempt for append, completion, and failure without side effects', async () => {
    const calls: string[] = []
    const sqlLayer = SqlClientTest(async (query) => {
      calls.push(query)
      return []
    })
    const layer = Layer.provide(ResearchExecutionRepo.Default, sqlLayer)
    const append = ResearchExecutionRepo.appendInProgressEvent(
      researchJob,
      researchEvent('660e8400-e29b-41d4-a716-446655440010', 'retrieval-completed'),
    )
    const complete = ResearchExecutionRepo.complete({
      runId,
      job: researchJob,
      answer: { answer: 'Grounded answer', citations: [] },
      citations: [],
      event: researchEvent(
        '660e8400-e29b-41d4-a716-446655440011',
        'research-completed',
      ),
    })
    const fail = ResearchExecutionRepo.fail({
      runId,
      job: researchJob,
      event: researchEvent(
        '660e8400-e29b-41d4-a716-446655440012',
        'research-failed',
      ),
    })

    for (const transition of [append, complete, fail]) {
      const exit = await Effect.runPromiseExit(transition.pipe(Effect.provide(layer)))
      expect(Exit.isFailure(exit)).toBe(true)
      if (Exit.isFailure(exit)) {
        expect(String(exit.cause)).toContain(ResearchJobOwnershipLostError.name)
      }
    }

    expect(calls.filter((query) => query.includes('INSERT INTO event_journal'))).toHaveLength(0)
    expect(calls.join('\n')).toMatch(/attempts = \$4/i)
  })

  it('fences valid terminal transitions by job, run, workspace, and attempt', async () => {
    const calls: Array<{ readonly query: string; readonly params?: readonly unknown[] }> = []
    const sqlLayer = SqlClientTest(async (query, params) => {
      calls.push({ query, params })
      if (query.includes('SELECT jq.payload')) {
        return [{
          payload: JSON.stringify(researchJob.payload),
          project_id: projectId,
        }]
      }
      if (query.includes('COUNT(DISTINCT sv.id)')) return [{ count: 1 }]
      if (
        query.includes('FROM event_journal')
        && query.includes("event_type = 'citations-validated'")
      ) {
        return [{
          payload: {
            jobId: researchJob.id,
            attempt: researchJob.attempts,
            citationCount: 0,
          },
        }]
      }
      if (query.includes('SELECT id') && query.includes('FROM job_queue')) {
        return [{ id: researchJobId }]
      }
      if (query.includes('SELECT jq.id, rt.project_id')) {
        return [{ id: researchJobId, project_id: projectId }]
      }
      if (query.includes('UPDATE job_queue')) return [{ id: researchJobId }]
      if (query.includes('UPDATE research_runs')) return [{ id: runId }]
      if (query.includes('INSERT INTO research_run_control')) {
        return [{ run_id: runId }]
      }
      if (query.includes('INSERT INTO research_run_results')) return [{ run_id: runId }]
      return []
    })
    const layer = Layer.provide(ResearchExecutionRepo.Default, sqlLayer)

    await Effect.runPromise(
      ResearchExecutionRepo.complete({
        runId,
        job: researchJob,
        answer: { answer: 'Grounded answer', citations: [] },
        citations: [],
        event: researchEvent(
          '660e8400-e29b-41d4-a716-446655440013',
          'research-completed',
        ),
      }).pipe(Effect.provide(layer)),
    )
    await Effect.runPromise(
      ResearchExecutionRepo.fail({
        runId,
        job: researchJob,
        event: researchEvent(
          '660e8400-e29b-41d4-a716-446655440014',
          'research-failed',
        ),
      }).pipe(Effect.provide(layer)),
    )

    const ownership = calls.filter((call) => call.query.includes('UPDATE job_queue'))
    expect(ownership).toHaveLength(2)
    for (const call of ownership) {
      expect(call.query).toMatch(/entity_id = \$2/i)
      expect(call.query).toMatch(/workspace_id = \$3/i)
      expect(call.query).toMatch(/attempts = \$4/i)
      expect(call.params).toEqual([researchJobId, runId, workspaceId, 1])
    }
    const events = calls.filter((call) => call.query.includes('INSERT INTO event_journal'))
    expect(events).toHaveLength(2)
    expect(events.every((call) => call.params?.[1] === workspaceId)).toBe(true)
    expect(events.every((call) => call.params?.[2] === runId)).toBe(true)
  })

  it('rejects malformed serialized ownership payloads before terminal writes', async () => {
    const malformedPayloads = [
      '{',
      'null',
      '[]',
      JSON.stringify({
        projectId,
        sourceVersionIds: [foreignSourceVersionId],
      }),
    ]

    for (const payload of malformedPayloads) {
      const calls: string[] = []
      const layer = Layer.provide(
        ResearchExecutionRepo.Default,
        SqlClientTest(async (query) => {
          calls.push(query)
          if (query.includes('SELECT jq.payload')) {
            return [{ payload, project_id: projectId }]
          }
          return []
        }),
      )
      const exit = await Effect.runPromiseExit(
        ResearchExecutionRepo.complete({
          runId,
          job: researchJob,
          answer: { answer: 'Must not persist', citations: [] },
          citations: [],
          event: researchEvent(
            '660e8400-e29b-41d4-a716-44665544001c',
            'research-completed',
          ),
        }).pipe(Effect.provide(layer)),
      )

      expect(Exit.isFailure(exit)).toBe(true)
      if (Exit.isFailure(exit)) {
        expect(String(exit.cause)).toContain(ValidationError.name)
      }
      expect(calls.some((query) => query.includes('UPDATE job_queue'))).toBe(false)
      expect(calls.some((query) => query.includes('INSERT INTO'))).toBe(false)
    }
  })

  it('rejects duplicate citation IDs and citations outside the registered source set', async () => {
    const calls: string[] = []
    const layer = Layer.provide(
      ResearchExecutionRepo.Default,
      SqlClientTest(async (query) => {
        calls.push(query)
        return []
      }),
    )
    const citationId = CitationId.make('660e8400-e29b-41d4-a716-446655440017')
    const duplicateCitations = [
      {
        id: citationId,
        runId,
        sourceVersionId: registrationSourceVersionId,
        locator: 'lines:1-1',
        status: 'validated',
        createdAt: 0n,
      },
      {
        id: citationId,
        runId,
        sourceVersionId: registrationSourceVersionId,
        locator: 'lines:2-2',
        status: 'validated',
        createdAt: 0n,
      },
    ] as const
    const duplicateExit = await Effect.runPromiseExit(
      ResearchExecutionRepo.complete({
        runId,
        job: researchJob,
        answer: {
          answer: 'Duplicate IDs',
          citations: duplicateCitations.map(({ sourceVersionId, locator }) => ({
            sourceVersionId,
            locator,
          })),
        },
        citations: duplicateCitations,
        event: researchEvent(
          '660e8400-e29b-41d4-a716-446655440018',
          'research-completed',
        ),
      }).pipe(Effect.provide(layer)),
    )
    expect(Exit.isFailure(duplicateExit)).toBe(true)
    if (Exit.isFailure(duplicateExit)) {
      expect(String(duplicateExit.cause)).toContain(ValidationError.name)
    }

    const foreignCitation = {
      id: CitationId.make('660e8400-e29b-41d4-a716-446655440019'),
      runId,
      sourceVersionId: foreignSourceVersionId,
      locator: 'lines:1-1',
      status: 'validated',
      createdAt: 0n,
    } as const
    const foreignExit = await Effect.runPromiseExit(
      ResearchExecutionRepo.complete({
        runId,
        job: researchJob,
        answer: {
          answer: 'Foreign source',
          citations: [{
            sourceVersionId: foreignCitation.sourceVersionId,
            locator: foreignCitation.locator,
          }],
        },
        citations: [foreignCitation],
        event: researchEvent(
          '660e8400-e29b-41d4-a716-44665544001a',
          'research-completed',
        ),
      }).pipe(Effect.provide(layer)),
    )
    expect(Exit.isFailure(foreignExit)).toBe(true)
    if (Exit.isFailure(foreignExit)) {
      expect(String(foreignExit.cause)).toContain(ValidationError.name)
    }
    expect(calls).toHaveLength(0)
  })

  it('re-authorizes the persisted source set before terminal writes', async () => {
    const calls: string[] = []
    const layer = Layer.provide(
      ResearchExecutionRepo.Default,
      SqlClientTest(async (query) => {
        calls.push(query)
        if (query.includes('SELECT jq.payload')) {
          return [{ payload: researchJob.payload, project_id: projectId }]
        }
        if (query.includes('COUNT(DISTINCT sv.id)')) return [{ count: 0 }]
        return []
      }),
    )
    const exit = await Effect.runPromiseExit(
      ResearchExecutionRepo.complete({
        runId,
        job: researchJob,
        answer: { answer: 'Must not persist', citations: [] },
        citations: [],
        event: researchEvent(
          '660e8400-e29b-41d4-a716-44665544001b',
          'research-completed',
        ),
      }).pipe(Effect.provide(layer)),
    )
    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      expect(String(exit.cause)).toContain(AuthorizationError.name)
    }
    expect(calls.some((query) => query.includes('UPDATE job_queue'))).toBe(false)
    expect(calls.some((query) => query.includes('INSERT INTO'))).toBe(false)
  })

  it('rejects forged terminal event scope before any transaction write', async () => {
    const calls: string[] = []
    const sqlLayer = SqlClientTest(async (query) => {
      calls.push(query)
      return []
    })
    const layer = Layer.provide(ResearchExecutionRepo.Default, sqlLayer)

    const exit = await Effect.runPromiseExit(
      ResearchExecutionRepo.complete({
        runId,
        job: researchJob,
        answer: { answer: 'Must not persist', citations: [] },
        citations: [],
        event: researchEvent(
          '660e8400-e29b-41d4-a716-446655440015',
          'research-completed',
          foreignWorkspaceId,
        ),
      }).pipe(Effect.provide(layer)),
    )

    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      expect(String(exit.cause)).toContain(ResearchJobOwnershipLostError.name)
    }
    expect(calls).toHaveLength(0)
  })

  it('rejects an inconsistent registration aggregate before authorization or writes', async () => {
    const calls: string[] = []
    const sqlLayer = SqlClientTest(async (query) => {
      calls.push(query)
      return []
    })
    const layer = Layer.provide(ResearchExecutionRepo.Default, sqlLayer)

    const exit = await Effect.runPromiseExit(
      ResearchExecutionRepo.register({
        ...registrationInput,
        job: {
          ...registrationInput.job,
          workspaceId: foreignWorkspaceId,
        },
      }).pipe(Effect.provide(layer)),
    )

    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      expect(String(exit.cause)).toContain(ValidationError.name)
    }
    expect(calls).toHaveLength(0)
  })

  it('rejects forged research event types, cursors, payloads, and linkage without writes', async () => {
    const appendCases = [
      { eventType: 'ingestion-completed', payload: {} },
      {
        eventType: 'retrieval-completed',
        payload: { evidenceCount: 0, sourceVersionIds: [], extra: true },
      },
      {
        eventType: 'retrieval-completed',
        payload: { evidenceCount: 81, sourceVersionIds: [] },
      },
      {
        eventType: 'retrieval-completed',
        payload: { evidenceCount: 1, sourceVersionIds: [] },
      },
      {
        eventType: 'retrieval-completed',
        payload: { evidenceCount: 1, sourceVersionIds: [foreignSourceVersionId] },
      },
      {
        eventType: 'citations-validated',
        payload: { citationCount: -1 },
      },
      {
        eventType: 'citations-validated',
        payload: { citationCount: 0, arbitrary: 'payload' },
      },
    ] as const

    for (const [index, forged] of appendCases.entries()) {
      const calls: string[] = []
      const layer = Layer.provide(
        ResearchExecutionRepo.Default,
        SqlClientTest(async (query) => {
          calls.push(query)
          if (query.includes('FROM job_queue')) {
            return [{ id: researchJobId, payload: researchJob.payload }]
          }
          return []
        }),
      )
      const exit = await Effect.runPromiseExit(
        ResearchExecutionRepo.appendInProgressEvent(researchJob, {
          ...researchEvent(
            `660e8400-e29b-41d4-a716-4466554400${String(20 + index)}`,
            forged.eventType,
          ),
          payload: forged.payload,
          cursor: index === 0 ? 1n : 0n,
        }).pipe(Effect.provide(layer)),
      )
      expect(Exit.isFailure(exit)).toBe(true)
      if (Exit.isFailure(exit)) {
        expect(String(exit.cause)).toContain(ValidationError.name)
      }
      expect(calls.some((query) => query.includes('INSERT INTO'))).toBe(false)
      expect(calls.some((query) => /^\s*UPDATE /i.test(query))).toBe(false)
    }

    const terminalCases = [
      {
        transition: 'complete',
        event: {
          ...researchEvent(
            '660e8400-e29b-41d4-a716-446655440030',
            'research-completed',
          ),
          cursor: 1n,
        },
      },
      {
        transition: 'complete',
        event: {
          ...researchEvent(
            '660e8400-e29b-41d4-a716-446655440031',
            'research-completed',
          ),
          payload: { citationCount: 1 },
        },
      },
      {
        transition: 'complete',
        event: {
          ...researchEvent(
            '660e8400-e29b-41d4-a716-446655440032',
            'research-failed',
          ),
        },
      },
      {
        transition: 'fail',
        event: {
          ...researchEvent(
            '660e8400-e29b-41d4-a716-446655440033',
            'research-failed',
          ),
          payload: { errorTag: 'Unsafe tag!', message: 'Research failed' },
        },
      },
      {
        transition: 'fail',
        event: {
          ...researchEvent(
            '660e8400-e29b-41d4-a716-446655440034',
            'research-failed',
          ),
          payload: {
            errorTag: 'ResearchWorkflowError',
            message: 'secret upstream failure',
          },
        },
      },
      {
        transition: 'fail',
        event: {
          ...researchEvent(
            '660e8400-e29b-41d4-a716-446655440035',
            'retrieval-completed',
          ),
        },
      },
    ] as const

    for (const forged of terminalCases) {
      const calls: string[] = []
      const layer = Layer.provide(
        ResearchExecutionRepo.Default,
        SqlClientTest(async (query) => {
          calls.push(query)
          if (query.includes('SELECT jq.payload')) {
            return [{
              payload: researchJob.payload,
              project_id: projectId,
            }]
          }
          if (query.includes('SELECT id') && query.includes('FROM job_queue')) {
            return [{ id: researchJobId }]
          }
          if (query.includes('SELECT jq.id, rt.project_id')) {
            return [{ id: researchJobId, project_id: projectId }]
          }
          return []
        }),
      )
      const effect = forged.transition === 'complete'
        ? ResearchExecutionRepo.complete({
            runId,
            job: researchJob,
            answer: { answer: 'Must not persist', citations: [] },
            citations: [],
            event: forged.event,
          })
        : ResearchExecutionRepo.fail({
            runId,
            job: researchJob,
            event: forged.event,
          })
      const exit = await Effect.runPromiseExit(effect.pipe(Effect.provide(layer)))
      expect(Exit.isFailure(exit)).toBe(true)
      if (Exit.isFailure(exit)) {
        expect(String(exit.cause)).toContain(ValidationError.name)
      }
      expect(calls.some((query) => /^\s*UPDATE /i.test(query))).toBe(false)
      expect(calls.some((query) => query.includes('INSERT INTO'))).toBe(false)
    }
  })

  it('persists only normalized valid research transition event payloads', async () => {
    const calls: Array<{ readonly query: string; readonly params?: readonly unknown[] }> = []
    const layer = Layer.provide(
      ResearchExecutionRepo.Default,
      SqlClientTest(async (query, params) => {
        calls.push({ query, params })
        if (query.includes('SELECT jq.payload')) {
          return [{ payload: researchJob.payload, project_id: projectId }]
        }
        if (query.includes('FROM job_queue')) {
          return [{ id: researchJobId, payload: researchJob.payload }]
        }
        if (query.includes('COUNT(DISTINCT sv.id)')) return [{ count: 1 }]
        if (
          query.includes('FROM event_journal')
          && query.includes("event_type = 'citations-validated'")
        ) {
          return [{
            payload: {
              jobId: researchJob.id,
              attempt: researchJob.attempts,
              citationCount: 0,
            },
          }]
        }
        if (query.includes('UPDATE job_queue')) return [{ id: researchJobId }]
        if (query.includes('UPDATE research_runs')) return [{ id: runId }]
        if (query.includes('INSERT INTO research_run_control')) {
          return [{ run_id: runId }]
        }
        if (query.includes('INSERT INTO research_run_results')) return [{ run_id: runId }]
        return []
      }),
    )

    await Effect.runPromise(
      ResearchExecutionRepo.appendInProgressEvent(
        researchJob,
        researchEvent(
          '660e8400-e29b-41d4-a716-446655440036',
          'retrieval-completed',
        ),
      ).pipe(Effect.provide(layer)),
    )
    await Effect.runPromise(
      ResearchExecutionRepo.appendInProgressEvent(
        researchJob,
        researchEvent(
          '660e8400-e29b-41d4-a716-446655440037',
          'citations-validated',
        ),
      ).pipe(Effect.provide(layer)),
    )
    await Effect.runPromise(
      ResearchExecutionRepo.complete({
        runId,
        job: researchJob,
        answer: { answer: 'Grounded answer', citations: [] },
        citations: [],
        event: researchEvent(
          '660e8400-e29b-41d4-a716-446655440038',
          'research-completed',
        ),
      }).pipe(Effect.provide(layer)),
    )
    await Effect.runPromise(
      ResearchExecutionRepo.fail({
        runId,
        job: researchJob,
        event: researchEvent(
          '660e8400-e29b-41d4-a716-446655440039',
          'research-failed',
        ),
      }).pipe(Effect.provide(layer)),
    )

    const inserts = calls.filter((call) =>
      call.query.includes('INSERT INTO event_journal')
    )
    expect(inserts).toHaveLength(4)
    expect(inserts.map((call) => call.params?.[4])).toEqual([
      JSON.stringify({
        jobId: researchJob.id,
        attempt: researchJob.attempts,
        evidenceCount: 0,
        sourceVersionIds: [],
      }),
      JSON.stringify({
        jobId: researchJob.id,
        attempt: researchJob.attempts,
        citationCount: 0,
      }),
      JSON.stringify({
        jobId: researchJob.id,
        attempt: researchJob.attempts,
        citationCount: 0,
      }),
      JSON.stringify({
        jobId: researchJob.id,
        attempt: researchJob.attempts,
        errorTag: 'ResearchWorkflowError',
        message: 'Research failed',
      }),
    ])
  })
})
