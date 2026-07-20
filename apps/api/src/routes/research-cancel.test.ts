import { describe, expect, it } from 'bun:test'
import { Effect } from 'effect'
import {
  EventJournalId,
  ProjectId,
  ResearchRunId,
  WorkspaceId,
} from '@struct/domain'
import { cancelResearch } from './research-cancel'

const workspaceId = WorkspaceId.make('b60e8400-e29b-41d4-a716-446655440001')
const projectId = ProjectId.make('b60e8400-e29b-41d4-a716-446655440002')
const runId = ResearchRunId.make('b60e8400-e29b-41d4-a716-446655440003')
const eventId = EventJournalId.make('b60e8400-e29b-41d4-a716-446655440004')

describe('research cancellation route', () => {
  it('passes authenticated scope and idempotency identity to persistence', async () => {
    let captured: Parameters<
      NonNullable<Parameters<typeof cancelResearch>[2]>['request']
    >[0] | undefined
    const result = await Effect.runPromise(cancelResearch(
      { workspaceId, projectId, runId },
      'cancel-once',
      {
        now: () => 1_700_000_000_000n,
        randomEventId: () => eventId,
        request: (input) => {
          captured = input
          return Effect.succeed({ result: 'cancelled', replayed: false })
        },
      },
    ))
    expect(result).toEqual({ result: 'cancelled', replayed: false })
    expect(captured).toEqual({
      workspaceId,
      projectId,
      runId,
      idempotencyKey: 'cancel-once',
      eventId,
      createdAt: 1_700_000_000_000n,
    })
  })
})
