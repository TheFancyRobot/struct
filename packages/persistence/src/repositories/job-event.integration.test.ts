import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { Effect, Layer } from 'effect'
import postgres from 'postgres'
import type postgresTypes from 'postgres'
import {
  JobQueueRepo,
  SqlClientLive,
} from '../index.js'

const DATABASE_URL = process.env['DATABASE_URL']
const describeIf = DATABASE_URL ? describe : describe.skip
const workspaceId = 'a60e8400-e29b-41d4-a716-446655440000'
const exhaustedJobId = 'a60e8400-e29b-41d4-a716-446655440001'
const requeuedJobId = 'a60e8400-e29b-41d4-a716-446655440002'
const exhaustedSourceId = 'a60e8400-e29b-41d4-a716-446655440003'
const requeuedSourceId = 'a60e8400-e29b-41d4-a716-446655440004'
const triggerName = 'test_fail_stale_ingestion_event'
const functionName = 'test_fail_stale_ingestion_event_fn'

describeIf('JobQueueRepo stale ingestion recovery (PostgreSQL)', () => {
  let sql: postgresTypes.Sql

  beforeAll(async () => {
    if (!DATABASE_URL) return
    sql = postgres(DATABASE_URL, { max: 2, idle_timeout: 5 })
    await sql.unsafe(`DELETE FROM event_journal WHERE workspace_id = $1`, [workspaceId])
    await sql.unsafe(`DELETE FROM job_queue WHERE workspace_id = $1`, [workspaceId])
    await sql.unsafe(`DELETE FROM workspaces WHERE id = $1`, [workspaceId])
    await sql.unsafe(`INSERT INTO workspaces (id, name) VALUES ($1, 'Stale Recovery')`, [workspaceId])
    await sql.unsafe(
      `INSERT INTO job_queue (
         id, workspace_id, entity_type, entity_id, status, payload,
         attempts, max_attempts, created_at, updated_at
       )
       VALUES
         ($1, $3, 'ingestion', $4, 'in-progress', '{}'::jsonb, 3, 3, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '2 hours'),
         ($2, $3, 'ingestion', $5, 'in-progress', '{}'::jsonb, 1, 3, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '2 hours')`,
      [
        exhaustedJobId,
        requeuedJobId,
        workspaceId,
        exhaustedSourceId,
        requeuedSourceId,
      ],
    )
  })

  afterAll(async () => {
    if (!sql) return
    await sql.unsafe(`DROP TRIGGER IF EXISTS ${triggerName} ON event_journal`)
    await sql.unsafe(`DROP FUNCTION IF EXISTS ${functionName}()`)
    await sql.unsafe(`DELETE FROM event_journal WHERE workspace_id = $1`, [workspaceId])
    await sql.unsafe(`DELETE FROM job_queue WHERE workspace_id = $1`, [workspaceId])
    await sql.unsafe(`DELETE FROM workspaces WHERE id = $1`, [workspaceId])
    await sql.end()
  })

  it('atomically rolls back a failed terminal event, then recovers idempotently', async () => {
    const layer = Layer.provide(JobQueueRepo.Default, SqlClientLive(sql))
    await sql.unsafe(
      `CREATE OR REPLACE FUNCTION ${functionName}()
       RETURNS trigger
       LANGUAGE plpgsql
       AS $$
       BEGIN
         IF NEW.workspace_id = '${workspaceId}'::uuid
            AND NEW.event_type = 'ingestion-failed' THEN
           RAISE EXCEPTION 'injected-terminal-event-failure';
         END IF;
         RETURN NEW;
       END
       $$`,
    )
    await sql.unsafe(
      `CREATE TRIGGER ${triggerName}
       BEFORE INSERT ON event_journal
       FOR EACH ROW EXECUTE FUNCTION ${functionName}()`,
    )

    const failedExit = await Effect.runPromiseExit(
      JobQueueRepo.recoverStaleIngestionJobs(Date.now()).pipe(Effect.provide(layer)),
    )
    expect(failedExit._tag).toBe('Failure')
    const afterInjectedFailure = await sql.unsafe(
      `SELECT id, status FROM job_queue WHERE workspace_id = $1 ORDER BY id`,
      [workspaceId],
    )
    expect(afterInjectedFailure.map((row) => row['status'])).toEqual([
      'in-progress',
      'in-progress',
    ])
    const noSplitEvent = await sql.unsafe(
      `SELECT COUNT(*)::int AS count FROM event_journal WHERE workspace_id = $1`,
      [workspaceId],
    )
    expect(Number(noSplitEvent[0]?.['count'])).toBe(0)

    await sql.unsafe(`DROP TRIGGER ${triggerName} ON event_journal`)
    const recovered = await Effect.runPromise(
      JobQueueRepo.recoverStaleIngestionJobs(Date.now()).pipe(Effect.provide(layer)),
    )
    expect(recovered.requeued.map((job) => String(job.id))).toEqual([requeuedJobId])
    expect(recovered.failed.map((job) => String(job.id))).toEqual([exhaustedJobId])

    const terminal = await sql.unsafe(
      `SELECT job.status, event.event_type, event.payload
       FROM job_queue job
       LEFT JOIN event_journal event
         ON event.entity_type = 'ingestion'
        AND event.entity_id = job.entity_id
       WHERE job.id = $1`,
      [exhaustedJobId],
    )
    expect(terminal).toHaveLength(1)
    expect(terminal[0]?.['status']).toBe('failed')
    expect(terminal[0]?.['event_type']).toBe('ingestion-failed')
    expect(terminal[0]?.['payload']).toEqual({
      errorTag: 'StaleIngestionJobExhausted',
      message: 'Ingestion failed',
    })

    const repeated = await Effect.runPromise(
      JobQueueRepo.recoverStaleIngestionJobs(Date.now()).pipe(Effect.provide(layer)),
    )
    expect(repeated).toEqual({ requeued: [], failed: [] })
    const eventCount = await sql.unsafe(
      `SELECT COUNT(*)::int AS count
       FROM event_journal
       WHERE workspace_id = $1
         AND entity_id = $2
         AND event_type = 'ingestion-failed'`,
      [workspaceId, exhaustedSourceId],
    )
    expect(Number(eventCount[0]?.['count'])).toBe(1)
  })
})
