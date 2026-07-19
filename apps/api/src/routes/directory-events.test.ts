import { describe, expect, it } from 'bun:test'
import { Effect } from 'effect'
import {
  DirectoryRootId,
  DirectorySnapshotId,
  EventJournalId,
  JobQueueId,
  ProjectId,
  SourceId,
  WorkspaceId,
  type DirectoryStatusProjection,
} from '@struct/domain'
import {
  directoryEventsResponse,
  encodeDirectorySseEvent,
  loadDirectoryEvents,
} from './directory-events'

const workspaceId = WorkspaceId.make('e40e8400-e29b-41d4-a716-446655440001')
const projectId = ProjectId.make('e40e8400-e29b-41d4-a716-446655440002')
const jobId = JobQueueId.make('e40e8400-e29b-41d4-a716-446655440003')
const completed: DirectoryStatusProjection = {
  jobId,
  workspaceId,
  projectId,
  sourceId: SourceId.make('e40e8400-e29b-41d4-a716-446655440004'),
  directoryRootId: DirectoryRootId.make('e40e8400-e29b-41d4-a716-446655440005'),
  snapshotId: DirectorySnapshotId.make('e40e8400-e29b-41d4-a716-446655440006'),
  name: 'notes',
  status: 'completed',
  attempts: 1,
  maxAttempts: 3,
  counts: {
    total: 1,
    processed: 1,
    succeeded: 1,
    failed: 0,
    unsupported: 0,
    pending: 0,
  },
  failures: [],
  updatedAt: 1_700_000_000_000,
}

describe('directory persisted event stream', () => {
  it('loads strictly after the reconnect cursor and preserves terminal state', async () => {
    const events = await Effect.runPromise(loadDirectoryEvents(
      workspaceId,
      projectId,
      jobId,
      41n,
      {
        listEventsAfter: (_workspace, _project, _job, cursor) => {
          expect(cursor).toBe(41n)
          return Effect.succeed([{
            id: EventJournalId.make('e40e8400-e29b-41d4-a716-446655440007'),
            cursor: 42n,
            type: 'directory-completed',
            createdAt: completed.updatedAt,
          }])
        },
        findStatus: () => Effect.succeed(completed),
      },
    ))
    expect(events).toHaveLength(1)
    expect(events[0]?.cursor).toBe('42')
    expect(events[0]?.status.status).toBe('completed')
    expect(encodeDirectorySseEvent(events[0]!)).toContain(
      'id: 42\nevent: directory-completed',
    )
  })

  it('emits one cursor-addressed terminal frame through SSE', async () => {
    let reads = 0
    const response = directoryEventsResponse(
      workspaceId,
      projectId,
      jobId,
      41n,
      {
        listEventsAfter: () => Effect.succeed(reads++ === 0 ? [{
          id: EventJournalId.make('e40e8400-e29b-41d4-a716-446655440008'),
          cursor: 42n,
          type: 'directory-completed',
          createdAt: completed.updatedAt,
        }] : []),
        findStatus: () => Effect.succeed(completed),
      },
      new AbortController().signal,
      { now: () => 0, sleep: () => Promise.resolve() },
    )
    if (response.body === null) throw new Error('Expected SSE body')
    const reader = response.body.getReader()
    const frame = new TextDecoder().decode((await reader.read()).value)
    expect(frame.match(/id: 42/g)).toHaveLength(1)
    expect(frame).toContain('"status":"completed"')
    await reader.cancel()
  })
})
