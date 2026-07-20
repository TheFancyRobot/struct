import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { Effect, Layer } from 'effect'
import postgres from 'postgres'
import type postgresTypes from 'postgres'
import {
  JobQueueRepo,
  SqlClientLive,
} from '@struct/persistence'
import {
  JobQueueId,
  ProjectId,
  SourceId,
  SourceVersionId,
  StorageReadError,
  UnsupportedSourceTypeError,
  WorkspaceId,
} from '@struct/domain'
import {
  processOneIngestionJob,
  type IngestionWorkerDeps,
} from './ingest-source'

const DATABASE_URL = process.env['DATABASE_URL']
const describeIf = DATABASE_URL ? describe : describe.skip

const workspaceId = WorkspaceId.make('7a0e8400-e29b-41d4-a716-446655440000')
const projectId = ProjectId.make('7a0e8400-e29b-41d4-a716-446655440001')
const sourceId = SourceId.make('7a0e8400-e29b-41d4-a716-446655440002')
const sourceVersionId = SourceVersionId.make('7a0e8400-e29b-41d4-a716-446655440003')

const cases = [
  {
    name: 'nonretryable first attempt',
    jobId: JobQueueId.make('7a0e8400-e29b-41d4-a716-446655440010'),
    attempts: 0,
    maxAttempts: 3,
    expectedAttempts: 1,
    expectedStatus: 'failed',
    expectedRetryable: false,
    failure: new UnsupportedSourceTypeError({
      name: 'source.exe',
      mediaType: 'application/octet-stream',
      message: 'Unsupported source type',
    }),
  },
  {
    name: 'retryable failure with remaining budget',
    jobId: JobQueueId.make('7a0e8400-e29b-41d4-a716-446655440011'),
    attempts: 0,
    maxAttempts: 3,
    expectedAttempts: 1,
    expectedStatus: 'pending',
    expectedRetryable: true,
    failure: new StorageReadError({
      ref: 'staged://7a0e8400-e29b-41d4-a716-446655440100/notes.md',
      reason: 'filesystem-unavailable',
      message: 'Staged artifact could not be read',
    }),
  },
  {
    name: 'exhausted retryable failure',
    jobId: JobQueueId.make('7a0e8400-e29b-41d4-a716-446655440012'),
    attempts: 2,
    maxAttempts: 3,
    expectedAttempts: 3,
    expectedStatus: 'failed',
    expectedRetryable: true,
    failure: new StorageReadError({
      ref: 'staged://7a0e8400-e29b-41d4-a716-446655440100/notes.md',
      reason: 'filesystem-unavailable',
      message: 'Staged artifact could not be read',
    }),
  },
] as const

async function cleanup(sql: postgresTypes.Sql): Promise<void> {
  await sql.unsafe('DELETE FROM event_journal WHERE workspace_id = $1', [workspaceId])
  await sql.unsafe('DELETE FROM job_queue WHERE workspace_id = $1', [workspaceId])
  await sql.unsafe('DELETE FROM source_versions WHERE source_id = $1', [sourceId])
  await sql.unsafe('DELETE FROM sources WHERE id = $1', [sourceId])
  await sql.unsafe('DELETE FROM projects WHERE id = $1', [projectId])
  await sql.unsafe('DELETE FROM workspaces WHERE id = $1', [workspaceId])
}

describeIf('ingestion retryability real PostgreSQL controls', () => {
  let sql: postgresTypes.Sql
  let jobLayer: Layer.Layer<JobQueueRepo, never, never>

  beforeAll(async () => {
    if (!DATABASE_URL) return
    sql = postgres(DATABASE_URL, { max: 1, idle_timeout: 5 })
    jobLayer = Layer.provide(JobQueueRepo.Default, SqlClientLive(sql))
    await cleanup(sql)
    await sql.unsafe(
      "INSERT INTO workspaces (id, name, created_at, updated_at) VALUES ($1, 'Retryability Workspace', NOW(), NOW())",
      [workspaceId],
    )
    await sql.unsafe(
      "INSERT INTO projects (id, workspace_id, name, created_at, updated_at) VALUES ($1, $2, 'Retryability Project', NOW(), NOW())",
      [projectId, workspaceId],
    )
    await sql.unsafe(
      "INSERT INTO sources (id, project_id, kind, name, created_at, updated_at) VALUES ($1, $2, 'document', 'notes.md', NOW(), NOW())",
      [sourceId, projectId],
    )
  })

  afterAll(async () => {
    if (!sql) return
    await cleanup(sql)
    await sql.end()
  })

  it('persists the exact terminal/requeue matrix without duplicate or late events', async () => {
    for (const testCase of cases) {
      await sql.unsafe('DELETE FROM event_journal WHERE workspace_id = $1', [workspaceId])
      await sql.unsafe('DELETE FROM job_queue WHERE workspace_id = $1', [workspaceId])
      await sql.unsafe(
        `INSERT INTO job_queue (
           id, workspace_id, entity_type, entity_id, status, payload,
           attempts, max_attempts, created_at, updated_at
         ) VALUES (
           $1, $2, 'ingestion', $3, 'pending',
           jsonb_build_object(
             'stagedRef', 'staged://7a0e8400-e29b-41d4-a716-446655440100/notes.md',
             'name', 'notes.md',
             'mediaType', 'text/markdown',
             'byteLength', 10,
             'projectId', $4::text
           ),
           $5, $6, NOW(), NOW()
         )`,
        [
          testCase.jobId,
          workspaceId,
          sourceId,
          projectId,
          testCase.attempts,
          testCase.maxAttempts,
        ],
      )

      const deps: IngestionWorkerDeps = {
        now: () => BigInt(Date.now()),
        randomSourceVersionId: () => sourceVersionId,
        staleAfterMs: 300_000,
        heartbeatIntervalMs: 10_000,
        jobs: {
          recoverStaleIngestionJobs: (staleAfterMs) =>
            JobQueueRepo.recoverStaleIngestionJobs(staleAfterMs).pipe(
              Effect.provide(jobLayer),
            ),
          claimNextIngestionJob: () =>
            JobQueueRepo.claimNextIngestionJob().pipe(Effect.provide(jobLayer)),
          renewLease: (job) =>
            JobQueueRepo.renewLease(job).pipe(Effect.provide(jobLayer)),
          appendInProgressEvent: (job, event) =>
            JobQueueRepo.appendInProgressEvent(job, event).pipe(
              Effect.provide(jobLayer),
            ),
          markCompleted: (job, event) =>
            JobQueueRepo.markCompleted(job, event).pipe(Effect.provide(jobLayer)),
          markPending: (job, event) =>
            JobQueueRepo.markPending(job, event).pipe(Effect.provide(jobLayer)),
          markFailed: (job, event) =>
            JobQueueRepo.markFailed(job, event).pipe(Effect.provide(jobLayer)),
        },
        sourceVersions: {
          findBySourceId: () => Effect.succeed([]),
          createForIngestionAttempt: (_job, version) => Effect.succeed(version),
        },
        textIndex: {
          indexText: () => Effect.void,
        },
        ingestion: {
          ingestTextSource: () => Effect.fail(testCase.failure),
        },
      }

      const result = await Effect.runPromise(processOneIngestionJob(deps))
      expect(result, testCase.name).toEqual({
        processed: true,
        jobId: testCase.jobId,
      })

      const [job] = await sql.unsafe(
        'SELECT status, attempts FROM job_queue WHERE id = $1',
        [testCase.jobId],
      )
      const events = await sql.unsafe(
        `SELECT event_type, payload
         FROM event_journal
         WHERE workspace_id = $1 AND entity_id = $2
         ORDER BY cursor`,
        [workspaceId, sourceId],
      )
      const eventPayload = typeof events[0]?.['payload'] === 'string'
        ? JSON.parse(events[0]['payload'])
        : events[0]?.['payload']
      expect(job, testCase.name).toMatchObject({
        status: testCase.expectedStatus,
        attempts: testCase.expectedAttempts,
      })
      expect(events, testCase.name).toHaveLength(1)
      expect({
        event_type: events[0]?.['event_type'],
        payload: eventPayload,
      }, testCase.name).toMatchObject({
        event_type: 'ingestion-failed',
        payload: {
          message: 'Ingestion failed',
          retryable: testCase.expectedRetryable,
        },
      })
      expect(JSON.stringify(eventPayload), testCase.name).not.toContain(
        'filesystem-unavailable',
      )

      if (testCase.expectedStatus === 'failed') {
        await expect(
          Effect.runPromise(processOneIngestionJob(deps)),
          `${testCase.name} replay`,
        ).resolves.toEqual({ processed: false })
        const [{ count }] = await sql.unsafe(
          `SELECT COUNT(*)::int AS count
           FROM event_journal
           WHERE workspace_id = $1 AND entity_id = $2`,
          [workspaceId, sourceId],
        )
        expect(count, `${testCase.name} replay`).toBe(1)
      }
    }
  })
})
