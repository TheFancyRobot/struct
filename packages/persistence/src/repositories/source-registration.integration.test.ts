import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { Effect, Layer } from 'effect'
import postgres from 'postgres'
import type postgresTypes from 'postgres'
import {
  EventJournalId,
  JobQueueId,
  ProjectId,
  SourceId,
  WorkspaceId,
  type EventJournal,
  type JobQueue,
  type Source,
} from '@struct/domain'
import {
  SourceRegistrationRepo,
  SqlClientLive,
  type SourceRegistrationInput,
} from '../index.js'

const DATABASE_URL = process.env['DATABASE_URL']
const describeIf = DATABASE_URL ? describe : describe.skip

const workspaceId = WorkspaceId.make('a20e8400-e29b-41d4-a716-446655440000')
const foreignWorkspaceId = WorkspaceId.make('a20e8400-e29b-41d4-a716-446655440001')
const projectId = ProjectId.make('a20e8400-e29b-41d4-a716-446655440002')
const foreignProjectId = ProjectId.make('a20e8400-e29b-41d4-a716-446655440003')
const createdAt = 1_768_435_200_000n

function sourceId(sequence: number): typeof SourceId.Type {
  return SourceId.make(`a20e8400-e29b-41d4-a716-44665544${String(sequence).padStart(4, '0')}`)
}

function jobId(sequence: number): typeof JobQueueId.Type {
  return JobQueueId.make(`a20e8400-e29b-41d4-a716-55665544${String(sequence).padStart(4, '0')}`)
}

function eventId(sequence: number): typeof EventJournalId.Type {
  return EventJournalId.make(`a20e8400-e29b-41d4-a716-66665544${String(sequence).padStart(4, '0')}`)
}

function registration(sequence: number): SourceRegistrationInput {
  const id = sourceId(sequence)
  const queuedJobId = jobId(sequence)
  const source: typeof Source.Type = {
    id,
    projectId,
    name: `notes-${sequence}.md`,
    kind: 'document',
    createdAt,
    updatedAt: createdAt,
  }
  const job: typeof JobQueue.Type = {
    id: queuedJobId,
    workspaceId,
    entityType: 'ingestion',
    entityId: id,
    status: 'pending',
    payload: {
      stagedRef: `staged://a20e8400-e29b-41d4-a716-446655449999/notes-${sequence}.md`,
      name: source.name,
      mediaType: 'text/markdown',
      byteLength: 12,
      sourceId: id,
      projectId,
    },
    attempts: 0,
    maxAttempts: 3,
    createdAt,
    updatedAt: createdAt,
  }
  const event: typeof EventJournal.Type = {
    id: eventId(sequence),
    workspaceId,
    entityType: 'ingestion',
    entityId: id,
    eventType: 'ingestion-requested',
    payload: {
      sourceId: id,
      jobId: queuedJobId,
      stagedRef: job.payload['stagedRef'],
      mediaType: job.payload['mediaType'],
      byteLength: job.payload['byteLength'],
    },
    cursor: 0n,
    createdAt,
  }
  return { source, job, event }
}

function withStagedRef(
  input: SourceRegistrationInput,
  stagedRef: string,
): SourceRegistrationInput {
  return {
    ...input,
    job: {
      ...input.job,
      payload: { ...input.job.payload, stagedRef },
    },
    event: {
      ...input.event,
      payload: { ...input.event.payload, stagedRef },
    },
  }
}

async function cleanup(sql: postgresTypes.Sql): Promise<void> {
  await sql.unsafe(
    `DELETE FROM event_journal WHERE workspace_id = ANY($1::uuid[])`,
    [[workspaceId, foreignWorkspaceId]],
  )
  await sql.unsafe(
    `DELETE FROM job_queue WHERE workspace_id = ANY($1::uuid[])`,
    [[workspaceId, foreignWorkspaceId]],
  )
  await sql.unsafe(
    `DELETE FROM sources WHERE project_id = ANY($1::uuid[])`,
    [[projectId, foreignProjectId]],
  )
  await sql.unsafe(
    `DELETE FROM projects WHERE id = ANY($1::uuid[])`,
    [[projectId, foreignProjectId]],
  )
  await sql.unsafe(
    `DELETE FROM workspaces WHERE id = ANY($1::uuid[])`,
    [[workspaceId, foreignWorkspaceId]],
  )
}

describeIf('SourceRegistrationRepo aggregate boundary (PostgreSQL)', () => {
  let sql: postgresTypes.Sql
  let layer: Layer.Layer<SourceRegistrationRepo>

  beforeAll(async () => {
    if (!DATABASE_URL) return
    sql = postgres(DATABASE_URL, { max: 1, idle_timeout: 5 })
    await cleanup(sql)
    await sql.unsafe(
      `INSERT INTO workspaces (id, name) VALUES ($1, 'Registration Workspace'), ($2, 'Foreign Workspace')`,
      [workspaceId, foreignWorkspaceId],
    )
    await sql.unsafe(
      `INSERT INTO projects (id, workspace_id, name)
       VALUES ($1, $2, 'Registration Project'), ($3, $4, 'Foreign Project')`,
      [projectId, workspaceId, foreignProjectId, foreignWorkspaceId],
    )
    layer = Layer.provide(SourceRegistrationRepo.Default, SqlClientLive(sql))
  })

  afterAll(async () => {
    if (sql) {
      await cleanup(sql)
      await sql.end()
    }
  })

  it('rejects cross-scope and forged aggregates without persisting partial rows', async () => {
    const crossWorkspace = registration(10)
    const crossProject = registration(11)
    const wrongJobEntity = registration(12)
    const wrongEventType = registration(13)
    const wrongJobPayload = registration(14)
    const wrongEventPayload = registration(15)
    const invalidScheme = withStagedRef(
      registration(16),
      'https://attacker.invalid/notes.md',
    )
    const malformedUuid = withStagedRef(
      registration(17),
      'staged://not-a-uuid/notes.md',
    )
    const mixedCaseAlias = withStagedRef(
      registration(22),
      'staged://a20e8400-e29b-41d4-a716-446655449999/Notes.MD',
    )
    const traversalRef = withStagedRef(
      registration(18),
      'staged://a20e8400-e29b-41d4-a716-446655449999/../secret.md',
    )
    const oversizedRef = withStagedRef(
      registration(19),
      `staged://a20e8400-e29b-41d4-a716-446655449999/${'a'.repeat(256)}.md`,
    )
    const trailingNewline = withStagedRef(
      registration(21),
      'staged://a20e8400-e29b-41d4-a716-446655449999/notes.md\n',
    )
    const attempts: ReadonlyArray<SourceRegistrationInput> = [
      {
        ...crossWorkspace,
        job: { ...crossWorkspace.job, workspaceId: foreignWorkspaceId },
        event: { ...crossWorkspace.event, workspaceId: foreignWorkspaceId },
      },
      {
        ...crossProject,
        source: { ...crossProject.source, projectId: foreignProjectId },
        job: {
          ...crossProject.job,
          payload: { ...crossProject.job.payload, projectId: foreignProjectId },
        },
      },
      {
        ...wrongJobEntity,
        job: { ...wrongJobEntity.job, entityId: sourceId(98) },
      },
      {
        ...wrongEventType,
        event: { ...wrongEventType.event, eventType: 'research-started' },
      },
      {
        ...wrongJobPayload,
        job: {
          ...wrongJobPayload.job,
          payload: { ...wrongJobPayload.job.payload, sourceId: sourceId(98) },
        },
      },
      {
        ...wrongEventPayload,
        event: {
          ...wrongEventPayload.event,
          payload: { ...wrongEventPayload.event.payload, jobId: jobId(98) },
        },
      },
      invalidScheme,
      malformedUuid,
      mixedCaseAlias,
      traversalRef,
      oversizedRef,
      trailingNewline,
    ]

    for (const input of attempts) {
      const exit = await Effect.runPromiseExit(
        SourceRegistrationRepo.create(input).pipe(Effect.provide(layer)),
      )
      expect(exit._tag).toBe('Failure')
      if (
        input === invalidScheme
        || input === malformedUuid
        || input === mixedCaseAlias
        || input === traversalRef
        || input === oversizedRef
        || input === trailingNewline
      ) {
        expect(String(exit)).toContain('ValidationError')
      }
    }

    const attemptedSourceIds = attempts.map((input) => input.source.id)
    const attemptedJobIds = attempts.map((input) => input.job.id)
    const attemptedEventIds = attempts.map((input) => input.event.id)
    const [sourceCount] = await sql.unsafe(
      `SELECT COUNT(*)::int AS count FROM sources WHERE id = ANY($1::uuid[])`,
      [attemptedSourceIds],
    )
    const [jobCount] = await sql.unsafe(
      `SELECT COUNT(*)::int AS count FROM job_queue WHERE id = ANY($1::uuid[])`,
      [attemptedJobIds],
    )
    const [eventCount] = await sql.unsafe(
      `SELECT COUNT(*)::int AS count FROM event_journal WHERE id = ANY($1::uuid[])`,
      [attemptedEventIds],
    )
    expect(sourceCount?.['count']).toBe(0)
    expect(jobCount?.['count']).toBe(0)
    expect(eventCount?.['count']).toBe(0)
  })

  it('rejects sensitive extras, unknown keys, invalid types, and unbounded values without side effects', async () => {
    const jobSourceText = registration(30)
    const jobAbsolutePath = registration(31)
    const eventSourceText = registration(32)
    const eventSecret = registration(33)
    const nestedUnknown = registration(34)
    const invalidType = registration(35)
    const oversizedByteLength = registration(36)
    const invalidEventId = registration(37)
    const invalidEventCursor = registration(38)
    const invalidEventCreatedAt = registration(39)
    const attempts: ReadonlyArray<SourceRegistrationInput> = [
      {
        ...jobSourceText,
        job: {
          ...jobSourceText.job,
          payload: {
            ...jobSourceText.job.payload,
            sourceText: 'private source contents',
          },
        },
      },
      {
        ...jobAbsolutePath,
        job: {
          ...jobAbsolutePath.job,
          payload: {
            ...jobAbsolutePath.job.payload,
            absolutePath: '/private/project/notes.md',
          },
        },
      },
      {
        ...eventSourceText,
        event: {
          ...eventSourceText.event,
          payload: {
            ...eventSourceText.event.payload,
            sourceText: 'private source contents',
          },
        },
      },
      {
        ...eventSecret,
        event: {
          ...eventSecret.event,
          payload: {
            ...eventSecret.event.payload,
            secret: 'synthetic-secret',
          },
        },
      },
      {
        ...nestedUnknown,
        job: {
          ...nestedUnknown.job,
          payload: {
            ...nestedUnknown.job.payload,
            metadata: { nested: { values: Array.from({ length: 1_000 }) } },
          },
        },
      },
      {
        ...invalidType,
        job: {
          ...invalidType.job,
          payload: { ...invalidType.job.payload, name: 42 },
        },
      } as unknown as SourceRegistrationInput,
      {
        ...oversizedByteLength,
        job: {
          ...oversizedByteLength.job,
          payload: {
            ...oversizedByteLength.job.payload,
            byteLength: Number.MAX_SAFE_INTEGER,
          },
        },
        event: {
          ...oversizedByteLength.event,
          payload: {
            ...oversizedByteLength.event.payload,
            byteLength: Number.MAX_SAFE_INTEGER,
          },
        },
      },
      {
        ...invalidEventId,
        event: {
          ...invalidEventId.event,
          id: 'not-a-uuid' as typeof invalidEventId.event.id,
        },
      },
      {
        ...invalidEventCursor,
        event: { ...invalidEventCursor.event, cursor: 1n },
      },
      {
        ...invalidEventCreatedAt,
        event: {
          ...invalidEventCreatedAt.event,
          createdAt: Number.MAX_SAFE_INTEGER + 1 as unknown as bigint,
        },
      },
    ]

    for (const input of attempts) {
      const exit = await Effect.runPromiseExit(
        SourceRegistrationRepo.create(input).pipe(Effect.provide(layer)),
      )
      expect(exit._tag).toBe('Failure')
      expect(String(exit)).toContain('ValidationError')
    }

    const [counts] = await sql.unsafe(
      `SELECT
         (SELECT COUNT(*)::int FROM sources WHERE id = ANY($1::uuid[])) AS sources,
         (SELECT COUNT(*)::int FROM job_queue WHERE id = ANY($2::uuid[])) AS jobs,
         (SELECT COUNT(*)::int FROM event_journal WHERE id = ANY($3::uuid[])) AS events`,
      [
        attempts.map((input) => input.source.id),
        attempts.map((input) => input.job.id),
        attempts.map((input) => input.event.id).filter((id) => id !== 'not-a-uuid'),
      ],
    )
    expect(counts).toMatchObject({ sources: 0, jobs: 0, events: 0 })
  })

  it('atomically persists a valid aggregate in the authorized project workspace', async () => {
    const input = registration(40)

    const result = await Effect.runPromise(
      SourceRegistrationRepo.create(input).pipe(Effect.provide(layer)),
    )

    expect(result.source).toMatchObject({
      id: input.source.id,
      projectId,
    })
    expect(result.job).toMatchObject({
      id: input.job.id,
      workspaceId,
      entityType: 'ingestion',
      entityId: input.source.id,
      status: 'pending',
    })
    expect(result.event).toMatchObject({
      id: input.event.id,
      workspaceId,
      entityType: 'ingestion',
      entityId: input.source.id,
      eventType: 'ingestion-requested',
    })
    const [stored] = await sql.unsafe(
      `SELECT
         s.project_id,
         j.workspace_id AS job_workspace_id,
         j.entity_type AS job_entity_type,
         j.entity_id AS job_entity_id,
         e.workspace_id AS event_workspace_id,
         e.entity_type AS event_entity_type,
         e.entity_id AS event_entity_id,
         j.payload AS job_payload,
         e.payload AS event_payload
       FROM sources s
       JOIN job_queue j ON j.id = $2
       JOIN event_journal e ON e.id = $3
       WHERE s.id = $1`,
      [input.source.id, input.job.id, input.event.id],
    )
    expect(stored).toMatchObject({
      project_id: projectId,
      job_workspace_id: workspaceId,
      job_entity_type: 'ingestion',
      job_entity_id: input.source.id,
      event_workspace_id: workspaceId,
      event_entity_type: 'ingestion',
      event_entity_id: input.source.id,
    })
    expect(JSON.parse(String(stored?.['job_payload']))).toEqual({
        stagedRef: input.job.payload['stagedRef'],
        name: input.source.name,
        mediaType: 'text/markdown',
        byteLength: 12,
        sourceId: input.source.id,
        projectId,
    })
    expect(JSON.parse(String(stored?.['event_payload']))).toEqual({
        sourceId: input.source.id,
        jobId: input.job.id,
        stagedRef: input.job.payload['stagedRef'],
        mediaType: 'text/markdown',
        byteLength: 12,
    })
  })
})
