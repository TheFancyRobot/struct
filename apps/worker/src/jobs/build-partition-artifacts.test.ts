import { afterEach, describe, expect, it } from 'bun:test'
import {
  JobClaimError,
  RecursiveAnalysisRequestId,
  RecursiveDecompositionNodeId,
  ResearchPlanId,
  Sha256Digest,
  SourceVersionId,
  StorageWriteError,
  type RecursiveBatchInput,
} from '@struct/domain'
import {
  BatchEvidenceArtifacts,
  computeRecursiveBatchId,
  computeRecursivePartitionId,
} from '@struct/research-engine'
import {
  makeBatchSelectionPlan,
  type BatchEvidenceSource,
  type BatchSelectionPlan,
} from '@struct/retrieval'
import {
  LocalArtifactStore,
  type ArtifactStoreShape,
} from '@struct/source-storage'
import { Deferred, Effect, Fiber, Option } from 'effect'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  makeBuildPartitionArtifactsJob,
  type CommittedPartitionEvidenceArtifact,
} from './build-partition-artifacts.js'

const roots: string[] = []
const sourceVersionId = SourceVersionId.make(
  '670e8400-e29b-41d4-a716-446655440001',
)

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) =>
    rm(root, { recursive: true, force: true })))
})

async function localStore(): Promise<ArtifactStoreShape> {
  const root = await mkdtemp(join(tmpdir(), 'struct-partition-artifacts-'))
  roots.push(root)
  return Effect.runPromise(LocalArtifactStore.make({ root }))
}

function fixtureSource(): BatchEvidenceSource {
  const bytes = new TextEncoder().encode(JSON.stringify([
    { active: true, name: 'A', amount: 0.1, team: 'blue' },
    { active: true, name: 'B', amount: 0.2, team: 'blue' },
  ]))
  return {
    entryKey: 'events-a',
    sourceVersionId,
    normalizedPath: 'events/a.json',
    schemaFamily: 'events-v1',
    bytes,
    contentDigest: Sha256Digest.make(
      `sha256:${new Bun.CryptoHasher('sha256').update(bytes).digest('hex')}`,
    ),
  }
}

function fixtureBatch(source: BatchEvidenceSource): RecursiveBatchInput {
  const nodeId = RecursiveDecompositionNodeId.make(
    `sha256:${'2'.repeat(64)}`,
  )
  const requestId = RecursiveAnalysisRequestId.make(
    `sha256:${'3'.repeat(64)}`,
  )
  const withoutId = {
    nodeId,
    schemaFamily: source.schemaFamily,
    pathGroup: 'events',
    sizeBand: 'small' as const,
    planId: ResearchPlanId.make('670e8400-e29b-41d4-a716-446655440002'),
    sourceVersionIds: [sourceVersionId],
    entryKeys: [source.entryKey],
    byteLength: source.bytes.byteLength,
    estimatedTokens: 100,
    estimatedCostMicros: 10,
    estimatedArtifactBytes: 10_000,
  }
  const partition = {
    ...withoutId,
    id: computeRecursivePartitionId(withoutId),
    ordinal: 0,
  }
  const identity = {
    version: '1' as const,
    requestId,
    nodeId,
    partitionId: partition.id,
    evidenceSchemaVersion: 'evidence-v1',
  }
  return {
    ...identity,
    id: computeRecursiveBatchId(identity),
    partition,
  }
}

async function fixturePlan(): Promise<BatchSelectionPlan> {
  return Effect.runPromise(makeBatchSelectionPlan({
    predicates: [],
    projection: ['name', 'amount'],
    groupBy: ['team'],
    aggregations: [
      { name: 'count', operation: 'count' },
      { name: 'sum', operation: 'sum', field: 'amount' },
    ],
    maximumRecords: 100,
    maximumGroups: 100,
  }))
}

function run<A, E>(
  effect: Effect.Effect<A, E, BatchEvidenceArtifacts>,
): Promise<A> {
  return Effect.runPromise(
    effect.pipe(Effect.provide(BatchEvidenceArtifacts.Default)),
  )
}

describe('build partition artifacts worker job', () => {
  it('keys reuse by the byte-bound transformation identity', async () => {
    const storage = await localStore()
    const source = fixtureSource()
    const batch = fixtureBatch(source)
    const plan = await fixturePlan()
    const committed = new Map<string, CommittedPartitionEvidenceArtifact>()
    const lookupKeys: string[] = []
    let sourceLoads = 0
    const job = makeBuildPartitionArtifactsJob({
      storage,
      loadSources: () => Effect.sync(() => {
        sourceLoads += 1
        return [source]
      }),
      journal: {
        load: (_batchId, transformationIdentity) => Effect.sync(() => {
          lookupKeys.push(transformationIdentity)
          return Option.fromNullable(committed.get(transformationIdentity))
        }),
        commitOrLoad: (candidate) => Effect.sync(() => {
          const existing = committed.get(candidate.transformationIdentity)
          if (existing !== undefined) {
            return { value: existing, disposition: 'existing' as const }
          }
          committed.set(candidate.transformationIdentity, candidate)
          return { value: candidate, disposition: 'created' as const }
        }),
      },
    })

    const first = await run(job.execute(batch, plan, 100_000))
    const same = await run(job.execute(batch, plan, 100_000))
    const changedBound = await run(job.execute(batch, plan, 99_999))

    expect(first.reused).toBe(false)
    expect(same.reused).toBe(true)
    expect(changedBound.reused).toBe(false)
    expect(lookupKeys[1]).toBe(lookupKeys[0])
    expect(lookupKeys[2]).not.toBe(lookupKeys[0])
    expect(changedBound.committed.transformationIdentity)
      .not.toBe(first.committed.transformationIdentity)
    expect(sourceLoads).toBe(2)
  })

  it('commits complete metadata once and reuses it without re-extraction', async () => {
    const storage = await localStore()
    const source = fixtureSource()
    const batch = fixtureBatch(source)
    const plan = await fixturePlan()
    let committed: CommittedPartitionEvidenceArtifact | undefined
    let sourceLoads = 0
    let commits = 0
    const job = makeBuildPartitionArtifactsJob({
      storage,
      loadSources: () => Effect.sync(() => {
        sourceLoads += 1
        return [source]
      }),
      journal: {
        load: () => Effect.succeed(Option.fromNullable(committed)),
        commitOrLoad: (candidate) => Effect.sync(() => {
          if (committed !== undefined) {
            return { value: committed, disposition: 'existing' as const }
          }
          commits += 1
          committed = candidate
          return { value: candidate, disposition: 'created' as const }
        }),
      },
    })

    const first = await run(job.execute(batch, plan, 100_000))
    const second = await run(job.execute(batch, plan, 100_000))

    expect(first.reused).toBe(false)
    expect(second.reused).toBe(true)
    expect(second.committed).toEqual(first.committed)
    expect(sourceLoads).toBe(1)
    expect(commits).toBe(1)

    if (committed === undefined) throw new Error('expected committed fixture')
    committed = { ...committed, evidenceCount: committed.evidenceCount + 1 }
    const corrupted = await run(Effect.either(
      job.execute(batch, plan, 100_000),
    ))
    expect(corrupted._tag).toBe('Left')
    expect(sourceLoads).toBe(1)
  })

  it('does not expose metadata after storage failure or source-side restart', async () => {
    const local = await localStore()
    const source = fixtureSource()
    const batch = fixtureBatch(source)
    const plan = await fixturePlan()
    let commits = 0
    let sourceAttempts = 0
    const failingStorage: ArtifactStoreShape = {
      ...local,
      writeObject: () => Effect.fail(new StorageWriteError({
        operation: 'test',
        reason: 'disk-full',
        message: 'storage unavailable',
      })),
    }
    const journal = {
      load: () => Effect.succeed(
        Option.none<CommittedPartitionEvidenceArtifact>(),
      ),
      commitOrLoad: (candidate: CommittedPartitionEvidenceArtifact) =>
        Effect.sync(() => {
          commits += 1
          return { value: candidate, disposition: 'created' as const }
        }),
    }
    const storageJob = makeBuildPartitionArtifactsJob({
      storage: failingStorage,
      loadSources: () => Effect.succeed([source]),
      journal,
    })
    const storageResult = await run(Effect.either(
      storageJob.execute(batch, plan, 100_000),
    ))
    expect(storageResult._tag).toBe('Left')
    expect(commits).toBe(0)

    const restartJob = makeBuildPartitionArtifactsJob({
      storage: local,
      loadSources: () => Effect.suspend(() => {
        sourceAttempts += 1
        return sourceAttempts === 1
          ? Effect.fail(new JobClaimError({
              operation: 'load-partition-sources',
              reason: 'data-engine-restarted',
              message: 'isolated data engine restarted',
            }))
          : Effect.succeed([source])
      }),
      journal,
    })
    const restartResult = await run(Effect.either(
      restartJob.execute(batch, plan, 100_000),
    ))
    expect(restartResult._tag).toBe('Left')
    expect(commits).toBe(0)
    const recovered = await run(restartJob.execute(batch, plan, 100_000))
    expect(recovered.committed.artifact.digest).toMatch(/^sha256:/)
    expect(commits).toBe(1)
  })

  it('reuses deterministic orphan bytes after a failed metadata commit', async () => {
    const local = await localStore()
    const refs: string[] = []
    const storage: ArtifactStoreShape = {
      ...local,
      writeObject: (bytes, options) => local.writeObject(bytes, options).pipe(
        Effect.tap((stored) => Effect.sync(() => refs.push(stored.ref))),
      ),
    }
    const source = fixtureSource()
    const batch = fixtureBatch(source)
    const plan = await fixturePlan()
    let committed: CommittedPartitionEvidenceArtifact | undefined
    let attempts = 0
    const job = makeBuildPartitionArtifactsJob({
      storage,
      loadSources: () => Effect.succeed([source]),
      journal: {
        load: () => Effect.succeed(Option.fromNullable(committed)),
        commitOrLoad: (candidate) => Effect.suspend(() => {
          attempts += 1
          if (attempts === 1) {
            return Effect.fail(new JobClaimError({
              operation: 'commit-partition-artifact',
              reason: 'transaction-rollback',
              message: 'metadata transaction rolled back',
            }))
          }
          committed = candidate
          return Effect.succeed({
            value: candidate,
            disposition: 'created' as const,
          })
        }),
      },
    })

    const failed = await run(Effect.either(
      job.execute(batch, plan, 100_000),
    ))
    expect(failed._tag).toBe('Left')
    expect(committed).toBeUndefined()
    const recovered = await run(job.execute(batch, plan, 100_000))

    expect(recovered.reused).toBe(false)
    expect(refs).toHaveLength(2)
    expect(refs[1]).toBe(refs[0])
  })

  it('interrupts before metadata publication and validates identities before lookup', async () => {
    const local = await localStore()
    const source = fixtureSource()
    const batch = fixtureBatch(source)
    const plan = await fixturePlan()
    let loads = 0
    let commits = 0
    const forgedPlan = {
      ...plan,
      id: Sha256Digest.make(`sha256:${'f'.repeat(64)}`),
    }
    const journal = {
      load: () => Effect.sync(() => {
        loads += 1
        return Option.none<CommittedPartitionEvidenceArtifact>()
      }),
      commitOrLoad: (candidate: CommittedPartitionEvidenceArtifact) =>
        Effect.sync(() => {
          commits += 1
          return { value: candidate, disposition: 'created' as const }
        }),
    }
    const validationJob = makeBuildPartitionArtifactsJob({
      storage: local,
      loadSources: () => Effect.succeed([source]),
      journal,
    })
    const invalid = await run(Effect.either(
      validationJob.execute(batch, forgedPlan, 100_000),
    ))
    expect(invalid._tag).toBe('Left')
    expect(loads).toBe(0)

    await Effect.runPromise(Effect.gen(function* () {
      const started = yield* Deferred.make<void>()
      const gate = yield* Deferred.make<void>()
      const blockedStorage: ArtifactStoreShape = {
        ...local,
        writeObject: (bytes, options) => Effect.gen(function* () {
          yield* Deferred.succeed(started, undefined)
          yield* Deferred.await(gate)
          return yield* local.writeObject(bytes, options)
        }),
      }
      const cancellationJob = makeBuildPartitionArtifactsJob({
        storage: blockedStorage,
        loadSources: () => Effect.succeed([source]),
        journal,
      })
      const fiber = yield* Effect.fork(cancellationJob.execute(
        batch,
        plan,
        100_000,
      ).pipe(Effect.provide(BatchEvidenceArtifacts.Default)))
      yield* Deferred.await(started)
      yield* Fiber.interrupt(fiber)
    }))
    expect(commits).toBe(0)
  })
})
