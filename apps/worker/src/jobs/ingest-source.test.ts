import { describe, expect, it } from 'vitest'
import { Effect, Exit, Option } from 'effect'
import { IngestionFailureError, JobQueueId, SourceId, SourceVersionId, WorkspaceId } from '@struct/domain'
import { processOneIngestionJob, type IngestionWorkerDeps } from './ingest-source'

const workspaceId = WorkspaceId.make('850e8400-e29b-41d4-a716-446655440000')
const sourceId = SourceId.make('850e8400-e29b-41d4-a716-446655440002')
const sourceVersionId = SourceVersionId.make('850e8400-e29b-41d4-a716-446655440003')

interface IngestionWorkerTestDeps extends IngestionWorkerDeps {
  readonly calls: {
    readonly events: string[]
    readonly eventPayloads: unknown[]
    readonly completed: string[]
    readonly pending: string[]
    readonly failed: string[]
    readonly versions: unknown[]
  }
}

const jobId = JobQueueId.make('850e8400-e29b-41d4-a716-446655440010')

function deps(overrides: Partial<Omit<IngestionWorkerDeps, 'calls'>> = {}): IngestionWorkerTestDeps {
  const calls = {
    events: [] as string[],
    eventPayloads: [] as unknown[],
    completed: [] as string[],
    pending: [] as string[],
    failed: [] as string[],
    versions: [] as unknown[],
  }
  return {
    now: () => 1700000000000n,
    randomSourceVersionId: () => sourceVersionId,
    jobs: {
      recoverStaleIngestionJobs: () => Effect.succeed({ requeued: [], failed: [] }),
      claimNextIngestionJob: () => Effect.succeed(Option.some({
        id: jobId,
        workspaceId,
        entityType: 'ingestion',
        entityId: sourceId,
        status: 'in-progress' as const,
        payload: { stagedRef: 'staged://850e8400-e29b-41d4-a716-446655440100/notes.md', name: 'notes.md', mediaType: 'text/markdown', byteLength: 10 },
        attempts: 1,
        maxAttempts: 3,
        createdAt: 0n,
        updatedAt: 0n,
      })),
      markCompleted: (id) => {
        calls.completed.push(id)
        return Effect.void
      },
      markPending: (id) => {
        calls.pending.push(id)
        return Effect.void
      },
      markFailed: (id) => {
        calls.failed.push(id)
        return Effect.void
      },
    },
    sourceVersions: {
      findBySourceId: () => Effect.succeed([]),
      create: (version) => {
        calls.versions.push(version)
        return Effect.succeed(version)
      },
    },
    events: {
      append: (event) => {
        calls.events.push(event.eventType)
        calls.eventPayloads.push(event.payload)
        return Effect.succeed(event)
      },
    },
    ingestion: {
      ingestTextSource: () => Effect.succeed({
        rawRef: 'artifact://sha256/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        normalizedRef: 'artifact://sha256/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        manifestRef: 'artifact://sha256/cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
        contentHash: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        byteLength: 10,
      }),
    },
    staleBeforeMs: 1699999999999,
    calls,
    ...overrides,
  }
}

describe('processOneIngestionJob', () => {
  it('claims one job, ingests artifacts, creates SourceVersion only after artifacts exist, emits events, and completes the job', async () => {
    const testDeps = deps()

    const result = await Effect.runPromise(processOneIngestionJob(testDeps))

    expect(result).toEqual({ processed: true, jobId: '850e8400-e29b-41d4-a716-446655440010' })
    expect(testDeps.calls.events).toEqual(['file-processed', 'ingestion-completed'])
    expect(testDeps.calls.versions).toHaveLength(1)
    expect(testDeps.calls.completed).toEqual(['850e8400-e29b-41d4-a716-446655440010'])
    expect(testDeps.calls.versions[0]).toMatchObject({ artifactRef: 'artifact://sha256/cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc' })
    expect(JSON.stringify(testDeps.calls.events)).not.toContain('hello source text')
    expect(JSON.stringify(testDeps.calls.events)).not.toContain('/Users/')
  })

  it('creates the next immutable version number without mutating existing SourceVersions', async () => {
    const base = deps()
    const testDeps: IngestionWorkerTestDeps = {
      ...base,
      sourceVersions: {
        ...base.sourceVersions,
        findBySourceId: () => Effect.succeed([{ id: sourceVersionId, sourceId, version: 4, artifactRef: 'artifact://sha256/old', contentHash: 'sha256:old', createdAt: 0n }]),
      },
    }

    await Effect.runPromise(processOneIngestionJob(testDeps))

    expect(testDeps.calls.versions).toHaveLength(1)
    expect(testDeps.calls.versions[0]).toMatchObject({ version: 5 })
  })

  it('records sanitized ingestion-failed and retries while attempts remain when storage or ingestion fails', async () => {
    const testDeps = deps({
      ingestion: {
        ingestTextSource: () => Effect.fail(new Error('disk failed at /Users/dino/secret.txt')),
      },
    })

    const result = await Effect.runPromise(processOneIngestionJob(testDeps))

    expect(result).toEqual({ processed: true, jobId: '850e8400-e29b-41d4-a716-446655440010' })
    expect(testDeps.calls.events).toEqual(['ingestion-failed'])
    expect(JSON.stringify(testDeps.calls.eventPayloads)).not.toContain('/Users/')
    expect(testDeps.calls.pending).toEqual(['850e8400-e29b-41d4-a716-446655440010'])
    expect(testDeps.calls.failed).toEqual([])
    expect(testDeps.calls.versions).toEqual([])
  })

  it('preserves specific typed Effect error tags in sanitized ingestion-failed events', async () => {
    const testDeps = deps({
      ingestion: {
        ingestTextSource: () => Effect.fail(new IngestionFailureError({ reason: 'invalid-utf8', message: 'Text source is not valid UTF-8' })),
      },
    })

    await Effect.runPromise(processOneIngestionJob(testDeps))

    expect(testDeps.calls.eventPayloads).toEqual([{ errorTag: 'IngestionFailureError', message: 'Ingestion failed' }])
    expect(JSON.stringify(testDeps.calls.eventPayloads)).not.toContain('invalid-utf8')
  })

  it('terminal-fails exhausted jobs instead of retrying forever', async () => {
    const base = deps()
    const testDeps: IngestionWorkerTestDeps = {
      ...base,
      jobs: {
        ...base.jobs,
        claimNextIngestionJob: () => Effect.succeed(Option.some({
          id: jobId,
          workspaceId,
          entityType: 'ingestion',
          entityId: sourceId,
          status: 'in-progress' as const,
          payload: { stagedRef: 'staged://850e8400-e29b-41d4-a716-446655440100/missing.md', name: 'missing.md', mediaType: 'text/markdown', byteLength: 10 },
          attempts: 3,
          maxAttempts: 3,
          createdAt: 0n,
          updatedAt: 0n,
        })),
      },
      ingestion: { ingestTextSource: () => Effect.fail(new Error('missing staged ref /Users/dino/secret.txt')) },
    }

    await Effect.runPromise(processOneIngestionJob(testDeps))

    expect(testDeps.calls.failed).toEqual(['850e8400-e29b-41d4-a716-446655440010'])
    expect(testDeps.calls.pending).toEqual([])
  })

  it('emits sanitized ingestion-failed events for stale exhausted jobs recovered before polling', async () => {
    const staleJob = {
      id: jobId,
      workspaceId,
      entityType: 'ingestion',
      entityId: sourceId,
      status: 'failed' as const,
      payload: { stagedRef: 'staged://850e8400-e29b-41d4-a716-446655440100/missing.md', name: '/Users/dino/secret.md', mediaType: 'text/markdown' },
      attempts: 3,
      maxAttempts: 3,
      createdAt: 0n,
      updatedAt: 0n,
    }
    const testDeps = deps({
      jobs: {
        ...deps().jobs,
        recoverStaleIngestionJobs: () => Effect.succeed({ requeued: [], failed: [staleJob] }),
        claimNextIngestionJob: () => Effect.succeed(Option.none()),
      },
    })

    const result = await Effect.runPromise(processOneIngestionJob(testDeps))

    expect(result).toEqual({ processed: false })
    expect(testDeps.calls.events).toEqual(['ingestion-failed'])
    expect(JSON.stringify(testDeps.calls.eventPayloads)).not.toContain('/Users/')
  })

  it('propagates stale-recovery repository failures instead of silently reporting no work', async () => {
    const testDeps = deps({
      jobs: {
        ...deps().jobs,
        recoverStaleIngestionJobs: () => Effect.fail(new Error('database unavailable')),
      },
    })

    const result = await Effect.runPromiseExit(processOneIngestionJob(testDeps))

    expect(Exit.isFailure(result)).toBe(true)
  })

  it('propagates claim repository failures instead of silently reporting no claimed job', async () => {
    const testDeps = deps({
      jobs: {
        ...deps().jobs,
        claimNextIngestionJob: () => Effect.fail(new Error('database unavailable')),
      },
    })

    const result = await Effect.runPromiseExit(processOneIngestionJob(testDeps))

    expect(Exit.isFailure(result)).toBe(true)
  })

  it('reuses an existing SourceVersion on retry when the same job already finalized the same manifest and content hash', async () => {
    const existing = {
      id: SourceVersionId.make('850e8400-e29b-41d4-a716-446655440099'),
      sourceId,
      version: 4,
      artifactRef: 'artifact://sha256/cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
      contentHash: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      createdAt: 0n,
    }
    const base = deps()
    const testDeps: IngestionWorkerTestDeps = {
      ...base,
      jobs: {
        ...base.jobs,
        claimNextIngestionJob: () => Effect.succeed(Option.some({
          id: jobId,
          workspaceId,
          entityType: 'ingestion',
          entityId: sourceId,
          status: 'in-progress' as const,
          payload: { stagedRef: 'staged://850e8400-e29b-41d4-a716-446655440100/notes.md', name: 'notes.md', mediaType: 'text/markdown', byteLength: 10 },
          attempts: 2,
          maxAttempts: 3,
          createdAt: 0n,
          updatedAt: 0n,
        })),
      },
      sourceVersions: {
        findBySourceId: () => Effect.succeed([existing]),
        create: (version) => {
          testDeps.calls.versions.push(version)
          return Effect.succeed(version)
        },
      },
    }

    await Effect.runPromise(processOneIngestionJob(testDeps))

    expect(testDeps.calls.versions).toEqual([])
    expect(testDeps.calls.events).toEqual(['file-processed', 'ingestion-completed'])
    expect(testDeps.calls.completed).toEqual(['850e8400-e29b-41d4-a716-446655440010'])
  })
})
