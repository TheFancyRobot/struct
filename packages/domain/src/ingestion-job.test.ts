import { describe, expect, it } from 'bun:test'
import { Effect, Schema } from 'effect'
import {
  DirectoryIngestionEntryCommit,
  DirectoryIngestionLeaseToken,
  InvalidDirectoryIngestionTransitionError,
  transitionDirectoryIngestionJob,
} from './ingestion-job.js'
import {
  JobQueueId,
  ManifestEntryId,
  WorkspaceId,
} from './branded-ids.js'

describe('directory ingestion job transitions', () => {
  it.each([
    ['ready', 'claim', 'running'],
    ['running', 'pause', 'paused'],
    ['paused', 'resume', 'ready'],
    ['running', 'cancel', 'cancelled'],
    ['running', 'complete', 'completed'],
    ['running', 'exhaust', 'exhausted'],
    ['cancelled', 'retry', 'ready'],
    ['exhausted', 'retry', 'ready'],
  ] as const)('%s + %s -> %s', async (current, transition, expected) => {
    expect(await Effect.runPromise(
      transitionDirectoryIngestionJob(current, transition),
    )).toBe(expected)
  })

  it('rejects terminal and otherwise invalid transitions with a typed error', async () => {
    const error = await Effect.runPromise(
      transitionDirectoryIngestionJob('completed', 'retry').pipe(Effect.flip),
    )
    expect(error).toBeInstanceOf(InvalidDirectoryIngestionTransitionError)
    expect(error.current).toBe('completed')
    expect(error.transition).toBe('retry')
  })

  it('enforces content-key consistency for completed and unresolved entries', () => {
    const base = {
      jobId: JobQueueId.make('d40e8400-e29b-41d4-a716-446655440001'),
      workspaceId: WorkspaceId.make('d40e8400-e29b-41d4-a716-446655440002'),
      entryId: ManifestEntryId.make('d40e8400-e29b-41d4-a716-446655440003'),
      idempotencyKey: 'entry:1',
      attempt: 1,
      leaseToken: DirectoryIngestionLeaseToken.make(
        'd40e8400-e29b-41d4-a716-446655440004',
      ),
      result: {},
    }
    expect(() => Schema.decodeUnknownSync(DirectoryIngestionEntryCommit)({
      ...base,
      outcome: 'completed',
      contentKey: null,
    })).toThrow()
    expect(() => Schema.decodeUnknownSync(DirectoryIngestionEntryCommit)({
      ...base,
      outcome: 'unresolved',
      contentKey: `artifact://sha256/${'a'.repeat(64)}`,
    })).toThrow()
  })
})
