import { describe, expect, it } from 'bun:test'
import { Effect, Exit, Metric, Option } from 'effect'
import {
  CitationId,
  EvidenceContradictionError,
  EvidenceInsufficientError,
  EventJournalId,
  JobQueueId,
  ProjectId,
  ResearchRunId,
  ResearchCitationValidationError,
  ResearchThreadId,
  SourceVersionId,
  WorkspaceId,
  type JobQueue,
  type ResearchRun,
} from '@struct/domain'
import { ResearchJobOwnershipLostError } from '@struct/persistence'
import { walkingSliceMetrics } from '@struct/observability'
import { processOneResearchJob, type ResearchWorkerDeps } from './run-research'

const workspaceId = WorkspaceId.make('e50e8400-e29b-41d4-a716-446655440000')
const projectId = ProjectId.make('e50e8400-e29b-41d4-a716-446655440001')
const sourceVersionId = SourceVersionId.make('e50e8400-e29b-41d4-a716-446655440002')
const runId = ResearchRunId.make('e50e8400-e29b-41d4-a716-446655440003')
const job: typeof JobQueue.Type = {
  id: JobQueueId.make('e50e8400-e29b-41d4-a716-446655440004'),
  workspaceId,
  entityType: 'research',
  entityId: runId,
  status: 'in-progress',
  payload: { projectId, sourceVersionIds: [sourceVersionId] },
  attempts: 1,
  maxAttempts: 1,
  createdAt: 0n,
  updatedAt: 0n,
}
const run: typeof ResearchRun.Type = {
  id: runId,
  threadId: ResearchThreadId.make('e50e8400-e29b-41d4-a716-446655440005'),
  question: 'When is launch?',
  status: 'pending',
  createdAt: 0n,
  updatedAt: 0n,
}
const evidence = [{
  sourceVersionId,
  locator: 'lines:1-1',
  excerpt: 'Launch is July 18.',
  rank: 1,
}] as const

function deps(failWorkflow = false) {
  const events: string[] = []
  const eventPayloads: unknown[] = []
  const completed: unknown[] = []
  const failed: unknown[] = []
  const value: ResearchWorkerDeps & {
    readonly calls: {
      readonly events: string[]
      readonly eventPayloads: unknown[]
      readonly completed: unknown[]
      readonly failed: unknown[]
    }
  } = {
    now: () => 1700000000000n,
    staleAfterMs: 300_000,
    heartbeatIntervalMs: 10_000,
    randomEventId: () => EventJournalId.make(crypto.randomUUID()),
    randomCitationId: () => CitationId.make(crypto.randomUUID()),
    jobs: {
      recoverStale: () => Effect.succeed([]),
      claimNext: () => Effect.succeed(Option.some(job)),
      renewLease: () => Effect.void,
      appendInProgressEvent: (claimedJob, journalEvent) => {
        expect(claimedJob).toBe(job)
        events.push(journalEvent.eventType)
        eventPayloads.push(journalEvent.payload)
        return Effect.void
      },
      complete: (input) => {
        completed.push(input)
        events.push(input.event.eventType)
        eventPayloads.push(input.event.payload)
        return Effect.void
      },
      fail: (input) => {
        failed.push(input)
        events.push(input.event.eventType)
        eventPayloads.push(input.event.payload)
        return Effect.void
      },
    },
    runs: { findById: () => Effect.succeed(run) },
    workflow: {
      run: ({ onRetrievalCompleted }) =>
        failWorkflow
          ? Effect.fail({ _tag: 'EvidenceInsufficientError' })
          : onRetrievalCompleted(evidence).pipe(
              Effect.as({
                plan: {
                  query: run.question,
                  maxSteps: 5 as const,
                  maxToolCalls: 1 as const,
                  maxModelCalls: 1 as const,
                },
                evidence,
                answer: {
                  answer: 'Launch is July 18.',
                  citations: [{ sourceVersionId, locator: 'lines:1-1' }],
                },
              }),
            ),
    },
    calls: { events, eventPayloads, completed, failed },
  }
  return value
}

describe('processOneResearchJob', () => {
  it('persists a grounded result and emits the narrowed event sequence', async () => {
    const testDeps = deps()
    const result = await Effect.runPromise(processOneResearchJob(testDeps))

    expect(result).toEqual({ processed: true, jobId: job.id })
    expect(testDeps.calls.events).toEqual([
      'retrieval-completed',
      'citations-validated',
      'research-completed',
    ])
    expect(testDeps.calls.completed).toHaveLength(1)
    expect(testDeps.calls.failed).toHaveLength(0)
  })

  it('fails safely instead of synthesizing when evidence is insufficient', async () => {
    const testDeps = deps(true)
    await Effect.runPromise(processOneResearchJob(testDeps))

    expect(testDeps.calls.events).toEqual(['research-failed'])
    expect(testDeps.calls.completed).toHaveLength(0)
    expect(testDeps.calls.failed).toHaveLength(1)
    expect(JSON.stringify(testDeps.calls.eventPayloads)).not.toContain('Launch is July 18.')
  })

  it('normalizes unsafe or oversized workflow tags before failure persistence', async () => {
    const base = deps()
    const testDeps: ResearchWorkerDeps = {
      ...base,
      workflow: {
        run: () => Effect.fail({
          _tag: `Unsafe tag ${'x'.repeat(80)}`,
          secret: 'must not be journaled',
        }),
      },
    }

    await Effect.runPromise(processOneResearchJob(testDeps))

    expect(base.calls.eventPayloads).toEqual([{
      errorTag: 'ResearchWorkflowError',
      message: 'Research failed',
    }])
    expect(JSON.stringify(base.calls.eventPayloads)).not.toContain('must not be journaled')
  })

  it.each([
    [
      'EvidenceInsufficientError',
      new EvidenceInsufficientError({
        question: run.question,
        message: 'Evidence was insufficient',
      }),
      'EvidenceInsufficientError',
    ],
    [
      'EvidenceContradictionError',
      new EvidenceContradictionError({
        question: run.question,
        conflictCount: 1,
        message: 'Evidence contradicted itself',
      }),
      'EvidenceContradictionError',
    ],
    [
      'ResearchCitationValidationError',
      new ResearchCitationValidationError({
        sourceVersionId,
        locator: evidence[0].locator,
        message: 'Citation was rejected',
      }),
      'ResearchCitationValidationError',
    ],
  ])('durably records the exact typed document-research failure tag: %s', async (
    _label,
    failure,
    expectedTag,
  ) => {
    const base = deps()
    const testDeps: ResearchWorkerDeps = {
      ...base,
      workflow: {
        run: () => Effect.fail(failure),
      },
    }

    await Effect.runPromise(processOneResearchJob(testDeps))

    expect(base.calls.events).toEqual(['research-failed'])
    expect(base.calls.eventPayloads).toEqual([{
      errorTag: expectedTag,
      message: 'Research failed',
    }])
  })

  it('durably exposes retrieval completion while synthesis is blocked and retains it on failure', async () => {
    const base = deps()
    let releaseSynthesis!: () => void
    const synthesisGate = new Promise<void>((resolve) => {
      releaseSynthesis = resolve
    })
    let retrievalPersisted!: () => void
    const retrievalVisible = new Promise<void>((resolve) => {
      retrievalPersisted = resolve
    })
    const testDeps: ResearchWorkerDeps = {
      ...base,
      workflow: {
        run: ({ onRetrievalCompleted }) =>
          Effect.gen(function* () {
            yield* onRetrievalCompleted(evidence)
            retrievalPersisted()
            yield* Effect.promise(() => synthesisGate)
            return yield* Effect.fail({ _tag: 'SynthesisError' })
          }),
      },
    }

    const processing = Effect.runPromise(processOneResearchJob(testDeps))
    await retrievalVisible

    expect(base.calls.events).toEqual(['retrieval-completed'])
    expect(base.calls.failed).toHaveLength(0)

    releaseSynthesis()
    await processing

    expect(base.calls.events).toEqual([
      'retrieval-completed',
      'research-failed',
    ])
    expect(base.calls.failed).toHaveLength(1)
  })

  it('terminal-fails stale in-progress research work before claiming new work', async () => {
    const base = deps()
    const failedBefore = await Effect.runPromise(
      Metric.value(walkingSliceMetrics['runs.failed']),
    )
    const testDeps = {
      ...base,
      jobs: {
        ...base.jobs,
        recoverStale: () => Effect.succeed([job]),
        claimNext: () => Effect.succeed(Option.none()),
      },
    }

    const result = await Effect.runPromise(processOneResearchJob(testDeps))
    const failedAfter = await Effect.runPromise(
      Metric.value(walkingSliceMetrics['runs.failed']),
    )

    expect(result).toEqual({ processed: false })
    expect(Number(failedAfter.count) - Number(failedBefore.count)).toBe(1)
    expect(testDeps.calls.events).toEqual([])
    expect(testDeps.calls.failed).toHaveLength(0)
  })

  it('renews the attempt-fenced lease while a legitimate workflow remains active', async () => {
    const base = deps()
    let renewals = 0
    let secondRenewal!: () => void
    const renewedTwice = new Promise<void>((resolve) => {
      secondRenewal = resolve
    })
    let releaseWorkflow!: () => void
    const workflowGate = new Promise<void>((resolve) => {
      releaseWorkflow = resolve
    })
    let workflowStarted!: () => void
    const started = new Promise<void>((resolve) => {
      workflowStarted = resolve
    })
    const testDeps: ResearchWorkerDeps = {
      ...base,
      heartbeatIntervalMs: 2,
      jobs: {
        ...base.jobs,
        renewLease: (claimedJob) => {
          expect(claimedJob.id).toBe(job.id)
          expect(claimedJob.attempts).toBe(job.attempts)
          renewals += 1
          if (renewals === 2) secondRenewal()
          return Effect.void
        },
      },
      workflow: {
        run: (input) =>
          Effect.gen(function* () {
            workflowStarted()
            yield* Effect.promise(() => workflowGate)
            return yield* base.workflow.run(input)
          }),
      },
    }

    const processing = Effect.runPromise(processOneResearchJob(testDeps))
    await started
    await Promise.race([
      renewedTwice,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('second lease renewal did not run')), 250),
      ),
    ])
    expect(renewals).toBeGreaterThanOrEqual(2)
    expect(base.calls.failed).toHaveLength(0)

    releaseWorkflow()
    await expect(processing).resolves.toEqual({
      processed: true,
      jobId: job.id,
    })
    expect(base.calls.completed).toHaveLength(1)
  })

  it('interrupts work without a terminal write when heartbeat ownership is lost', async () => {
    const base = deps()
    const ownershipLost = new ResearchJobOwnershipLostError({
      transition: 'renew-lease',
      message: 'Research job no longer has in-progress ownership',
    })
    const testDeps: ResearchWorkerDeps = {
      ...base,
      heartbeatIntervalMs: 1,
      jobs: {
        ...base.jobs,
        renewLease: () => Effect.fail(ownershipLost),
      },
      workflow: {
        run: () => Effect.never,
      },
    }

    await expect(
      Effect.runPromise(processOneResearchJob(testDeps)),
    ).resolves.toEqual({
      processed: true,
      jobId: job.id,
    })
    expect(base.calls.completed).toHaveLength(0)
    expect(base.calls.failed).toHaveLength(0)
  })

  it('rejects a late retrieval callback after terminal failure', async () => {
    const base = deps()
    let terminal = false
    let lateCallback:
      | ((items: typeof evidence) => Effect.Effect<unknown, unknown, never>)
      | undefined
    const testDeps: ResearchWorkerDeps = {
      ...base,
      jobs: {
        ...base.jobs,
        appendInProgressEvent: (claimedJob, journalEvent) =>
          terminal
            ? Effect.fail(new Error('research-event-ownership-lost'))
            : base.jobs.appendInProgressEvent(claimedJob, journalEvent),
        fail: (input) => {
          terminal = true
          return base.jobs.fail(input)
        },
      },
      workflow: {
        run: ({ onRetrievalCompleted }) => {
          lateCallback = onRetrievalCompleted as typeof lateCallback
          return Effect.fail({ _tag: 'ResearchWorkflowError' })
        },
      },
    }

    await Effect.runPromise(processOneResearchJob(testDeps))
    expect(lateCallback).toBeDefined()
    const lateExit = await Effect.runPromiseExit(lateCallback!(evidence))

    expect(terminal).toBe(true)
    expect(Exit.isFailure(lateExit)).toBe(true)
    expect(base.calls.events).toEqual(['research-failed'])
  })

  it('stops safely when stale recovery takes ownership before citations are appended', async () => {
    const base = deps()
    let appendCount = 0
    const ownershipLost = new ResearchJobOwnershipLostError({
      transition: 'append-event',
      message: 'Research job no longer has in-progress ownership',
    })
    const testDeps: ResearchWorkerDeps = {
      ...base,
      jobs: {
        ...base.jobs,
        appendInProgressEvent: (claimedJob, journalEvent) => {
          appendCount += 1
          return appendCount === 1
            ? base.jobs.appendInProgressEvent(claimedJob, journalEvent)
            : Effect.fail(ownershipLost)
        },
      },
    }

    const result = await Effect.runPromise(processOneResearchJob(testDeps))

    expect(result).toEqual({ processed: true, jobId: job.id })
    expect(base.calls.events).toEqual(['retrieval-completed'])
    expect(base.calls.completed).toHaveLength(0)
    expect(base.calls.failed).toHaveLength(0)
  })

  it('stops safely when stale recovery takes ownership before completion', async () => {
    const base = deps()
    const ownershipLost = new ResearchJobOwnershipLostError({
      transition: 'complete',
      message: 'Research job no longer has in-progress ownership',
    })
    const testDeps: ResearchWorkerDeps = {
      ...base,
      jobs: {
        ...base.jobs,
        complete: () => Effect.fail(ownershipLost),
      },
    }

    const result = await Effect.runPromise(processOneResearchJob(testDeps))

    expect(result).toEqual({ processed: true, jobId: job.id })
    expect(base.calls.events).toEqual([
      'retrieval-completed',
      'citations-validated',
    ])
    expect(base.calls.completed).toHaveLength(0)
    expect(base.calls.failed).toHaveLength(0)
  })

  it('keeps non-ownership terminal persistence failures fatal to the poll loop', async () => {
    const base = deps(true)
    const persistenceFailure = new Error('database unavailable')
    const testDeps: ResearchWorkerDeps = {
      ...base,
      jobs: {
        ...base.jobs,
        fail: () => Effect.fail(persistenceFailure),
      },
    }

    const exit = await Effect.runPromiseExit(processOneResearchJob(testDeps))

    expect(Exit.isFailure(exit)).toBe(true)
    expect(base.calls.completed).toHaveLength(0)
    expect(base.calls.failed).toHaveLength(0)
  })
})
