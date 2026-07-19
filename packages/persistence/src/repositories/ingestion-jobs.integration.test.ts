import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { Effect, Layer, Option, Schema } from 'effect'
import postgres from 'postgres'
import type postgresTypes from 'postgres'
import {
  DirectoryIngestionEntryCommit,
  DirectorySnapshotId,
  InvalidDirectoryIngestionTransitionError,
  JobQueueId,
  ManifestEntryId,
  WorkspaceId,
} from '@struct/domain'
import {
  DirectoryIngestionJobRepo,
  SqlClientLive,
} from '../index.js'

const DATABASE_URL = process.env['DATABASE_URL']
const describeIf = DATABASE_URL ? describe : describe.skip
const workspaceId = WorkspaceId.make('d30e8400-e29b-41d4-a716-446655440000')
const snapshotId = DirectorySnapshotId.make('d30e8400-e29b-41d4-a716-446655440001')

function makeJobId(suffix: string): typeof JobQueueId.Type {
  return JobQueueId.make(`d30e8400-e29b-41d4-a716-44665544${suffix}`)
}

describeIf('DirectoryIngestionJobRepo (PostgreSQL)', () => {
  let sql: postgresTypes.Sql
  let layer: Layer.Layer<DirectoryIngestionJobRepo>

  beforeAll(async () => {
    if (!DATABASE_URL) return
    sql = postgres(DATABASE_URL, { max: 6, idle_timeout: 5 })
    layer = Layer.provide(DirectoryIngestionJobRepo.Default, SqlClientLive(sql))
    await sql.unsafe('DELETE FROM job_queue WHERE workspace_id = $1', [workspaceId])
    await sql.unsafe('DELETE FROM workspaces WHERE id = $1', [workspaceId])
    await sql.unsafe(
      `INSERT INTO workspaces (id, name) VALUES ($1, 'Directory jobs')`,
      [workspaceId],
    )
  })

  afterAll(async () => {
    if (!sql) return
    await sql.unsafe('DELETE FROM job_queue WHERE workspace_id = $1', [workspaceId])
    await sql.unsafe('DELETE FROM workspaces WHERE id = $1', [workspaceId])
    await sql.end()
  })

  const run = <A, E>(effect: Effect.Effect<A, E, DirectoryIngestionJobRepo>) =>
    Effect.runPromise(effect.pipe(Effect.provide(layer)))

  const countArtifacts = async (jobId: typeof JobQueueId.Type) => {
    const rows = await sql.unsafe(
      `SELECT
         (SELECT COUNT(*)::int FROM directory_ingestion_idempotency_results WHERE job_id = $1) AS idempotency,
         (SELECT COUNT(*)::int FROM directory_ingestion_work_records WHERE job_id = $1) AS work,
         (SELECT COUNT(*)::int FROM directory_ingestion_checkpoints WHERE job_id = $1) AS checkpoints,
         (SELECT COUNT(*)::int FROM event_journal WHERE entity_type = 'directory-ingestion' AND entity_id = $1) AS events`,
      [jobId],
    )
    return {
      idempotency: rows[0]?.['idempotency'],
      work: rows[0]?.['work'],
      checkpoints: rows[0]?.['checkpoints'],
      events: rows[0]?.['events'],
    }
  }

  it('allows only one concurrent claim', async () => {
    const jobId = makeJobId('0002')
    await run(DirectoryIngestionJobRepo.create({
      jobId,
      workspaceId,
      snapshotId,
      maxAttempts: 3,
    }))

    const directClaim = await Effect.runPromise(
      DirectoryIngestionJobRepo.transition(
        jobId,
        workspaceId,
        'claim',
      ).pipe(
        Effect.provide(layer),
        Effect.flip,
      ),
    )
    expect(directClaim).toBeInstanceOf(InvalidDirectoryIngestionTransitionError)
    const unleased = await sql.unsafe(
      `SELECT status, lease_token, lease_expires_at FROM job_queue WHERE id = $1`,
      [jobId],
    )
    expect(unleased[0]).toMatchObject({
      status: 'pending',
      lease_token: null,
      lease_expires_at: null,
    })

    const claims = await Promise.all([
      run(DirectoryIngestionJobRepo.claimNext(30_000)),
      run(DirectoryIngestionJobRepo.claimNext(30_000)),
    ])
    expect(claims.filter(Option.isSome)).toHaveLength(1)
  })

  it('reclaims an expired lease, fences the stale worker before every write, and replays one checkpoint', async () => {
    const jobId = makeJobId('0003')
    await run(DirectoryIngestionJobRepo.create({
      jobId,
      workspaceId,
      snapshotId,
      maxAttempts: 3,
    }))
    const firstClaim = await run(DirectoryIngestionJobRepo.claimNext(30_000))
    expect(Option.isSome(firstClaim)).toBe(true)
    if (Option.isNone(firstClaim)) throw new Error('expected first claim')
    await sql.unsafe(
      `UPDATE job_queue SET lease_expires_at = NOW() - INTERVAL '1 second'
       WHERE id = $1`,
      [jobId],
    )
    expect(await run(
      DirectoryIngestionJobRepo.renewLease(firstClaim.value, 30_000),
    )).toEqual({
      _tag: 'StaleWorkerNoOp',
      reason: 'lease-token-or-attempt-mismatch',
    })
    const expiredInput = Schema.decodeUnknownSync(DirectoryIngestionEntryCommit)({
      jobId,
      workspaceId,
      entryId: ManifestEntryId.make('d30e8400-e29b-41d4-a716-446655440009'),
      idempotencyKey: 'entry:expired',
      attempt: firstClaim.value.attempt,
      leaseToken: firstClaim.value.leaseToken,
      outcome: 'completed',
      contentKey: `artifact://sha256/${'a'.repeat(64)}`,
      result: { indexed: true },
    })
    expect(await run(
      DirectoryIngestionJobRepo.commitEntry(expiredInput),
    )).toMatchObject({
      _tag: 'StaleWorkerNoOp',
      acknowledged: false,
    })
    expect(await run(DirectoryIngestionJobRepo.recoverExpired())).toEqual({
      requeued: 1,
      exhausted: 0,
    })
    const secondClaim = await run(DirectoryIngestionJobRepo.claimNext(30_000))
    expect(Option.isSome(secondClaim)).toBe(true)
    if (Option.isNone(secondClaim)) throw new Error('expected reclaimed job')
    expect(secondClaim.value.attempt).toBe(2)

    const foreignWorkspaceId = WorkspaceId.make(
      'd30e8400-e29b-41d4-a716-446655440099',
    )
    const foreignTransition = await Effect.runPromise(
      DirectoryIngestionJobRepo.transition(
        jobId,
        foreignWorkspaceId,
        'cancel',
      ).pipe(
        Effect.provide(layer),
        Effect.flip,
      ),
    )
    expect(foreignTransition).toMatchObject({ _tag: 'QueryError' })
    const stillOwned = await sql.unsafe(
      `SELECT status FROM job_queue WHERE id = $1 AND workspace_id = $2`,
      [jobId, workspaceId],
    )
    expect(stillOwned[0]?.['status']).toBe('in-progress')

    const staleInput = Schema.decodeUnknownSync(DirectoryIngestionEntryCommit)({
      jobId,
      workspaceId,
      entryId: ManifestEntryId.make('d30e8400-e29b-41d4-a716-446655440010'),
      idempotencyKey: 'entry:stale',
      attempt: firstClaim.value.attempt,
      leaseToken: firstClaim.value.leaseToken,
      outcome: 'completed',
      contentKey: `artifact://sha256/${'a'.repeat(64)}`,
      result: { indexed: true },
    })
    expect(await run(DirectoryIngestionJobRepo.commitEntry(staleInput))).toEqual({
      _tag: 'StaleWorkerNoOp',
      reason: 'lease-token-or-attempt-mismatch',
      acknowledged: false,
    })
    expect(await countArtifacts(jobId)).toEqual({
      idempotency: 0,
      work: 0,
      checkpoints: 0,
      events: 0,
    })

    const currentInput = Schema.decodeUnknownSync(DirectoryIngestionEntryCommit)({
      ...staleInput,
      idempotencyKey: 'entry:current',
      attempt: secondClaim.value.attempt,
      leaseToken: secondClaim.value.leaseToken,
    })
    expect(await run(DirectoryIngestionJobRepo.commitEntry(currentInput))).toEqual({
      _tag: 'Committed',
      checkpointSequence: 1,
      result: { indexed: true },
      acknowledged: true,
    })
    expect(await run(DirectoryIngestionJobRepo.commitEntry({
      ...currentInput,
      result: { indexed: false },
    }))).toEqual({
      _tag: 'Replayed',
      checkpointSequence: 1,
      result: { indexed: true },
      acknowledged: true,
    })
    expect(await countArtifacts(jobId)).toEqual({
      idempotency: 1,
      work: 1,
      checkpoints: 1,
      events: 1,
    })

    const unresolved = Schema.decodeUnknownSync(DirectoryIngestionEntryCommit)({
      ...currentInput,
      entryId: ManifestEntryId.make('d30e8400-e29b-41d4-a716-446655440011'),
      idempotencyKey: 'entry:permission-failure',
      outcome: 'unresolved',
      contentKey: null,
      result: { errorTag: 'DirectoryPermissionError' },
    })
    expect(await run(DirectoryIngestionJobRepo.commitEntry(unresolved))).toMatchObject({
      _tag: 'Committed',
      checkpointSequence: 2,
    })
    const partial = await sql.unsafe(
      `SELECT outcome FROM directory_ingestion_work_records
       WHERE job_id = $1 AND idempotency_key = 'entry:permission-failure'`,
      [jobId],
    )
    expect(partial[0]?.['outcome']).toBe('unresolved')
    const unresolvedCompletion = await Effect.runPromise(
      DirectoryIngestionJobRepo.transition(
        jobId,
        workspaceId,
        'complete',
      ).pipe(
        Effect.provide(layer),
        Effect.flip,
      ),
    )
    expect(unresolvedCompletion).toBeInstanceOf(
      InvalidDirectoryIngestionTransitionError,
    )
    const resolved = Schema.decodeUnknownSync(DirectoryIngestionEntryCommit)({
      ...currentInput,
      entryId: unresolved.entryId,
      idempotencyKey: 'entry:permission-recovered',
    })
    expect(await run(
      DirectoryIngestionJobRepo.commitEntry(resolved),
    )).toMatchObject({
      _tag: 'Committed',
      checkpointSequence: 3,
    })
    expect(await run(
      DirectoryIngestionJobRepo.transition(jobId, workspaceId, 'complete'),
    )).toBe('completed')
    const completedEvents = await sql.unsafe(
      `SELECT COUNT(*)::int AS count
       FROM event_journal
       WHERE entity_type = 'directory-ingestion'
         AND entity_id = $1
         AND event_type = 'directory-completed'`,
      [jobId],
    )
    expect(completedEvents[0]?.['count']).toBe(1)
  })

  it('exhausts the retry budget and validates cancellation and terminal transitions', async () => {
    const exhaustedJobId = makeJobId('0004')
    await run(DirectoryIngestionJobRepo.create({
      jobId: exhaustedJobId,
      workspaceId,
      snapshotId,
      maxAttempts: 1,
    }))
    const claim = await run(DirectoryIngestionJobRepo.claimNext(30_000))
    expect(Option.isSome(claim)).toBe(true)
    await sql.unsafe(
      `UPDATE job_queue SET lease_expires_at = NOW() - INTERVAL '1 second'
       WHERE id = $1`,
      [exhaustedJobId],
    )
    expect(await run(DirectoryIngestionJobRepo.recoverExpired())).toEqual({
      requeued: 0,
      exhausted: 1,
    })
    const retryError = await Effect.runPromise(
      DirectoryIngestionJobRepo.transition(
        exhaustedJobId,
        workspaceId,
        'retry',
      ).pipe(
        Effect.provide(layer),
        Effect.flip,
      ),
    )
    expect(retryError).toBeInstanceOf(InvalidDirectoryIngestionTransitionError)

    const cancelledJobId = makeJobId('0005')
    await run(DirectoryIngestionJobRepo.create({
      jobId: cancelledJobId,
      workspaceId,
      snapshotId,
      maxAttempts: 3,
    }))
    const cancelledClaim = await run(DirectoryIngestionJobRepo.claimNext(30_000))
    expect(Option.isSome(cancelledClaim)).toBe(true)
    expect(await run(
      DirectoryIngestionJobRepo.transition(
        cancelledJobId,
        workspaceId,
        'cancel',
      ),
    )).toBe('cancelled')
    const invalid = await Effect.runPromise(
      DirectoryIngestionJobRepo.transition(
        cancelledJobId,
        workspaceId,
        'resume',
      ).pipe(
        Effect.provide(layer),
        Effect.flip,
      ),
    )
    expect(invalid).toBeInstanceOf(InvalidDirectoryIngestionTransitionError)
  })
})
