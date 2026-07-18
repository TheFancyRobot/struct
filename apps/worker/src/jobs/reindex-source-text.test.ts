import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { Effect, Option } from 'effect'
import {
  ProjectId,
  SourceVersionId,
  WorkspaceId,
} from '@struct/domain'
import type { SourceTextReindexJob } from '@struct/persistence'
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
    staleBeforeMs: 1_700_000_000_000,
    jobs: {
      recoverStale: () => Effect.void,
      claimNext: () => Effect.succeed(Option.some(job)),
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
})
