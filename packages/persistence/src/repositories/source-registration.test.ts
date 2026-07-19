import { describe, expect, it } from 'bun:test'
import { Effect, Layer } from 'effect'
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
  SqlClientTest,
} from '../index.js'

const workspaceId = WorkspaceId.make('a10e8400-e29b-41d4-a716-446655440000')
const foreignWorkspaceId = WorkspaceId.make('a10e8400-e29b-41d4-a716-446655440001')
const projectId = ProjectId.make('a10e8400-e29b-41d4-a716-446655440002')
const foreignProjectId = ProjectId.make('a10e8400-e29b-41d4-a716-446655440003')
const sourceId = SourceId.make('a10e8400-e29b-41d4-a716-446655440004')
const jobId = JobQueueId.make('a10e8400-e29b-41d4-a716-446655440005')
const eventId = EventJournalId.make('a10e8400-e29b-41d4-a716-446655440006')
const createdAt = 1_768_435_200_000n

const source: typeof Source.Type = {
  id: sourceId,
  projectId,
  name: 'notes.md',
  kind: 'document',
  createdAt,
  updatedAt: createdAt,
}

const job: typeof JobQueue.Type = {
  id: jobId,
  workspaceId,
  entityType: 'ingestion',
  entityId: sourceId,
  status: 'pending',
  payload: {
    stagedRef: 'staged://a10e8400-e29b-41d4-a716-446655440007/notes.md',
    name: 'notes.md',
    mediaType: 'text/markdown',
    byteLength: 12,
    sourceId,
    projectId,
  },
  attempts: 0,
  maxAttempts: 3,
  createdAt,
  updatedAt: createdAt,
}

const event: typeof EventJournal.Type = {
  id: eventId,
  workspaceId,
  entityType: 'ingestion',
  entityId: sourceId,
  eventType: 'ingestion-requested',
  payload: {
    sourceId,
    jobId,
    stagedRef: job.payload['stagedRef'],
    mediaType: 'text/markdown',
    byteLength: 12,
  },
  cursor: 0n,
  createdAt,
}

type RegistrationInput = {
  readonly source: typeof Source.Type
  readonly job: typeof JobQueue.Type
  readonly event: typeof EventJournal.Type
}

const baseInput = (): RegistrationInput => ({
  source: { ...source },
  job: { ...job, payload: { ...job.payload } },
  event: { ...event, payload: { ...event.payload } },
})

function withStagedRef(stagedRef: string): RegistrationInput {
  const input = baseInput()
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

function rowFor(query: string, params?: readonly unknown[]): readonly Record<string, unknown>[] {
  if (query.includes('FROM projects')) {
    const selectedProjectId = String(params?.[0])
    return [{
      id: selectedProjectId,
      workspace_id: selectedProjectId === foreignProjectId
        ? foreignWorkspaceId
        : workspaceId,
    }]
  }
  if (query.includes('INSERT INTO sources')) {
    return [{
      id: params?.[0],
      project_id: params?.[1],
      name: params?.[2],
      kind: params?.[3],
      created_at: new Date(Number(params?.[4])),
      updated_at: new Date(Number(params?.[5])),
    }]
  }
  if (query.includes('INSERT INTO job_queue')) {
    return [{
      id: params?.[0],
      workspace_id: params?.[1],
      entity_type: params?.[2],
      entity_id: params?.[3],
      status: params?.[4],
      payload: JSON.parse(String(params?.[5])),
      attempts: params?.[6],
      max_attempts: params?.[7],
      created_at: new Date(Number(params?.[8])),
      updated_at: new Date(Number(params?.[9])),
    }]
  }
  if (query.includes('INSERT INTO event_journal')) {
    return [{
      id: params?.[0],
      workspace_id: params?.[1],
      entity_type: params?.[2],
      entity_id: params?.[3],
      event_type: params?.[4],
      payload: JSON.parse(String(params?.[5])),
      cursor: '1',
      created_at: new Date(Number(params?.[6])),
    }]
  }
  return []
}

describe('SourceRegistrationRepo aggregate boundary', () => {
  it('rejects unknown, sensitive, malformed, and unbounded payload data before SQL', async () => {
    const invalidInputs: ReadonlyArray<RegistrationInput> = [
      {
        ...baseInput(),
        job: {
          ...job,
          payload: {
            ...job.payload,
            sourceText: 'private source contents',
          },
        },
      },
      {
        ...baseInput(),
        event: {
          ...event,
          payload: {
            ...event.payload,
            absolutePath: '/private/project/notes.md',
          },
        },
      },
      {
        ...baseInput(),
        job: {
          ...job,
          payload: {
            ...job.payload,
            secret: { token: 'synthetic-secret', nested: ['unbounded'] },
          },
        },
      },
      {
        ...baseInput(),
        event: {
          ...event,
          payload: {
            ...event.payload,
            metadata: { nested: { sourceText: 'private' } },
          },
        },
      },
      {
        ...baseInput(),
        job: {
          ...job,
          payload: { ...job.payload, name: 42 },
        },
      } as unknown as RegistrationInput,
      {
        ...baseInput(),
        job: { ...job, payload: null },
      } as unknown as RegistrationInput,
      {
        ...baseInput(),
        event: { ...event, payload: ['not', 'an', 'object'] },
      } as unknown as RegistrationInput,
      {
        ...baseInput(),
        job: {
          ...job,
          payload: { ...job.payload, byteLength: Number.MAX_SAFE_INTEGER },
        },
        event: {
          ...event,
          payload: { ...event.payload, byteLength: Number.MAX_SAFE_INTEGER },
        },
      },
      {
        ...baseInput(),
        source: { ...source, name: 'a'.repeat(256) },
        job: {
          ...job,
          payload: { ...job.payload, name: 'a'.repeat(256) },
        },
      },
      {
        ...baseInput(),
        event: { ...event, id: 'not-a-uuid' as typeof event.id },
      },
      {
        ...baseInput(),
        event: { ...event, cursor: 1n },
      },
      {
        ...baseInput(),
        event: {
          ...event,
          createdAt: Number.MAX_SAFE_INTEGER + 1 as unknown as bigint,
        },
      },
      {
        ...baseInput(),
        event: {
          ...event,
          debug: true,
        } as typeof event,
      },
      {
        ...baseInput(),
        traceContext: 'caller-controlled',
      } as RegistrationInput,
    ]

    for (const input of invalidInputs) {
      const queries: string[] = []
      const layer = Layer.provide(
        SourceRegistrationRepo.Default,
        SqlClientTest(async (query, params) => {
          queries.push(query)
          return rowFor(query, params)
        }),
      )

      const exit = await Effect.runPromiseExit(
        SourceRegistrationRepo.create(input).pipe(Effect.provide(layer)),
      )

      expect(exit._tag).toBe('Failure')
      expect(String(exit)).toContain('ValidationError')
      expect(queries).toEqual([])
    }
  })

  it('rejects malformed aggregate links, types, statuses, and payloads before any write', async () => {
    const mismatches: ReadonlyArray<RegistrationInput> = [
      { ...baseInput(), source: { ...source, kind: 'dataset' } },
      { ...baseInput(), job: { ...job, entityType: 'research' } },
      {
        ...baseInput(),
        job: {
          ...job,
          entityId: SourceId.make('a10e8400-e29b-41d4-a716-446655440008'),
        },
      },
      { ...baseInput(), job: { ...job, status: 'in-progress' } },
      { ...baseInput(), job: { ...job, attempts: 1 } },
      {
        ...baseInput(),
        job: { ...job, payload: { ...job.payload, projectId: foreignProjectId } },
      },
      {
        ...baseInput(),
        event: { ...event, workspaceId: foreignWorkspaceId },
      },
      { ...baseInput(), event: { ...event, entityType: 'research' } },
      {
        ...baseInput(),
        event: {
          ...event,
          entityId: SourceId.make('a10e8400-e29b-41d4-a716-446655440008'),
        },
      },
      { ...baseInput(), event: { ...event, eventType: 'ingestion-completed' } },
      {
        ...baseInput(),
        event: {
          ...event,
          payload: {
            ...event.payload,
            jobId: JobQueueId.make('a10e8400-e29b-41d4-a716-446655440009'),
          },
        },
      },
      {
        ...baseInput(),
        event: {
          ...event,
          payload: { ...event.payload, stagedRef: 'staged://forged/notes.md' },
        },
      },
      withStagedRef('https://attacker.invalid/notes.md'),
      withStagedRef('staged://not-a-uuid/notes.md'),
      withStagedRef(
        'staged://a10e8400-e29b-41d4-a716-446655440007/Notes.MD',
      ),
      withStagedRef(
        'staged://a10e8400-e29b-41d4-a716-446655440007/../secret.md',
      ),
      withStagedRef(
        `staged://a10e8400-e29b-41d4-a716-446655440007/${'a'.repeat(256)}.md`,
      ),
      withStagedRef(
        'staged://a10e8400-e29b-41d4-a716-446655440007/notes.md\n',
      ),
    ]

    for (const input of mismatches) {
      const queries: string[] = []
      const layer = Layer.provide(
        SourceRegistrationRepo.Default,
        SqlClientTest(async (query, params) => {
          queries.push(query)
          return rowFor(query, params)
        }),
      )
      const exit = await Effect.runPromiseExit(
        SourceRegistrationRepo.create(input).pipe(Effect.provide(layer)),
      )
      expect(exit._tag).toBe('Failure')
      expect(String(exit)).toContain('ValidationError')
      expect(queries.some((query) => query.includes('INSERT INTO'))).toBe(false)
    }
  })

  it('authorizes the source project against the workspace before writes', async () => {
    const queries: string[] = []
    const input = baseInput()
    const foreignInput: RegistrationInput = {
      source: { ...input.source, projectId: foreignProjectId },
      job: {
        ...input.job,
        payload: { ...input.job.payload, projectId: foreignProjectId },
      },
      event: input.event,
    }
    const layer = Layer.provide(
      SourceRegistrationRepo.Default,
      SqlClientTest(async (query, params) => {
        queries.push(query)
        return rowFor(query, params)
      }),
    )

    const exit = await Effect.runPromiseExit(
      SourceRegistrationRepo.create(foreignInput).pipe(Effect.provide(layer)),
    )

    expect(exit._tag).toBe('Failure')
    expect(String(exit)).toContain('AuthorizationError')
    expect(queries.some((query) => query.includes('INSERT INTO'))).toBe(false)
  })

  it('persists a valid aggregate using the authorized project and workspace scope', async () => {
    const calls: Array<{ query: string; params?: readonly unknown[] }> = []
    const layer = Layer.provide(
      SourceRegistrationRepo.Default,
      SqlClientTest(async (query, params) => {
        calls.push({ query, params })
        return rowFor(query, params)
      }),
    )

    const result = await Effect.runPromise(
      SourceRegistrationRepo.create(baseInput()).pipe(Effect.provide(layer)),
    )

    expect(result.source.id).toBe(sourceId)
    expect(result.job.id).toBe(jobId)
    expect(result.event.id).toBe(eventId)
    const sourceInsert = calls.find(({ query }) => query.includes('INSERT INTO sources'))
    const jobInsert = calls.find(({ query }) => query.includes('INSERT INTO job_queue'))
    const eventInsert = calls.find(({ query }) => query.includes('INSERT INTO event_journal'))
    expect(sourceInsert?.params?.[1]).toBe(projectId)
    expect(jobInsert?.params?.slice(1, 4)).toEqual([workspaceId, 'ingestion', sourceId])
    expect(eventInsert?.params?.slice(1, 5)).toEqual([
      workspaceId,
      'ingestion',
      sourceId,
      'ingestion-requested',
    ])
    expect(JSON.parse(String(jobInsert?.params?.[5]))).toEqual({
      stagedRef: job.payload['stagedRef'],
      name: source.name,
      mediaType: 'text/markdown',
      byteLength: 12,
      sourceId,
      projectId,
    })
    expect(JSON.parse(String(eventInsert?.params?.[5]))).toEqual({
      sourceId,
      jobId,
      stagedRef: job.payload['stagedRef'],
      mediaType: 'text/markdown',
      byteLength: 12,
    })
    expect(calls[0]?.query).toMatch(/FOR SHARE/i)
  })
})
