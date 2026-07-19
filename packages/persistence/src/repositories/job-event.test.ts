import { describe, expect, it } from 'bun:test'
import { Effect, Layer } from 'effect'
import {
  JobQueueRepo,
  EventJournalRepo,
  SqlClientTest,
  decodeEventJournalRow,
  decodeJobQueueRow,
} from '../index.js'
import { EventJournalId, WorkspaceId, SourceId } from '@struct/domain'

describe('job_queue and event_journal decoders', () => {
  it('decodes job rows and event rows from PostgreSQL wire shapes', async () => {
    const ts = new Date('2026-01-01T00:00:00Z')
    const job = await Effect.runPromise(decodeJobQueueRow({
      id: '650e8400-e29b-41d4-a716-446655440010',
      workspace_id: '650e8400-e29b-41d4-a716-446655440000',
      entity_type: 'ingestion',
      entity_id: '650e8400-e29b-41d4-a716-446655440002',
      status: 'pending',
      payload: { stagedRef: 'staged://650e8400-e29b-41d4-a716-446655440100/notes.txt' },
      attempts: 0,
      max_attempts: 3,
      created_at: ts,
      updated_at: ts,
    }))
    const event = await Effect.runPromise(decodeEventJournalRow({
      id: '650e8400-e29b-41d4-a716-446655440011',
      workspace_id: '650e8400-e29b-41d4-a716-446655440000',
      entity_type: 'ingestion',
      entity_id: '650e8400-e29b-41d4-a716-446655440002',
      event_type: 'ingestion-requested',
      payload: { sourceId: '650e8400-e29b-41d4-a716-446655440002' },
      cursor: '42',
      created_at: ts,
    }))

    expect(job.status).toBe('pending')
    expect(String(job.workspaceId)).toBe('650e8400-e29b-41d4-a716-446655440000')
    expect(event.cursor).toBe(42n)
    expect(event.eventType).toBe('ingestion-requested')
  })
})

describe('JobQueueRepo', () => {
  it('claims exactly one pending ingestion job with FOR UPDATE SKIP LOCKED and increments attempts atomically', async () => {
    const queries: string[] = []
    const sqlLayer = SqlClientTest(async (query) => {
      queries.push(query)
      return [{
        id: '650e8400-e29b-41d4-a716-446655440010',
        workspace_id: '650e8400-e29b-41d4-a716-446655440000',
        entity_type: 'ingestion',
        entity_id: '650e8400-e29b-41d4-a716-446655440002',
        status: 'in-progress',
        payload: { stagedRef: 'staged://650e8400-e29b-41d4-a716-446655440100/notes.txt', name: 'notes.txt', mediaType: 'text/plain' },
        attempts: 1,
        max_attempts: 3,
        created_at: new Date('2026-01-01T00:00:00Z'),
        updated_at: new Date('2026-01-01T00:00:01Z'),
      }]
    })
    const layer = Layer.provide(JobQueueRepo.Default, sqlLayer)

    const job = await Effect.runPromise(JobQueueRepo.claimNextIngestionJob().pipe(Effect.provide(layer)))

    expect(job._tag).toBe('Some')
    expect(queries.join('\n')).toMatch(/FOR UPDATE SKIP LOCKED/i)
    expect(queries.join('\n')).toMatch(/attempts = attempts \+ 1/i)
  })

  it('requeues stale in-progress ingestion jobs before polling', async () => {
    const queries: string[] = []
    const sqlLayer = SqlClientTest(async (query) => {
      queries.push(query)
      if (query.includes('attempts >= max_attempts')) {
        return [{
          id: '650e8400-e29b-41d4-a716-446655440010',
          workspace_id: '650e8400-e29b-41d4-a716-446655440000',
          entity_type: 'ingestion',
          entity_id: '650e8400-e29b-41d4-a716-446655440002',
          status: 'failed',
          payload: {},
          attempts: 3,
          max_attempts: 3,
          created_at: new Date('2026-01-01T00:00:00Z'),
          updated_at: new Date('2026-01-01T00:00:01Z'),
        }]
      }
      if (query.includes('INSERT INTO event_journal')) {
        return [{ id: '650e8400-e29b-41d4-a716-446655440011' }]
      }
      return []
    })
    const layer = Layer.provide(JobQueueRepo.Default, sqlLayer)

    await Effect.runPromise(JobQueueRepo.recoverStaleIngestionJobs(1700000000000).pipe(Effect.provide(layer)))

    expect(queries.join('\n')).toMatch(/status = 'in-progress'/i)
    expect(queries.join('\n')).toMatch(/attempts < max_attempts/i)
    expect(queries.join('\n')).toMatch(/status = 'pending'/i)
    expect(queries.join('\n')).toMatch(/attempts >= max_attempts/i)
    expect(queries.join('\n')).toMatch(/status = 'failed'/i)
    expect(queries.join('\n')).toMatch(/INSERT INTO event_journal/i)
    expect(queries.join('\n')).toMatch(/StaleIngestionJobExhausted/)
    expect(queries.join('\n')).toMatch(/md5\(/i)
    expect(queries.join('\n')).toMatch(/ON CONFLICT \(id\) DO NOTHING/i)
  })
})

describe('EventJournalRepo', () => {
  it('appends small sanitized ingestion events without source text or absolute paths', async () => {
    const payloads: unknown[] = []
    const sqlLayer = SqlClientTest(async (_query, params) => {
      payloads.push(params?.[5])
      return [{
        id: '650e8400-e29b-41d4-a716-446655440011',
        workspace_id: '650e8400-e29b-41d4-a716-446655440000',
        entity_type: 'ingestion',
        entity_id: '650e8400-e29b-41d4-a716-446655440002',
        event_type: 'ingestion-requested',
        payload: JSON.parse(String(params?.[5])),
        cursor: '1',
        created_at: new Date('2026-01-01T00:00:00Z'),
      }]
    })
    const layer = Layer.provide(EventJournalRepo.Default, sqlLayer)

    await Effect.runPromise(EventJournalRepo.append({
      id: EventJournalId.make('650e8400-e29b-41d4-a716-446655440011'),
      workspaceId: WorkspaceId.make('650e8400-e29b-41d4-a716-446655440000'),
      entityType: 'ingestion',
      entityId: SourceId.make('650e8400-e29b-41d4-a716-446655440002'),
      eventType: 'ingestion-requested',
      payload: { sourceId: '650e8400-e29b-41d4-a716-446655440002', stagedRef: 'staged://650e8400-e29b-41d4-a716-446655440100/notes.txt' },
      cursor: 0n,
      createdAt: 0n,
    }).pipe(Effect.provide(layer)))

    expect(JSON.stringify(payloads)).not.toContain('hello world source text')
    expect(JSON.stringify(payloads)).not.toContain('/Users/')
  })
})
