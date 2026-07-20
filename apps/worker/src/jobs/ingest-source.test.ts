import { describe, expect, it } from 'bun:test'
import { Effect, Exit, Option } from 'effect'
import {
  AuthorizationError,
  IngestionFailureError,
  JobClaimError,
  JobQueueId,
  ProjectId,
  SourceId,
  SourceTooLargeError,
  SourceVersionId,
  SourceVersionError,
  StorageConfigurationError,
  StoragePathError,
  StorageReadError,
  StorageWriteError,
  UnsupportedSourceTypeError,
  ValidationError,
  WorkspaceId,
} from '@struct/domain'
import {
  EntityNotFoundError,
  IngestionEventValidationError,
  IngestionJobOwnershipLostError,
  QueryError,
  UniqueConstraintError,
} from '@struct/persistence'
import {
  classifyIngestionFailure,
  DeclaredRetryableIngestionError,
  processOneIngestionJob,
  type IngestionWorkerDeps,
} from './ingest-source'

const workspaceId = WorkspaceId.make('850e8400-e29b-41d4-a716-446655440000')
const sourceId = SourceId.make('850e8400-e29b-41d4-a716-446655440002')
const sourceVersionId = SourceVersionId.make('850e8400-e29b-41d4-a716-446655440003')
const projectId = ProjectId.make('850e8400-e29b-41d4-a716-446655440001')

interface IngestionWorkerTestDeps extends IngestionWorkerDeps {
  readonly calls: {
    readonly events: string[]
    readonly eventPayloads: unknown[]
    readonly indexedInputs: unknown[]
    readonly completed: string[]
    readonly pending: string[]
    readonly failed: string[]
    readonly versions: unknown[]
    readonly renewals: string[]
  }
}

const jobId = JobQueueId.make('850e8400-e29b-41d4-a716-446655440010')

function deps(overrides: Partial<Omit<IngestionWorkerDeps, 'calls'>> = {}): IngestionWorkerTestDeps {
  const calls = {
    events: [] as string[],
    eventPayloads: [] as unknown[],
    indexedInputs: [] as unknown[],
    completed: [] as string[],
    pending: [] as string[],
    failed: [] as string[],
    versions: [] as unknown[],
    renewals: [] as string[],
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
        payload: { stagedRef: 'staged://850e8400-e29b-41d4-a716-446655440100/notes.md', name: 'notes.md', mediaType: 'text/markdown', byteLength: 10, projectId },
        attempts: 1,
        maxAttempts: 3,
        createdAt: 0n,
        updatedAt: 0n,
      })),
      renewLease: (job) => {
        calls.renewals.push(job.id)
        return Effect.void
      },
      appendInProgressEvent: (_job, event) => {
        calls.events.push(event.eventType)
        calls.eventPayloads.push(event.payload)
        return Effect.void
      },
      markCompleted: (job, event) => {
        calls.completed.push(job.id)
        calls.events.push(event.eventType)
        calls.eventPayloads.push(event.payload)
        return Effect.void
      },
      markPending: (job, event) => {
        calls.pending.push(job.id)
        calls.events.push(event.eventType)
        calls.eventPayloads.push(event.payload)
        return Effect.void
      },
      markFailed: (job, event) => {
        calls.failed.push(job.id)
        calls.events.push(event.eventType)
        calls.eventPayloads.push(event.payload)
        return Effect.void
      },
    },
    sourceVersions: {
      findBySourceId: () => Effect.succeed([]),
      createForIngestionAttempt: (_job, version) => {
        calls.versions.push(version)
        return Effect.succeed(version)
      },
    },
    textIndex: {
      indexText: (input) => {
        calls.indexedInputs.push(input)
        return Effect.void
      },
    },
    ingestion: {
      ingestTextSource: () => Effect.succeed({
        rawRef: 'artifact://sha256/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        normalizedRef: 'artifact://sha256/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        manifestRef: 'artifact://sha256/cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
        contentHash: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        byteLength: 10,
        normalizedText: 'hello source text',
      }),
    },
    staleAfterMs: 300_000,
    heartbeatIntervalMs: 10,
    calls,
    ...overrides,
  }
}

describe('classifyIngestionFailure', () => {
  const retryableCases: ReadonlyArray<readonly [string, unknown]> = [
    ['explicit declaration', new DeclaredRetryableIngestionError({
      cause: 'upstream-unavailable',
      reason: 'upstream-unavailable',
      message: 'Upstream is temporarily unavailable',
    })],
    ['database query', new QueryError({
      operation: 'findBySourceId',
      entity: 'SourceVersion',
      message: 'database unavailable',
    })],
    ['job claim infrastructure', new JobClaimError({
      operation: 'claim',
      reason: 'connection-reset',
      message: 'Job claim failed',
    })],
    ['storage read infrastructure', new StorageReadError({
      ref: 'staged://850e8400-e29b-41d4-a716-446655440100/notes.md',
      reason: 'io',
      message: 'Artifact read failed',
    })],
    ['storage write infrastructure', new StorageWriteError({
      operation: 'writeObject',
      reason: 'io',
      message: 'Artifact write failed',
    })],
    ['wrapped storage read infrastructure', new IngestionFailureError({
      reason: 'StorageReadError',
      message: 'Staged artifact could not be read',
    })],
    ['wrapped storage write infrastructure', new IngestionFailureError({
      reason: 'StorageWriteError',
      message: 'Artifact could not be stored',
    })],
    ['retrieval/index infrastructure', {
      _tag: 'RetrievalQueryError',
      operation: 'indexText',
      message: 'database unavailable',
    }],
  ]

  const terminalCases: ReadonlyArray<readonly [string, unknown]> = [
    ['payload validation', new ValidationError({
      field: 'payload.stagedRef',
      reason: 'invalid',
      message: 'Invalid staged ref',
    })],
    ['authorization', new AuthorizationError({
      detail: 'workspace mismatch',
      message: 'Unauthorized source',
    })],
    ['storage configuration', new StorageConfigurationError({
      reason: 'not-directory',
      message: 'Invalid storage root',
    })],
    ['storage path/ref', new StoragePathError({
      ref: '../escape',
      reason: 'out-of-root',
      message: 'Unsafe path',
    })],
    ['unsupported source', new UnsupportedSourceTypeError({
      name: 'notes.exe',
      mediaType: 'application/octet-stream',
      message: 'Unsupported source',
    })],
    ['source too large', new SourceTooLargeError({
      name: 'huge.md',
      byteLength: 2_000,
      maxBytes: 1_000,
      message: 'Source too large',
    })],
    ['invalid UTF-8', new IngestionFailureError({
      reason: 'invalid-utf8',
      message: 'Invalid UTF-8',
    })],
    ['source-version integrity', new SourceVersionError({
      sourceVersionId,
      reason: 'hash-mismatch',
      message: 'Immutable hash mismatch',
    })],
    ['missing aggregate', new EntityNotFoundError({
      entity: 'Source',
      id: sourceId,
      message: 'Source not found',
    })],
    ['uniqueness/integrity conflict', new UniqueConstraintError({
      entity: 'SourceVersion',
      field: 'source_id,version',
      message: 'Version conflict',
    })],
    ['event schema/contract', new IngestionEventValidationError({
      transition: 'complete',
      field: 'payload',
      message: 'Invalid completion event',
    })],
    ['undeclared tagged failure', {
      _tag: 'NetworkTimeoutError',
      message: 'timeout',
    }],
    ['ordinary Error', new Error('programmer error')],
    ['primitive throw', 'failed'],
  ]

  it('classifies only explicit transient/infrastructure types as retryable', () => {
    for (const [name, failure] of retryableCases) {
      expect(classifyIngestionFailure(failure), name).toBe('retryable')
    }
    for (const [name, failure] of terminalCases) {
      expect(classifyIngestionFailure(failure), name).toBe('terminal')
    }
  })
})

describe('processOneIngestionJob', () => {
  it('claims one job, ingests artifacts, creates SourceVersion only after artifacts exist, emits events, and completes the job', async () => {
    const testDeps = deps()

    const result = await Effect.runPromise(processOneIngestionJob(testDeps))

    expect(result).toEqual({ processed: true, jobId: '850e8400-e29b-41d4-a716-446655440010' })
    expect(testDeps.calls.events).toEqual(['file-processed', 'ingestion-completed'])
    expect(testDeps.calls.versions).toHaveLength(1)
    expect(testDeps.calls.completed).toEqual(['850e8400-e29b-41d4-a716-446655440010'])
    expect(testDeps.calls.versions[0]).toMatchObject({ artifactRef: 'artifact://sha256/cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc' })
    expect(testDeps.calls.indexedInputs).toEqual([{
      workspaceId,
      projectId,
      sourceVersionId,
      content: 'hello source text',
    }])
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

  it('fails closed when a queued payload omits its project scope', async () => {
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
          payload: {
            stagedRef: 'staged://850e8400-e29b-41d4-a716-446655440100/unscoped.md',
            name: 'unscoped.md',
            mediaType: 'text/markdown',
            byteLength: 10,
          },
          attempts: 1,
          maxAttempts: 3,
          createdAt: 0n,
          updatedAt: 0n,
        })),
      },
    }

    await Effect.runPromise(processOneIngestionJob(testDeps))

    expect(testDeps.calls.completed).toEqual([])
    expect(testDeps.calls.failed).toEqual([jobId])
    expect(testDeps.calls.indexedInputs).toEqual([])
  })

  it('records sanitized ingestion-failed and retries a typed infrastructure failure while attempts remain', async () => {
    const testDeps = deps({
      ingestion: {
        ingestTextSource: () => Effect.fail(new StorageWriteError({
          operation: 'writeObject',
          reason: 'disk-unavailable-at-/Users/dino/secret.txt',
          message: 'Artifact write failed',
        })),
      },
    })

    const result = await Effect.runPromise(processOneIngestionJob(testDeps))

    expect(result).toEqual({ processed: true, jobId: '850e8400-e29b-41d4-a716-446655440010' })
    expect(testDeps.calls.events).toEqual(['ingestion-failed'])
    expect(JSON.stringify(testDeps.calls.eventPayloads)).not.toContain('/Users/')
    expect(testDeps.calls.pending).toEqual(['850e8400-e29b-41d4-a716-446655440010'])
    expect(testDeps.calls.failed).toEqual([])
    expect(testDeps.calls.versions).toEqual([])
    expect(testDeps.calls.eventPayloads).toEqual([{
      jobId,
      attempt: 1,
      errorTag: 'StorageWriteError',
      message: 'Ingestion failed',
      retryable: true,
    }])
  })

  it('rejects non-canonical schemes and mixed-case staged aliases before calling ingestion', async () => {
    for (const stagedRef of [
      'https://attacker.invalid/notes.md',
      'staged://850e8400-e29b-41d4-a716-446655440100/Notes.MD',
    ]) {
      const base = deps()
      let ingestionCalls = 0
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
            payload: {
              stagedRef,
              name: 'Notes.MD',
              mediaType: 'text/markdown',
              byteLength: 10,
              projectId,
            },
            attempts: 1,
            maxAttempts: 3,
            createdAt: 0n,
            updatedAt: 0n,
          })),
        },
        ingestion: {
          ingestTextSource: () => {
            ingestionCalls += 1
            return base.ingestion.ingestTextSource({
              stagedRef:
                'staged://850e8400-e29b-41d4-a716-446655440100/notes.md',
              name: 'Notes.MD',
              mediaType: 'text/markdown',
            })
          },
        },
      }

      await Effect.runPromise(processOneIngestionJob(testDeps))

      expect(ingestionCalls).toBe(0)
      expect(testDeps.calls.pending).toEqual([])
      expect(testDeps.calls.failed).toEqual([jobId])
      expect(testDeps.calls.eventPayloads).toEqual([
        {
          jobId,
          attempt: 1,
          errorTag: 'ValidationError',
          message: 'Ingestion failed',
          retryable: false,
        },
      ])
    }
  })

  it('preserves specific typed Effect error tags in sanitized ingestion-failed events', async () => {
    const testDeps = deps({
      ingestion: {
        ingestTextSource: () => Effect.fail(new IngestionFailureError({ reason: 'invalid-utf8', message: 'Text source is not valid UTF-8' })),
      },
    })

    await Effect.runPromise(processOneIngestionJob(testDeps))

    expect(testDeps.calls.eventPayloads).toEqual([{
      jobId,
      attempt: 1,
      errorTag: 'IngestionFailureError',
      message: 'Ingestion failed',
      retryable: false,
    }])
    expect(testDeps.calls.pending).toEqual([])
    expect(testDeps.calls.failed).toEqual([jobId])
    expect(JSON.stringify(testDeps.calls.eventPayloads)).not.toContain('invalid-utf8')
  })

  it('normalizes unsafe or oversized failure tags before persistence', async () => {
    for (const unsafeTag of ['../../secret', `X${'x'.repeat(100)}`]) {
      const testDeps = deps({
        ingestion: {
          ingestTextSource: () =>
            Effect.fail({ _tag: unsafeTag, detail: '/Users/dino/secret.txt' }),
        },
      })

      await Effect.runPromise(processOneIngestionJob(testDeps))

      expect(testDeps.calls.eventPayloads).toEqual([{
        jobId,
        attempt: 1,
        errorTag: 'IngestionFailure',
        message: 'Ingestion failed',
        retryable: false,
      }])
      expect(JSON.stringify(testDeps.calls.eventPayloads)).not.toContain(
        unsafeTag,
      )
    }
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
          payload: { stagedRef: 'staged://850e8400-e29b-41d4-a716-446655440100/missing.md', name: 'missing.md', mediaType: 'text/markdown', byteLength: 10, projectId },
          attempts: 3,
          maxAttempts: 3,
          createdAt: 0n,
          updatedAt: 0n,
        })),
      },
      ingestion: {
        ingestTextSource: () => Effect.fail(new StorageReadError({
          ref: 'staged://850e8400-e29b-41d4-a716-446655440100/missing.md',
          reason: 'filesystem-unavailable',
          message: 'Staged artifact could not be read',
        })),
      },
    }

    await Effect.runPromise(processOneIngestionJob(testDeps))

    expect(testDeps.calls.failed).toEqual(['850e8400-e29b-41d4-a716-446655440010'])
    expect(testDeps.calls.pending).toEqual([])
    expect(testDeps.calls.eventPayloads).toEqual([{
      jobId,
      attempt: 3,
      errorTag: 'StorageReadError',
      message: 'Ingestion failed',
      retryable: true,
    }])
  })

  it('terminal-fails an undeclared failure on the first attempt and emits one bounded event', async () => {
    let claimed = false
    const base = deps({
      ingestion: {
        ingestTextSource: () =>
          Effect.fail(new Error('deterministic invariant failed at /Users/dino/secret.txt')),
      },
    })
    const testDeps: IngestionWorkerTestDeps = {
      ...base,
      jobs: {
        ...base.jobs,
        claimNextIngestionJob: () => {
          if (claimed) return Effect.succeed(Option.none())
          claimed = true
          return base.jobs.claimNextIngestionJob()
        },
      },
    }

    await Effect.runPromise(processOneIngestionJob(testDeps))
    await Effect.runPromise(processOneIngestionJob(testDeps))

    expect(testDeps.calls.pending).toEqual([])
    expect(testDeps.calls.failed).toEqual([jobId])
    expect(testDeps.calls.events).toEqual(['ingestion-failed'])
    expect(testDeps.calls.eventPayloads).toEqual([{
      jobId,
      attempt: 1,
      errorTag: 'IngestionFailure',
      message: 'Ingestion failed',
      retryable: false,
    }])
    expect(JSON.stringify(testDeps.calls.eventPayloads).length).toBeLessThan(256)
  })

  it('relies on atomic repository recovery for stale exhausted terminal events', async () => {
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
    expect(testDeps.calls.events).toEqual([])
    expect(testDeps.calls.eventPayloads).toEqual([])
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
          payload: { stagedRef: 'staged://850e8400-e29b-41d4-a716-446655440100/notes.md', name: 'notes.md', mediaType: 'text/markdown', byteLength: 10, projectId },
          attempts: 2,
          maxAttempts: 3,
          createdAt: 0n,
          updatedAt: 0n,
        })),
      },
      sourceVersions: {
        findBySourceId: () => Effect.succeed([existing]),
        createForIngestionAttempt: (_job, version) => {
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

  it('stops a stale attempt before it can append file or terminal events', async () => {
    const base = deps()
    const testDeps: IngestionWorkerTestDeps = {
      ...base,
      jobs: {
        ...base.jobs,
        appendInProgressEvent: (job) =>
          Effect.fail(new IngestionJobOwnershipLostError({
            jobId: job.id,
            attempt: job.attempts,
            transition: 'append-event',
            message: 'lease moved',
          })),
      },
    }

    await expect(
      Effect.runPromise(processOneIngestionJob(testDeps)),
    ).resolves.toEqual({ processed: true, jobId })
    expect(testDeps.calls.events).toEqual([])
    expect(testDeps.calls.completed).toEqual([])
    expect(testDeps.calls.pending).toEqual([])
    expect(testDeps.calls.failed).toEqual([])
  })

  it('does not append failure after a stale attempt loses completion ownership', async () => {
    const base = deps()
    const testDeps: IngestionWorkerTestDeps = {
      ...base,
      jobs: {
        ...base.jobs,
        markCompleted: (job) =>
          Effect.fail(new IngestionJobOwnershipLostError({
            jobId: job.id,
            attempt: job.attempts,
            transition: 'complete',
            message: 'lease moved',
          })),
      },
    }

    await Effect.runPromise(processOneIngestionJob(testDeps))

    expect(testDeps.calls.events).toEqual(['file-processed'])
    expect(testDeps.calls.pending).toEqual([])
    expect(testDeps.calls.failed).toEqual([])
  })

  it('keeps non-ownership failure-transition infrastructure faults fatal', async () => {
    const base = deps({
      ingestion: {
        ingestTextSource: () => Effect.fail(new Error('storage unavailable')),
      },
    })
    const testDeps: IngestionWorkerTestDeps = {
      ...base,
      jobs: {
        ...base.jobs,
        markFailed: () =>
          Effect.fail(new QueryError({
            operation: 'markFailed',
            entity: 'JobQueue',
            message: 'database unavailable',
          })),
      },
    }

    const exit = await Effect.runPromiseExit(processOneIngestionJob(testDeps))
    expect(exit._tag).toBe('Failure')
  })

  it('renews the exact claimed attempt repeatedly while ingestion remains active', async () => {
    const base = deps()
    let renewals = 0
    let renewedTwice!: () => void
    const twoRenewals = new Promise<void>((resolve) => {
      renewedTwice = resolve
    })
    let releaseIngestion!: () => void
    const ingestionGate = new Promise<void>((resolve) => {
      releaseIngestion = resolve
    })
    let ingestionStarted!: () => void
    const started = new Promise<void>((resolve) => {
      ingestionStarted = resolve
    })
    const testDeps: IngestionWorkerTestDeps = {
      ...base,
      heartbeatIntervalMs: 2,
      jobs: {
        ...base.jobs,
        renewLease: (claimedJob) => {
          expect(claimedJob.id).toBe(jobId)
          expect(claimedJob.workspaceId).toBe(workspaceId)
          expect(claimedJob.entityId).toBe(sourceId)
          expect(claimedJob.attempts).toBe(1)
          renewals += 1
          if (renewals === 2) renewedTwice()
          return Effect.void
        },
      },
      ingestion: {
        ingestTextSource: () =>
          Effect.gen(function* () {
            ingestionStarted()
            yield* Effect.promise(() => ingestionGate)
            return yield* base.ingestion.ingestTextSource({
              stagedRef:
                'staged://850e8400-e29b-41d4-a716-446655440100/notes.md',
              name: 'notes.md',
              mediaType: 'text/markdown',
            })
          }),
      },
    }

    const processing = Effect.runPromise(processOneIngestionJob(testDeps))
    await started
    await Promise.race([
      twoRenewals,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('second ingestion lease renewal did not run')), 250),
      ),
    ])
    expect(renewals).toBeGreaterThanOrEqual(2)
    expect(base.calls.events).toEqual([])

    releaseIngestion()
    await expect(processing).resolves.toEqual({ processed: true, jobId })
    expect(base.calls.completed).toEqual([jobId])
  })

  it('interrupts claimed work without late writes when heartbeat ownership is lost', async () => {
    const base = deps()
    let interrupted = false
    const testDeps: IngestionWorkerTestDeps = {
      ...base,
      heartbeatIntervalMs: 1,
      jobs: {
        ...base.jobs,
        renewLease: (claimedJob) =>
          Effect.fail(new IngestionJobOwnershipLostError({
            jobId: claimedJob.id,
            attempt: claimedJob.attempts,
            transition: 'renew-lease',
            message: 'lease moved',
          })),
      },
      ingestion: {
        ingestTextSource: () =>
          Effect.never.pipe(
            Effect.onInterrupt(() =>
              Effect.sync(() => {
                interrupted = true
              }),
            ),
          ),
      },
    }

    await expect(
      Effect.runPromise(processOneIngestionJob(testDeps)),
    ).resolves.toEqual({ processed: true, jobId })
    expect(interrupted).toBe(true)
    expect(base.calls.events).toEqual([])
    expect(base.calls.versions).toEqual([])
    expect(base.calls.completed).toEqual([])
    expect(base.calls.pending).toEqual([])
    expect(base.calls.failed).toEqual([])
  })

  it('propagates heartbeat infrastructure failure and interrupts claimed work', async () => {
    const base = deps()
    let interrupted = false
    const heartbeatFailure = new QueryError({
      operation: 'renewIngestionLease',
      entity: 'JobQueue',
      message: 'database unavailable',
    })
    const testDeps: IngestionWorkerTestDeps = {
      ...base,
      heartbeatIntervalMs: 1,
      jobs: {
        ...base.jobs,
        renewLease: () => Effect.fail(heartbeatFailure),
      },
      ingestion: {
        ingestTextSource: () =>
          Effect.never.pipe(
            Effect.onInterrupt(() =>
              Effect.sync(() => {
                interrupted = true
              }),
            ),
          ),
      },
    }

    const exit = await Effect.runPromiseExit(processOneIngestionJob(testDeps))
    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      expect(String(exit.cause)).toContain('database unavailable')
    }
    expect(interrupted).toBe(true)
    expect(base.calls.events).toEqual([])
    expect(base.calls.completed).toEqual([])
    expect(base.calls.pending).toEqual([])
    expect(base.calls.failed).toEqual([])
  })
})
