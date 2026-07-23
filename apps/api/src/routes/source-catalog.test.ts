import { describe, expect, it } from 'bun:test'
import {
  EventJournalId,
  SourceId,
} from '@struct/domain'
import { encodeSourceActivityEvent } from './source-catalog'

describe('source activity SSE', () => {
  it('carries the durable cursor and typed source identity', () => {
    const frame = encodeSourceActivityEvent({
      id: EventJournalId.make('750e8400-e29b-41d4-a716-446655440001'),
      cursor: '42',
      sourceId: SourceId.make('750e8400-e29b-41d4-a716-446655440002'),
      type: 'ingestion-completed',
      createdAt: 1_700_000_000_000,
    })

    expect(frame).toContain('id: 42\n')
    expect(frame).toContain('event: ingestion-completed\n')
    expect(frame).toContain('"sourceId":"750e8400-e29b-41d4-a716-446655440002"')
  })
})
