import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { Effect, Exit, Layer } from 'effect'
import postgres from 'postgres'
import type postgresTypes from 'postgres'
import {
  EventJournal,
  EventJournalId,
  JobQueue,
  JobQueueId,
  ProjectId,
  SourceId,
  SourceVersionId,
  WorkspaceId,
} from '@struct/domain'
import {
  IngestionEventValidationError,
  JobQueueRepo,
  SqlClientLive,
} from '../index.js'

const DATABASE_URL = process.env['DATABASE_URL']
const describeIf = DATABASE_URL ? describe : describe.skip
const workspaceId = WorkspaceId.make('c70e8400-e29b-41d4-a716-446655440000')
const projectId = ProjectId.make('c70e8400-e29b-41d4-a716-446655440001')
const sourceId = SourceId.make('c70e8400-e29b-41d4-a716-446655440002')
const foreignSourceId = SourceId.make('c70e8400-e29b-41d4-a716-446655440003')
const sourceVersionId = SourceVersionId.make(
  'c70e8400-e29b-41d4-a716-446655440004',
)
const foreignSourceVersionId = SourceVersionId.make(
  'c70e8400-e29b-41d4-a716-446655440005',
)
const forgedRawRef =
  'artifact://sha256/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const normalizedRef =
  'artifact://sha256/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
const manifestRef =
  'artifact://sha256/cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc'
const contentHash =
  'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'

type Transition = 'append-event' | 'complete' | 'pending' | 'fail'
const transitions: ReadonlyArray<Transition> = [
  'append-event',
  'complete',
  'pending',
  'fail',
]
const jobIds = {
  'append-event': JobQueueId.make('c70e8400-e29b-41d4-a716-446655440010'),
  complete: JobQueueId.make('c70e8400-e29b-41d4-a716-446655440011'),
  pending: JobQueueId.make('c70e8400-e29b-41d4-a716-446655440012'),
  fail: JobQueueId.make('c70e8400-e29b-41d4-a716-446655440013'),
} as const
const eventIds = {
  'append-event': EventJournalId.make(
    'c70e8400-e29b-41d4-a716-446655440020',
  ),
  complete: EventJournalId.make('c70e8400-e29b-41d4-a716-446655440021'),
  pending: EventJournalId.make('c70e8400-e29b-41d4-a716-446655440022'),
  fail: EventJournalId.make('c70e8400-e29b-41d4-a716-446655440023'),
} as const
const nonretryableJobId = JobQueueId.make(
  'c70e8400-e29b-41d4-a716-446655440014',
)
const nonretryableEventId = EventJournalId.make(
  'c70e8400-e29b-41d4-a716-446655440024',
)

const validEvent = (transition: Transition): typeof EventJournal.Type => ({
  id: eventIds[transition],
  workspaceId,
  entityType: 'ingestion',
  entityId: sourceId,
  eventType: transition === 'append-event'
    ? 'file-processed'
    : transition === 'complete'
      ? 'ingestion-completed'
      : 'ingestion-failed',
  payload: transition === 'append-event'
    ? {
        jobId: jobIds[transition],
        attempt: 1,
        sourceVersionId,
        manifestRef,
        contentHash,
        byteLength: 12,
      }
    : transition === 'complete'
      ? {
          jobId: jobIds[transition],
          attempt: 1,
          sourceVersionId,
          manifestRef,
          contentHash,
        }
      : {
          jobId: jobIds[transition],
          attempt: transition === 'fail' ? 3 : 1,
          errorTag: 'IngestionFailure',
          message: 'Ingestion failed',
          retryable: true,
        },
  cursor: 0n,
  createdAt: BigInt(Date.now()),
})

const runTransition = (
  transition: Transition,
  job: typeof JobQueue.Type,
  event: typeof EventJournal.Type,
) => {
  switch (transition) {
    case 'append-event':
      return JobQueueRepo.appendInProgressEvent(job, event)
    case 'complete':
      return JobQueueRepo.markCompleted(job, event)
    case 'pending':
      return JobQueueRepo.markPending(job, event)
    case 'fail':
      return JobQueueRepo.markFailed(job, event)
  }
}

describeIf('ingestion transition event contracts (PostgreSQL)', () => {
  let sql: postgresTypes.Sql
  let layer: Layer.Layer<JobQueueRepo>
  let jobs: Record<Transition, typeof JobQueue.Type>

  beforeAll(async () => {
    if (!DATABASE_URL) return
    sql = postgres(DATABASE_URL, { max: 2, idle_timeout: 5 })
    layer = Layer.provide(JobQueueRepo.Default, SqlClientLive(sql))
    await sql.unsafe(
      `INSERT INTO workspaces (id, name) VALUES ($1, 'Event Contract')`,
      [workspaceId],
    )
    await sql.unsafe(
      `INSERT INTO projects (id, workspace_id, name)
       VALUES ($1, $2, 'Event Contract')`,
      [projectId, workspaceId],
    )
    await sql.unsafe(
      `INSERT INTO sources (id, project_id, name, kind)
       VALUES
         ($1, $3, 'owned.txt', 'document'),
         ($2, $3, 'foreign.txt', 'document')`,
      [sourceId, foreignSourceId, projectId],
    )
    await sql.unsafe(
      `INSERT INTO source_versions (
         id, source_id, version, artifact_ref, content_hash
       )
       VALUES
         ($1, $3, 1, $5, $6),
         ($2, $4, 1, $5, $6)`,
      [
        sourceVersionId,
        foreignSourceVersionId,
        sourceId,
        foreignSourceId,
        manifestRef,
        contentHash,
      ],
    )
    await sql.unsafe(
      `INSERT INTO job_queue (
         id, workspace_id, entity_type, entity_id, status, payload,
         attempts, max_attempts, created_at, updated_at
       )
       VALUES
         ($1, $5, 'ingestion', $6, 'in-progress',
          '{"byteLength":12}'::jsonb, 1, 3, NOW(), NOW() - INTERVAL '1 hour'),
         ($2, $5, 'ingestion', $6, 'in-progress',
          '{"byteLength":12}'::jsonb, 1, 3, NOW(), NOW() - INTERVAL '1 hour'),
         ($3, $5, 'ingestion', $6, 'in-progress',
          '{"byteLength":12}'::jsonb, 1, 3, NOW(), NOW() - INTERVAL '1 hour'),
         ($4, $5, 'ingestion', $6, 'in-progress',
          '{"byteLength":12}'::jsonb, 3, 3, NOW(), NOW() - INTERVAL '1 hour')`,
      [
        jobIds['append-event'],
        jobIds.complete,
        jobIds.pending,
        jobIds.fail,
        workspaceId,
        sourceId,
      ],
    )
    jobs = Object.fromEntries(
      await Promise.all(
        transitions.map(async (transition) => [
          transition,
          await Effect.runPromise(
            JobQueueRepo.findById(jobIds[transition]).pipe(
              Effect.provide(layer),
            ),
          ),
        ]),
      ),
    ) as Record<Transition, typeof JobQueue.Type>
  })

  afterAll(async () => {
    if (!sql) return
    await sql.unsafe(`DELETE FROM event_journal WHERE workspace_id = $1`, [
      workspaceId,
    ])
    await sql.unsafe(`DELETE FROM job_queue WHERE workspace_id = $1`, [
      workspaceId,
    ])
    await sql.unsafe(
      `DELETE FROM source_versions WHERE source_id = ANY($1::uuid[])`,
      [[sourceId, foreignSourceId]],
    )
    await sql.unsafe(
      `DELETE FROM sources WHERE id = ANY($1::uuid[])`,
      [[sourceId, foreignSourceId]],
    )
    await sql.unsafe(`DELETE FROM projects WHERE id = $1`, [projectId])
    await sql.unsafe(`DELETE FROM workspaces WHERE id = $1`, [workspaceId])
    await sql.end()
  })

  const snapshot = async () => {
    const jobRows = await sql.unsafe(
      `SELECT id, status, updated_at
       FROM job_queue
       WHERE workspace_id = $1
       ORDER BY id`,
      [workspaceId],
    )
    const eventRows = await sql.unsafe(
      `SELECT id FROM event_journal WHERE workspace_id = $1 ORDER BY id`,
      [workspaceId],
    )
    return {
      jobs: jobRows.map((row) => ({
        id: String(row['id']),
        status: String(row['status']),
        updatedAt: String(row['updated_at']),
      })),
      events: eventRows.map((row) => String(row['id'])),
    }
  }

  const expectValidationFailure = async (
    transition: Transition,
    event: typeof EventJournal.Type,
    candidateJob = jobs[transition],
  ) => {
    const exit = await Effect.runPromiseExit(
      runTransition(transition, candidateJob, event).pipe(
        Effect.provide(layer),
      ),
    )
    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      expect(String(exit.cause)).toContain(IngestionEventValidationError.name)
    }
  }

  it('rejects forged payloads and invalid top-level metadata on every path with no side effects', async () => {
    const before = await snapshot()

    for (const transition of transitions) {
      const valid = validEvent(transition)
      await expectValidationFailure(transition, {
        ...valid,
        eventType: transition === 'append-event'
          ? 'ingestion-completed'
          : 'file-processed',
      })
      await expectValidationFailure(transition, { ...valid, cursor: 1n })
      await expectValidationFailure(transition, {
        ...valid,
        id: 'not-a-uuid' as typeof valid.id,
      })
      await expectValidationFailure(transition, {
        ...valid,
        id: String(valid.id).toUpperCase() as typeof valid.id,
      })
      await expectValidationFailure(transition, {
        ...valid,
        createdAt: -1n,
      })
      await expectValidationFailure(transition, {
        ...valid,
        createdAt: 0 as unknown as bigint,
      })
      await expectValidationFailure(transition, {
        ...valid,
        createdAt: BigInt(Number.MAX_SAFE_INTEGER) + 1n,
      })
      await expectValidationFailure(transition, {
        ...valid,
        payload: { ...valid.payload, researchRunId: 'cross-domain' },
      })
    }

    expect(await snapshot()).toEqual(before)
  })

  it('rejects foreign provenance, mismatched artifacts, unsafe failures, and retry inversion atomically', async () => {
    const before = await snapshot()
    const append = validEvent('append-event')
    const complete = validEvent('complete')
    await expectValidationFailure('append-event', {
      ...append,
      payload: {
        ...append.payload,
        rawRef: forgedRawRef,
      },
    })
    await expectValidationFailure('append-event', {
      ...append,
      payload: {
        ...append.payload,
        jobId: jobIds.complete,
      },
    })
    await expectValidationFailure('append-event', {
      ...append,
      payload: {
        ...append.payload,
        attempt: 2,
      },
    })
    await expectValidationFailure('append-event', {
      ...append,
      payload: { ...append.payload, sourceVersionId: foreignSourceVersionId },
    })
    await expectValidationFailure('append-event', {
      ...append,
      payload: { ...append.payload, byteLength: 13 },
    })
    await expectValidationFailure('append-event', {
      ...append,
      payload: {
        ...append.payload,
        manifestRef:
          'artifact://sha256/dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
      },
    })
    await expectValidationFailure('complete', {
      ...complete,
      payload: {
        ...complete.payload,
        manifestRef:
          'artifact://sha256/dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
      },
    })
    await expectValidationFailure('complete', {
      ...complete,
      payload: { ...complete.payload, sourceVersionId: foreignSourceVersionId },
    })
    await expectValidationFailure('pending', {
      ...validEvent('pending'),
      payload: {
        ...validEvent('pending').payload,
        errorTag: 'StorageReadError',
        message: '/private/secret',
      },
    })
    await expectValidationFailure('fail', {
      ...validEvent('fail'),
      payload: {
        ...validEvent('fail').payload,
        errorTag: 'bad-tag!',
        message: 'Ingestion failed',
      },
    })
    await expectValidationFailure('pending', {
      ...validEvent('pending'),
      payload: {
        ...validEvent('pending').payload,
        retryable: false,
      },
    })
    await expectValidationFailure('pending', {
      ...validEvent('pending'),
      payload: {
        ...validEvent('pending').payload,
        retryable: 'yes',
      },
    })
    await expectValidationFailure(
      'pending',
      validEvent('pending'),
      { ...jobs.pending, attempts: 3 },
    )
    await expectValidationFailure(
      'fail',
      validEvent('fail'),
      { ...jobs.fail, attempts: 1 },
    )

    expect(await snapshot()).toEqual(before)
  })

  it('accepts all four valid controls and persists authoritative bounded payloads', async () => {
    for (const transition of transitions) {
      await Effect.runPromise(
        runTransition(
          transition,
          jobs[transition],
          validEvent(transition),
        ).pipe(Effect.provide(layer)),
      )
    }

    const statusRows = await sql.unsafe(
      `SELECT id, status FROM job_queue WHERE workspace_id = $1 ORDER BY id`,
      [workspaceId],
    )
    expect(Object.fromEntries(statusRows.map((row) => [
      String(row['id']),
      String(row['status']),
    ]))).toEqual({
      [jobIds['append-event']]: 'in-progress',
      [jobIds.complete]: 'completed',
      [jobIds.pending]: 'pending',
      [jobIds.fail]: 'failed',
    })
    const events = await sql.unsafe(
      `SELECT id, workspace_id, entity_type, entity_id, event_type, payload
       FROM event_journal
       WHERE workspace_id = $1
       ORDER BY id`,
      [workspaceId],
    )
    expect(events).toHaveLength(4)
    expect(events.every((row) =>
      String(row['workspace_id']) === workspaceId
      && row['entity_type'] === 'ingestion'
      && String(row['entity_id']) === sourceId)).toBe(true)
    expect(events.map((row) =>
      typeof row['payload'] === 'string'
        ? JSON.parse(row['payload'])
        : row['payload'])).toEqual([
      {
        attempt: 1,
        byteLength: 12,
        contentHash,
        jobId: jobIds['append-event'],
        manifestRef,
        normalizedRef,
        sourceVersionId,
      },
      {
        attempt: 1,
        contentHash,
        jobId: jobIds.complete,
        manifestRef,
        sourceVersionId,
      },
      {
        attempt: 1,
        errorTag: 'IngestionFailure',
        jobId: jobIds.pending,
        message: 'Ingestion failed',
        retryable: true,
      },
      {
        attempt: 3,
        errorTag: 'IngestionFailure',
        jobId: jobIds.fail,
        message: 'Ingestion failed',
        retryable: true,
      },
    ])
  })

  it('terminal-fails a first-attempt nonretryable failure but rejects a retryable failure with budget', async () => {
    await sql.unsafe(
      `INSERT INTO job_queue (
         id, workspace_id, entity_type, entity_id, status, payload,
         attempts, max_attempts, created_at, updated_at
       )
       VALUES (
         $1, $2, 'ingestion', $3, 'in-progress',
         '{"byteLength":12}'::jsonb, 1, 3, NOW(), NOW()
       )`,
      [nonretryableJobId, workspaceId, sourceId],
    )
    const owned = await Effect.runPromise(
      JobQueueRepo.findById(nonretryableJobId).pipe(Effect.provide(layer)),
    )
    const candidate = {
      ...validEvent('fail'),
      id: nonretryableEventId,
      payload: {
        jobId: nonretryableJobId,
        attempt: 1,
        errorTag: 'ValidationError',
        message: 'Ingestion failed',
        retryable: true,
      },
    }
    await expectValidationFailure('fail', candidate, owned)
    const [unchanged] = await sql.unsafe(
      `SELECT status FROM job_queue WHERE id = $1`,
      [nonretryableJobId],
    )
    expect(unchanged?.['status']).toBe('in-progress')

    await Effect.runPromise(
      JobQueueRepo.markFailed(owned, {
        ...candidate,
        payload: {
          ...candidate.payload,
          retryable: false,
        },
      }).pipe(Effect.provide(layer)),
    )
    const [persisted] = await sql.unsafe(
      `SELECT job.status, event.payload
       FROM job_queue job
       JOIN event_journal event ON event.id = $2
       WHERE job.id = $1`,
      [nonretryableJobId, nonretryableEventId],
    )
    expect(persisted?.['status']).toBe('failed')
    const persistedPayload = typeof persisted?.['payload'] === 'string'
      ? JSON.parse(persisted['payload'])
      : persisted?.['payload']
    expect(persistedPayload).toEqual({
      jobId: String(nonretryableJobId),
      attempt: 1,
      errorTag: 'ValidationError',
      message: 'Ingestion failed',
      retryable: false,
    })
  })
})
