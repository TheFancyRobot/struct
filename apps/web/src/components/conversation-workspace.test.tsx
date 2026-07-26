import { describe, expect, it } from 'bun:test'
import {
  EventJournalId,
  ResearchRunId,
  SourceVersionId,
  type ResearchEvent,
} from '@struct/domain'
import {
  appendResearchEvent,
  reconcileSourceSelection,
} from './conversation-state'

const version = (suffix: string) =>
  SourceVersionId.make(`a50e8400-e29b-41d4-a716-${suffix}`)

function event(cursor: number): ResearchEvent {
  return {
    id: EventJournalId.make(
      `b50e8400-e29b-41d4-a716-${cursor.toString().padStart(12, '0')}`,
    ),
    cursor: String(cursor),
    runId: ResearchRunId.make('b50e8400-e29b-41d4-a716-446655440001'),
    type: 'research-started',
    data: {
      jobId: 'b50e8400-e29b-41d4-a716-446655440002',
      threadId: 'b50e8400-e29b-41d4-a716-446655440003',
    },
    createdAt: cursor,
  } as ResearchEvent
}

describe('conversation workspace state', () => {
  it('keeps default scope live while preserving and pruning an explicit scope', () => {
    const first = version('446655440001')
    const second = version('446655440002')

    expect(reconcileSourceSelection([first], [first, second], false)).toEqual({
      selected: [first, second],
      removed: [],
    })
    expect(reconcileSourceSelection([first, second], [second], true)).toEqual({
      selected: [second],
      removed: [first],
    })
  })

  it('deduplicates replay and bounds long-running event memory', () => {
    let events: ReadonlyArray<ResearchEvent> = []
    for (let cursor = 1; cursor <= 501; cursor += 1) {
      events = appendResearchEvent(events, event(cursor))
    }
    const replayed = appendResearchEvent(events, event(501))

    expect(events).toHaveLength(500)
    expect(events[0]?.cursor).toBe('2')
    expect(replayed).toBe(events)
  })
})
