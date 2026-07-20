import { describe, expect, it } from 'bun:test'
import {
  JobQueueId,
  RecursiveAnalysisRequestId,
  ResearchRunId,
  WorkspaceId,
} from '@struct/domain'
import { Effect } from 'effect'
import { makeRecursiveProgressPublisher } from './recursive-progress'

const workspaceId = WorkspaceId.make('f90e8400-e29b-41d4-a716-446655440001')
const jobId = JobQueueId.make('f90e8400-e29b-41d4-a716-446655440002')
const runId = ResearchRunId.make('f90e8400-e29b-41d4-a716-446655440003')
const sha = (digit: string) => `sha256:${digit.repeat(64)}`

describe('recursive progress publisher', () => {
  it('writes committed progress through the owned research event boundary', async () => {
    const job = {
      id: jobId,
      workspaceId,
      entityType: 'research',
      entityId: runId,
      status: 'in-progress',
      payload: {},
      attempts: 2,
      maxAttempts: 3,
      createdAt: 0n,
      updatedAt: 0n,
    } as const
    const events: Array<Parameters<
      Parameters<typeof makeRecursiveProgressPublisher>[1]['appendInProgressEvent']
    >[1]> = []
    const publisher = makeRecursiveProgressPublisher(job, {
      now: () => 1_700_000_000_000n,
      appendInProgressEvent: (ownedJob, event) => Effect.sync(() => {
        expect(ownedJob).toBe(job)
        events.push(event)
      }),
    })

    await Effect.runPromise(publisher.runCommitted({
      requestId: RecursiveAnalysisRequestId.make(sha('1')),
      planId: sha('2'),
      status: 'running',
      cancellation: 'none',
      recoveryCount: 0,
      expectedPartitions: 2,
      committedPartitions: 0,
      failedPartitions: 0,
    }))
    await Effect.runPromise(publisher.runCommitted({
      requestId: RecursiveAnalysisRequestId.make(sha('1')),
      planId: sha('2'),
      status: 'running',
      cancellation: 'none',
      recoveryCount: 0,
      expectedPartitions: 2,
      committedPartitions: 0,
      failedPartitions: 0,
    }))

    expect(events).toHaveLength(2)
    expect(events[0]?.id).toBe(events[1]?.id)
    expect(events[0]).toMatchObject({
      eventType: 'recursive-run-progress-committed',
      workspaceId,
      entityId: runId,
      cursor: 0n,
      payload: {
        jobId,
        attempt: 2,
        workspaceId,
        requestId: sha('1'),
      },
    })
  })
})
