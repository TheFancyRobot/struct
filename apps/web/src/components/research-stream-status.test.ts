import { describe, expect, it } from 'bun:test'
import { ResearchEvent } from '@struct/domain'
import { Schema } from 'effect'
import { terminalResearchStatus } from './research-run-status'

const failedEvent = Schema.decodeUnknownSync(ResearchEvent)({
  id: 'd70e8400-e29b-41d4-a716-446655440007',
  cursor: '7',
  runId: 'd70e8400-e29b-41d4-a716-446655440001',
  createdAt: 1_700_000_000_000,
  type: 'research-failed',
  data: {
    jobId: 'd70e8400-e29b-41d4-a716-446655440008',
    attempt: 0,
    message: 'Insufficient evidence',
    errorTag: 'EvidenceInsufficientError',
  },
})

describe('terminalResearchStatus', () => {
  it('keeps a failed run labeled Failed instead of Reconnecting', () => {
    expect(terminalResearchStatus([failedEvent])).toEqual({
      label: 'Failed',
      badgeClass: 'badge-error',
    })
  })
})
