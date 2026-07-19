import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { Effect, Layer, Option } from 'effect'
import postgres from 'postgres'
import type postgresTypes from 'postgres'
import {
  DirectoryRootId,
  DirectorySnapshotId,
  DirectoryRelativePath,
  EventJournalId,
  JobQueueId,
  ManifestEntryId,
  InvalidDirectoryIngestionTransitionError,
  ProjectId,
  SourceId,
  WorkspaceId,
} from '@struct/domain'
import {
  DirectoryControlConflictError,
  DirectoryControlRepo,
  SqlClientLive,
} from '@struct/persistence'
import { registerDirectory } from './directories'
import { loadDirectoryEvents } from './directory-events'
import {
  controlDirectoryJob,
  getDirectoryJobStatus,
} from './ingestion-jobs'

const DATABASE_URL = process.env['DATABASE_URL']
const describeIf = DATABASE_URL ? describe : describe.skip
const workspaceId = WorkspaceId.make('e50e8400-e29b-41d4-a716-446655440001')
const foreignWorkspaceId =
  WorkspaceId.make('e50e8400-e29b-41d4-a716-446655440002')
const projectId = ProjectId.make('e50e8400-e29b-41d4-a716-446655440003')
const sourceId = SourceId.make('e50e8400-e29b-41d4-a716-446655440004')
const rootId = DirectoryRootId.make('e50e8400-e29b-41d4-a716-446655440005')
const snapshotId =
  DirectorySnapshotId.make('e50e8400-e29b-41d4-a716-446655440006')
const jobId = JobQueueId.make('e50e8400-e29b-41d4-a716-446655440007')
const failedEntryId =
  ManifestEntryId.make('e50e8400-e29b-41d4-a716-446655440040')
const unsupportedEntryId =
  ManifestEntryId.make('e50e8400-e29b-41d4-a716-446655440041')

describeIf('directory API routes with PostgreSQL', () => {
  let sql: postgresTypes.Sql
  let layer: Layer.Layer<DirectoryControlRepo>
  let eventSequence = 8

  const provide = <A, E>(
    effect: Effect.Effect<A, E, DirectoryControlRepo>,
  ): Effect.Effect<A, E> => effect.pipe(Effect.provide(layer))

  beforeAll(async () => {
    if (!DATABASE_URL) return
    sql = postgres(DATABASE_URL, { max: 4, idle_timeout: 5 })
    layer = Layer.provide(DirectoryControlRepo.Default, SqlClientLive(sql))
    await sql.unsafe('DELETE FROM workspaces WHERE id IN ($1, $2)', [
      workspaceId,
      foreignWorkspaceId,
    ])
    await sql.unsafe(
      `INSERT INTO workspaces (id, name)
       VALUES ($1, 'Directory API'), ($2, 'Foreign')`,
      [workspaceId, foreignWorkspaceId],
    )
    await sql.unsafe(
      `INSERT INTO projects (id, workspace_id, name)
       VALUES ($1, $2, 'Directory project')`,
      [projectId, workspaceId],
    )
  })

  afterAll(async () => {
    if (!sql) return
    await sql.unsafe('DELETE FROM job_queue WHERE id = $1', [jobId])
    await sql.unsafe('DELETE FROM sources WHERE id = $1', [sourceId])
    await sql.unsafe('DELETE FROM workspaces WHERE id IN ($1, $2)', [
      workspaceId,
      foreignWorkspaceId,
    ])
    await sql.end()
  })

  const randomEventId = () => EventJournalId.make(
    `e50e8400-e29b-41d4-a716-4466554400${String(eventSequence++).padStart(2, '0')}`,
  )

  it('enforces scope and transitions while replaying idempotent commands once', async () => {
    const registered = await Effect.runPromise(registerDirectory({
      workspaceId,
      projectId,
      name: 'notes',
    }, {
      randomSourceId: () => sourceId,
      randomDirectoryRootId: () => rootId,
      randomSnapshotId: () => snapshotId,
      randomJobId: () => jobId,
      randomEventId,
      register: (input) => provide(DirectoryControlRepo.register(input)),
    }))
    expect(registered.status).toBe('ready')

    const missingProjectRegistration = await Effect.runPromise(
      registerDirectory({
        workspaceId: foreignWorkspaceId,
        projectId,
        name: 'foreign-notes',
      }, {
        randomSourceId: () =>
          SourceId.make('e50e8400-e29b-41d4-a716-446655440050'),
        randomDirectoryRootId: () =>
          DirectoryRootId.make('e50e8400-e29b-41d4-a716-446655440051'),
        randomSnapshotId: () =>
          DirectorySnapshotId.make('e50e8400-e29b-41d4-a716-446655440052'),
        randomJobId: () =>
          JobQueueId.make('e50e8400-e29b-41d4-a716-446655440053'),
        randomEventId,
        register: (input) => provide(DirectoryControlRepo.register(input)),
      }).pipe(Effect.flip),
    )
    expect(missingProjectRegistration).toBeInstanceOf(
      DirectoryControlConflictError,
    )
    if (
      !(missingProjectRegistration instanceof DirectoryControlConflictError)
    ) {
      throw new Error('Expected a directory control conflict')
    }
    expect(missingProjectRegistration.reason).toBe('scope-not-found')

    const foreignRead = await Effect.runPromise(getDirectoryJobStatus({
      workspaceId: foreignWorkspaceId,
      projectId,
      jobId,
    }, {
      findStatus: (workspace, project, job) =>
        provide(DirectoryControlRepo.findStatus(workspace, project, job)),
    }))
    expect(Option.isNone(foreignRead)).toBe(true)

    const foreignCommand = await Effect.runPromise(
      controlDirectoryJob(
        { workspaceId: foreignWorkspaceId, projectId, jobId },
        'cancel',
        'foreign-cancel',
        {
          randomEventId,
          command: (input) => provide(DirectoryControlRepo.command(input)),
        },
      ).pipe(Effect.flip),
    )
    expect(foreignCommand).toBeInstanceOf(DirectoryControlConflictError)

    await sql.unsafe(
      `INSERT INTO directory_snapshots (
         id, directory_root_id, workspace_id, project_id, manifest_digest
       ) VALUES ($1, $2, $3, $4, $5)`,
      [snapshotId, rootId, workspaceId, projectId, `sha256:${'a'.repeat(64)}`],
    )
    await sql.unsafe(
      `INSERT INTO directory_manifest_entries (
         id, snapshot_id, directory_root_id, workspace_id, project_id,
         relative_path, status, byte_length, content_hash, unsupported_reason
       ) VALUES
         ($1, $2, $3, $4, $5, $6, 'included', 12, $7, NULL),
         ($8, $2, $3, $4, $5, $9, 'unsupported', 0, NULL, 'unsupported-extension')`,
      [
        failedEntryId,
        snapshotId,
        rootId,
        workspaceId,
        projectId,
        DirectoryRelativePath.make('private/locked.md'),
        `sha256:${'b'.repeat(64)}`,
        unsupportedEntryId,
        DirectoryRelativePath.make('archive.bin'),
      ],
    )
    await sql.unsafe(
      `UPDATE directory_ingestion_jobs SET status = 'running' WHERE job_id = $1`,
      [jobId],
    )
    await sql.unsafe(
      `INSERT INTO directory_ingestion_idempotency_results (
         job_id, idempotency_key, attempt, result
       ) VALUES ($1, 'failed-entry', 1, $2::jsonb)`,
      [jobId, JSON.stringify({ errorTag: 'DirectoryPermissionError' })],
    )
    await sql.unsafe(
      `INSERT INTO directory_ingestion_work_records (
         job_id, entry_id, idempotency_key, outcome, content_key, result
       ) VALUES ($1, $2, 'failed-entry', 'unresolved', NULL, $3::jsonb)`,
      [
        jobId,
        failedEntryId,
        JSON.stringify({ errorTag: 'DirectoryPermissionError' }),
      ],
    )
    await sql.unsafe(
      `INSERT INTO directory_ingestion_checkpoints (
         job_id, sequence, entry_id, idempotency_key, outcome
       ) VALUES ($1, 1, $2, 'failed-entry', 'unresolved')`,
      [jobId, failedEntryId],
    )
    const projected = await Effect.runPromise(getDirectoryJobStatus(
      { workspaceId, projectId, jobId },
      {
        findStatus: (workspace, project, job) =>
          provide(DirectoryControlRepo.findStatus(workspace, project, job)),
      },
    ))
    expect(Option.getOrThrow(projected).counts).toEqual({
      total: 2,
      processed: 1,
      succeeded: 0,
      failed: 1,
      unsupported: 1,
      pending: 0,
    })
    expect(Option.getOrThrow(projected).failures).toEqual([{
      entryId: failedEntryId,
      relativePath: DirectoryRelativePath.make('private/locked.md'),
      errorTag: 'DirectoryPermissionError',
    }])
    await sql.unsafe(
      `UPDATE job_queue SET status = 'in-progress', attempts = 1
       WHERE id = $1`,
      [jobId],
    )
    const deps = {
      randomEventId,
      command: (input: Parameters<typeof DirectoryControlRepo.command>[0]) =>
        provide(DirectoryControlRepo.command(input)),
    }
    const paused = await Effect.runPromise(controlDirectoryJob(
      { workspaceId, projectId, jobId },
      'pause',
      'pause-once',
      deps,
    ))
    expect(paused).toMatchObject({ replayed: false, status: { status: 'paused' } })
    const replay = await Effect.runPromise(controlDirectoryJob(
      { workspaceId, projectId, jobId },
      'pause',
      'pause-once',
      deps,
    ))
    expect(replay).toMatchObject({ replayed: true, status: { status: 'paused' } })

    const invalid = await Effect.runPromise(
      controlDirectoryJob(
        { workspaceId, projectId, jobId },
        'pause',
        'pause-invalid',
        deps,
      ).pipe(Effect.flip),
    )
    expect(invalid).toBeInstanceOf(InvalidDirectoryIngestionTransitionError)

    const counts = await sql.unsafe(
      `SELECT
         (SELECT COUNT(*)::int FROM directory_ingestion_commands
          WHERE job_id = $1) AS commands,
         (SELECT COUNT(*)::int FROM event_journal
          WHERE entity_type = 'directory-ingestion'
            AND entity_id = $1
            AND event_type = 'directory-paused') AS pause_events`,
      [jobId],
    )
    expect(counts[0]).toMatchObject({ commands: 1, pause_events: 1 })

    await Effect.runPromise(controlDirectoryJob(
      { workspaceId, projectId, jobId },
      'resume',
      'resume-once',
      deps,
    ))
    const resumedCursorRows = await sql.unsafe(
      `SELECT cursor FROM event_journal
       WHERE entity_type = 'directory-ingestion'
         AND entity_id = $1
         AND event_type = 'directory-resumed'`,
      [jobId],
    )
    await Effect.runPromise(controlDirectoryJob(
      { workspaceId, projectId, jobId },
      'cancel',
      'cancel-once',
      deps,
    ))
    const reconnectReplay = await Effect.runPromise(loadDirectoryEvents(
      workspaceId,
      projectId,
      jobId,
      BigInt(String(resumedCursorRows[0]?.['cursor'])),
      {
        listEventsAfter: (workspace, project, job, cursor, limit) =>
          provide(DirectoryControlRepo.listEventsAfter(
            workspace,
            project,
            job,
            cursor,
            limit,
          )),
        findStatus: (workspace, project, job) =>
          provide(DirectoryControlRepo.findStatus(
            workspace,
            project,
            job,
          )).pipe(Effect.map(Option.getOrThrow)),
      },
    ))
    expect(reconnectReplay.map((event) => event.type)).toEqual([
      'directory-cancelled',
    ])
    expect(reconnectReplay[0]?.status.status).toBe('cancelled')
  })
})
