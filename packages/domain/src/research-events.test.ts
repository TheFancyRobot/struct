import { describe, expect, it } from 'bun:test'
import { Schema } from 'effect'
import {
  EventJournalId,
  JobQueueId,
  ResearchEvent,
  ResearchRunId,
  ResearchThreadId,
} from './index'

describe('ResearchEvent', () => {
  it('decodes the persisted walking-slice event variants', () => {
    const decoded = Schema.decodeUnknownSync(ResearchEvent)({
      id: EventJournalId.make('a50e8400-e29b-41d4-a716-446655440001'),
      cursor: '4',
      runId: ResearchRunId.make('a50e8400-e29b-41d4-a716-446655440002'),
      createdAt: 1_700_000_000_000,
      type: 'research-started',
      data: {
        jobId: JobQueueId.make('a50e8400-e29b-41d4-a716-446655440003'),
        threadId: ResearchThreadId.make('a50e8400-e29b-41d4-a716-446655440004'),
      },
    })

    expect(decoded.type).toBe('research-started')
    expect(decoded.cursor).toBe('4')
  })

  it('rejects a non-monotonic cursor representation', () => {
    expect(() => Schema.decodeUnknownSync(ResearchEvent)({
      id: 'a50e8400-e29b-41d4-a716-446655440001',
      cursor: '-1',
      runId: 'a50e8400-e29b-41d4-a716-446655440002',
      createdAt: 1,
      type: 'research-failed',
      data: {
        jobId: 'a50e8400-e29b-41d4-a716-446655440003',
        attempt: 1,
        errorTag: 'ResearchWorkflowError',
        message: 'Research failed',
      },
    })).toThrow()
  })
})
