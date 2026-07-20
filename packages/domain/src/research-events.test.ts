import { describe, expect, it } from 'bun:test'
import { Schema } from 'effect'
import {
  EventJournalId,
  JobQueueId,
  ResearchCheckpointId,
  ResearchEvent,
  ResearchPlanId,
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

  it('decodes durable planning, checkpoint, and cancellation events', () => {
    const base = {
      id: EventJournalId.make('a50e8400-e29b-41d4-a716-446655440011'),
      cursor: '5',
      runId: ResearchRunId.make('a50e8400-e29b-41d4-a716-446655440012'),
      createdAt: 1_700_000_000_000,
    }
    const jobId = JobQueueId.make('a50e8400-e29b-41d4-a716-446655440013')
    const planId = ResearchPlanId.make('a50e8400-e29b-41d4-a716-446655440014')
    const checkpointId = ResearchCheckpointId.make(
      'a50e8400-e29b-41d4-a716-446655440015',
    )
    const events = [
      {
        ...base,
        type: 'research-plan-accepted',
        data: { jobId, attempt: 1, planId },
      },
      {
        ...base,
        type: 'research-planning-failed',
        data: {
          jobId,
          attempt: 1,
          errorTag: 'ResearchContractValidationError',
          reason: 'malformed',
        },
      },
      {
        ...base,
        type: 'research-checkpointed',
        data: { jobId, attempt: 1, checkpointId, planId },
      },
      {
        ...base,
        type: 'research-cancelled',
        data: { jobId, attempt: 1 },
      },
    ]
    expect(events.map((event) =>
      Schema.decodeUnknownSync(ResearchEvent)(event).type
    )).toEqual([
      'research-plan-accepted',
      'research-planning-failed',
      'research-checkpointed',
      'research-cancelled',
    ])
  })
})
