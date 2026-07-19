import { createHash } from 'node:crypto'
import { describe, expect, it } from 'bun:test'
import { Effect, Exit, Option } from 'effect'
import {
  ProjectId,
  SourceVersionId,
  WorkspaceId,
} from '@struct/domain'
import {
  QueryError,
  SourceTextReindexOwnershipLostError,
  type SourceTextReindexJob,
} from '@struct/persistence'
import {
  processOneSourceTextReindex,
  type SourceTextReindexWorkerDeps,
} from './reindex-source-text'

const workspaceId = WorkspaceId.make('750e8400-e29b-41d4-a716-446655440000')
const projectId = ProjectId.make('750e8400-e29b-41d4-a716-446655440001')
const sourceVersionId = SourceVersionId.make('750e8400-e29b-41d4-a716-446655440003')
const manifestRef = 'artifact://sha256/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const normalizedRef = 'artifact://sha256/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
const normalizedBytes = new TextEncoder().encode('Launch is July 18.\n')
const contentHash = `sha256:${createHash('sha256').update(normalizedBytes).digest('hex')}`
const manifestBytes = new TextEncoder().encode(JSON.stringify({
  kind: 'text-source-manifest',
  version: 1,
  normalizedRef,
  contentHash,
}))
const job: SourceTextReindexJob = {
  sourceVersionId,
  workspaceId,
  projectId,
  artifactRef: manifestRef,
  contentHash,
  status: 'in-progress',
  attempts: 1,
  maxAttempts: 3,
}

function deps(): SourceTextReindexWorkerDeps & {
  readonly indexed: unknown[]
  readonly failures: string[]
} {
  const indexed: unknown[] = []
  const failures: string[] = []
  return {
    staleAfterMs: 300_000,
    heartbeatIntervalMs: 10_000,
    jobs: {
      recoverStale: () => Effect.void,
      claimNext: () => Effect.succeed(Option.some(job)),
      renewLease: () => Effect.void,
      recordFailure: (_job, code) => {
        failures.push(code)
        return Effect.void
      },
    },
    store: {
      readObject: (ref) =>
        Effect.succeed({
          bytes: ref === manifestRef ? manifestBytes : normalizedBytes,
          byteLength: ref === manifestRef
            ? manifestBytes.byteLength
            : normalizedBytes.byteLength,
        }),
    },
    textIndex: {
      indexText: (input) => {
        indexed.push(input)
        return Effect.void
      },
    },
    indexed,
    failures,
  }
}

describe('processOneSourceTextReindex', () => {
  it('passes the stale duration to database-clock recovery', async () => {
    const testDeps = deps()
    const recoveryDurations: number[] = []
    const controlled: SourceTextReindexWorkerDeps = {
      ...testDeps,
      jobs: {
        ...testDeps.jobs,
        recoverStale: (staleAfterMs) => {
          recoveryDurations.push(staleAfterMs)
          return Effect.void
        },
        claimNext: () => Effect.succeed(Option.none()),
      },
    }

    await Effect.runPromise(processOneSourceTextReindex(controlled))
    expect(recoveryDurations).toEqual([300_000])
  })

  it('rebuilds an existing source version from normalized artifacts in tenant scope', async () => {
    const testDeps = deps()

    const result = await Effect.runPromise(processOneSourceTextReindex(testDeps))

    expect(result).toEqual({ processed: true, sourceVersionId })
    expect(testDeps.indexed).toEqual([{
      workspaceId,
      projectId,
      sourceVersionId,
      content: 'Launch is July 18.\n',
      reindexAttempt: 1,
    }])
    expect(testDeps.failures).toEqual([])
  })

  it('records an explicit retryable state when deployment artifacts are unavailable', async () => {
    const testDeps = deps()
    const unavailable: SourceTextReindexWorkerDeps = {
      ...testDeps,
      store: {
        readObject: () =>
          Effect.fail({
            _tag: 'StorageReadError',
            message: 'Artifact could not be read',
          } as never),
      },
    }

    const result = await Effect.runPromise(processOneSourceTextReindex(unavailable))

    expect(result).toEqual({ processed: true, sourceVersionId })
    expect(testDeps.indexed).toEqual([])
    expect(testDeps.failures).toEqual(['artifact-unavailable'])
  })

  it('fails closed when normalized bytes do not match immutable content_hash', async () => {
    const testDeps = deps()
    const corrupted: SourceTextReindexWorkerDeps = {
      ...testDeps,
      store: {
        readObject: (ref) =>
          Effect.succeed({
            bytes: ref === manifestRef
              ? manifestBytes
              : new TextEncoder().encode('corrupted'),
            byteLength: 9,
          }),
      },
    }

    await Effect.runPromise(processOneSourceTextReindex(corrupted))

    expect(testDeps.indexed).toEqual([])
    expect(testDeps.failures).toEqual(['normalized-hash-mismatch'])
  })

  it('treats expected index completion lease loss as a stale-worker no-op', async () => {
    const testDeps = deps()
    const stale: SourceTextReindexWorkerDeps = {
      ...testDeps,
      textIndex: {
        indexText: () =>
          Effect.fail(new SourceTextReindexOwnershipLostError({
            sourceVersionId,
            attempt: 1,
            transition: 'index-text',
            message: 'lease moved',
          })),
      },
    }

    await expect(
      Effect.runPromise(processOneSourceTextReindex(stale)),
    ).resolves.toEqual({ processed: true, sourceVersionId })
    expect(testDeps.failures).toEqual([])
  })

  it('treats expected failure-recording lease loss as a stale-worker no-op', async () => {
    const testDeps = deps()
    const stale: SourceTextReindexWorkerDeps = {
      ...testDeps,
      store: {
        readObject: () =>
          Effect.fail({
            _tag: 'StorageReadError',
            message: 'Artifact could not be read',
          } as never),
      },
      jobs: {
        ...testDeps.jobs,
        recordFailure: () =>
          Effect.fail(new SourceTextReindexOwnershipLostError({
            sourceVersionId,
            attempt: 1,
            transition: 'record-failure',
            message: 'lease moved',
          })),
      },
    }

    await expect(
      Effect.runPromise(processOneSourceTextReindex(stale)),
    ).resolves.toEqual({ processed: true, sourceVersionId })
  })

  it('keeps real failure-recording infrastructure faults fatal', async () => {
    const testDeps = deps()
    const broken: SourceTextReindexWorkerDeps = {
      ...testDeps,
      store: {
        readObject: () =>
          Effect.fail({
            _tag: 'StorageReadError',
            message: 'Artifact could not be read',
          } as never),
      },
      jobs: {
        ...testDeps.jobs,
        recordFailure: () =>
          Effect.fail(new QueryError({
            operation: 'recordFailure',
            entity: 'SourceTextReindexJob',
            message: 'database unavailable',
          })),
      },
    }

    const exit = await Effect.runPromiseExit(processOneSourceTextReindex(broken))
    expect(exit._tag).toBe('Failure')
  })

  it('renews continuously while claimed indexing is active', async () => {
    const testDeps = deps()
    let renewals = 0
    let releaseIndex!: () => void
    const indexGate = new Promise<void>((resolve) => {
      releaseIndex = resolve
    })
    let renewedTwice!: () => void
    const twoRenewals = new Promise<void>((resolve) => {
      renewedTwice = resolve
    })
    const delayed: SourceTextReindexWorkerDeps = {
      ...testDeps,
      heartbeatIntervalMs: 2,
      jobs: {
        ...testDeps.jobs,
        renewLease: (claimedJob) => {
          expect(claimedJob).toEqual(job)
          renewals += 1
          if (renewals === 2) renewedTwice()
          return Effect.void
        },
      },
      textIndex: {
        indexText: () => Effect.promise(() => indexGate),
      },
    }

    const processing = Effect.runPromise(processOneSourceTextReindex(delayed))
    await Promise.race([
      twoRenewals,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('second reindex renewal did not run')), 250),
      ),
    ])
    expect(renewals).toBeGreaterThanOrEqual(2)
    expect(testDeps.failures).toEqual([])
    releaseIndex()
    await expect(processing).resolves.toEqual({ processed: true, sourceVersionId })
  })

  it('interrupts claimed work without a late terminal write when lease ownership is lost', async () => {
    const testDeps = deps()
    let interrupted = false
    const stale: SourceTextReindexWorkerDeps = {
      ...testDeps,
      heartbeatIntervalMs: 1,
      jobs: {
        ...testDeps.jobs,
        renewLease: () =>
          Effect.fail(new SourceTextReindexOwnershipLostError({
            sourceVersionId,
            attempt: 1,
            transition: 'renew-lease',
            message: 'lease moved',
          })),
      },
      textIndex: {
        indexText: () =>
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
      Effect.runPromise(processOneSourceTextReindex(stale)),
    ).resolves.toEqual({ processed: true, sourceVersionId })
    expect(interrupted).toBe(true)
    expect(testDeps.failures).toEqual([])
  })

  it('keeps heartbeat infrastructure failure fatal and interrupts claimed work', async () => {
    const testDeps = deps()
    let interrupted = false
    const heartbeatFailure = new QueryError({
      operation: 'renewSourceTextReindexLease',
      entity: 'SourceTextReindexJob',
      message: 'database unavailable',
    })
    const broken: SourceTextReindexWorkerDeps = {
      ...testDeps,
      heartbeatIntervalMs: 1,
      jobs: {
        ...testDeps.jobs,
        renewLease: () => Effect.fail(heartbeatFailure),
      },
      textIndex: {
        indexText: () =>
          Effect.never.pipe(
            Effect.onInterrupt(() =>
              Effect.sync(() => {
                interrupted = true
              }),
            ),
          ),
      },
    }

    const exit = await Effect.runPromiseExit(
      processOneSourceTextReindex(broken),
    )
    expect(Exit.isFailure(exit)).toBe(true)
    expect(String(exit)).toContain('database unavailable')
    expect(interrupted).toBe(true)
    expect(testDeps.failures).toEqual([])
  })
})
