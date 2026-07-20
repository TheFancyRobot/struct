import { describe, expect, it } from 'bun:test'
import {
  RecursiveAnalysisRequest,
  RecursiveAnalysisRequestId,
  RecursiveCorpusManifestEntry,
  ResearchPlanId,
  Sha256Digest,
  SourceVersionId,
  computeRecursiveCorpusManifestDigest,
  type RecursiveCorpusManifest,
  type RecursiveCorpusManifestEntry as ManifestEntry,
  type RecursivePartitionPlan,
  type RecursiveSchedulerState,
} from '@struct/domain'
import { Effect, Schema } from 'effect'
import {
  CorpusPartitioning,
} from '../src/partition-corpus.js'
import { computeRecursiveAnalysisRequestId } from '../src/aggregation-schema.js'

const sha = (character: string) =>
  Sha256Digest.make(`sha256:${character.repeat(64)}`)
const sourceA = SourceVersionId.make('630e8400-e29b-41d4-a716-446655440001')
const sourceB = SourceVersionId.make('630e8400-e29b-41d4-a716-446655440002')

function entry(
  key: string,
  sourceVersionId: typeof sourceA | typeof sourceB = sourceA,
  overrides: Partial<{
    normalizedPath: string
    schemaFamily: string
    byteLength: number
    contentDigest: ReturnType<typeof sha> | null
    disposition: 'included' | 'excluded' | 'unreadable'
    exclusionReason: string | null
    estimatedTokens: number
    estimatedCostMicros: number
    estimatedArtifactBytes: number
  }> = {},
): ManifestEntry {
  const disposition = overrides.disposition ?? 'included'
  return Schema.decodeUnknownSync(RecursiveCorpusManifestEntry)({
    entryKey: key,
    sourceVersionId,
    normalizedPath: overrides.normalizedPath ?? `records/${key}.json`,
    schemaFamily: overrides.schemaFamily ?? 'fam.call-log',
    byteLength: overrides.byteLength ?? 100,
    contentDigest: overrides.contentDigest === undefined
      ? sha(key.slice(0, 1))
      : overrides.contentDigest,
    disposition,
    exclusionReason: overrides.exclusionReason === undefined
      ? disposition === 'included' ? null : `${disposition} fixture`
      : overrides.exclusionReason,
    estimatedTokens: overrides.estimatedTokens ?? 10,
    estimatedCostMicros: overrides.estimatedCostMicros ?? 5,
    estimatedArtifactBytes: overrides.estimatedArtifactBytes ?? 25,
  })
}

function manifest(entries: ReadonlyArray<ManifestEntry>): RecursiveCorpusManifest {
  return {
    version: '1',
    digest: computeRecursiveCorpusManifestDigest(entries),
    entries,
  }
}

function request(
  sources: ReadonlyArray<typeof sourceA | typeof sourceB> = [sourceA],
  policyOverrides: Partial<Schema.Schema.Type<
    typeof RecursiveAnalysisRequest
  >['policy']> = {},
) {
  const withoutId = {
    version: '1' as const,
    runId: '630e8400-e29b-41d4-a716-446655440003',
    planId: '630e8400-e29b-41d4-a716-446655440004',
    workspaceId: '630e8400-e29b-41d4-a716-446655440005',
    projectId: '630e8400-e29b-41d4-a716-446655440006',
    objectiveSignature: sha('f'),
    sourceVersionIds: sources,
    policy: {
      maximumDepth: 4,
      maximumFanOut: 4,
      maximumPartitionItems: 2,
      maximumPartitionAttempts: 3,
      maximumConcurrency: 2,
      maximumElapsedMilliseconds: 60_000,
      maximumTokens: 1_000,
      maximumEstimatedCostMicros: 1_000,
      maximumPartitionBytes: 200,
      maximumArtifactBytes: 100,
      maximumArtifacts: 100,
      ...policyOverrides,
    },
    checkpoint: null,
  }
  const decoded = Schema.decodeUnknownSync(RecursiveAnalysisRequest)({
    ...withoutId,
    id: RecursiveAnalysisRequestId.make(
      `sha256:${'0'.repeat(64)}`,
    ),
  })
  const { id: _id, ...typed } = decoded
  return { ...typed, id: computeRecursiveAnalysisRequestId(typed) }
}

function run<A, E>(effect: Effect.Effect<A, E, CorpusPartitioning>) {
  return Effect.runPromise(effect.pipe(Effect.provide(CorpusPartitioning.Default)))
}

function plan(
  entries: ReadonlyArray<ManifestEntry>,
  recursiveRequest = request(
    Array.from(new Set(entries.map((item) => item.sourceVersionId))),
  ),
) {
  return run(CorpusPartitioning.plan(manifest(entries), recursiveRequest))
}

const artifact = {
  digest: sha('9'),
  byteLength: 25,
  mediaType: 'application/json',
}

describe('bounded recursive corpus partitioning', () => {
  it('keeps the plan, tree, and partitions stable across manifest reordering', async () => {
    const entries = [
      entry('a', sourceA),
      entry('b', sourceA),
      entry('c', sourceB, { schemaFamily: 'fam.telemetry' }),
    ]
    const first = await plan(entries)
    const reordered = await plan([...entries].reverse())
    expect(reordered.id).toBe(first.id)
    expect(reordered.partitions).toEqual(first.partitions)
    expect(reordered.decomposition.nodes).toEqual(first.decomposition.nodes)
  })

  it('changes identities for content, plan, and partition-policy changes', async () => {
    const entries = [entry('a')]
    const original = await plan(entries)
    const changedContent = await plan([
      entry('a', sourceA, { contentDigest: sha('e') }),
    ])
    const changedPolicyRequest = request([sourceA], {
      maximumPartitionItems: 1,
    })
    const changedPolicy = await plan(entries, changedPolicyRequest)
    const changedPlanInput = {
      ...request([sourceA]),
      planId: ResearchPlanId.make('630e8400-e29b-41d4-a716-446655440099'),
    }
    const changedPlanRequest = Schema.decodeUnknownSync(RecursiveAnalysisRequest)({
      ...changedPlanInput,
      id: computeRecursiveAnalysisRequestId(changedPlanInput),
    })
    const changedPlan = await plan(entries, changedPlanRequest)
    expect(changedContent.id).not.toBe(original.id)
    expect(changedPolicy.id).not.toBe(original.id)
    expect(changedPlan.id).not.toBe(original.id)
  })

  it('groups by schema, top-level path, deterministic size band, and plan', async () => {
    const result = await plan([
      entry('a', sourceA, { normalizedPath: 'north/a.json' }),
      entry('b', sourceA, { normalizedPath: 'south/b.json' }),
      entry('c', sourceA, {
        normalizedPath: 'north/c.json',
        schemaFamily: 'fam.telemetry',
      }),
      entry('d', sourceA, {
        normalizedPath: 'north/d.json',
        byteLength: 180,
      }),
    ])
    expect(result.partitions).toHaveLength(4)
    expect(result.partitions.map((partition) => partition.entryKeys)).toEqual([
      ['d'],
      ['a'],
      ['b'],
      ['c'],
    ])
  })

  it('fails closed for an empty corpus or source-lineage mismatch', async () => {
    const empty = await run(Effect.either(
      CorpusPartitioning.plan(manifest([]), request([sourceA])),
    ))
    expect(empty._tag).toBe('Left')
    if (empty._tag === 'Left') expect(empty.left.reason).toBe('invalid-lineage')

    const mismatch = await run(Effect.either(
      CorpusPartitioning.plan(
        manifest([entry('a', sourceA)]),
        request([sourceB]),
      ),
    ))
    expect(mismatch._tag).toBe('Left')
    if (mismatch._tag === 'Left') expect(mismatch.left.reason).toBe('invalid-lineage')
  })

  it('records excluded, unreadable, and oversized metadata without payload reads', async () => {
    const result = await plan([
      entry('a'),
      entry('b', sourceA, { disposition: 'excluded', contentDigest: null }),
      entry('c', sourceA, { disposition: 'unreadable', contentDigest: null }),
      entry('d', sourceA, { byteLength: 201 }),
      entry('e', sourceA, { estimatedArtifactBytes: 101 }),
    ])
    expect(result.partitions.flatMap((partition) => partition.entryKeys)).toEqual(['a'])
    expect(result.skippedEntries.map((item) => item.reason)).toEqual([
      'excluded',
      'unreadable',
      'oversized',
      'oversized',
    ])
  })

  it('accepts exact item, byte, token, cost, artifact, and tree limits', async () => {
    const recursiveRequest = request([sourceA], {
      maximumDepth: 1,
      maximumFanOut: 2,
      maximumPartitionItems: 2,
      maximumTokens: 20,
      maximumEstimatedCostMicros: 10,
      maximumPartitionBytes: 200,
      maximumArtifactBytes: 50,
      maximumArtifacts: 1,
    })
    const result = await plan([entry('a'), entry('b')], recursiveRequest)
    expect(result.partitions).toHaveLength(1)
    expect(result.estimatedTokens).toBe(20)
    expect(result.estimatedCostMicros).toBe(10)
    expect(result.estimatedArtifactBytes).toBe(50)
  })

  it('rejects impossible depth, fan-out, token, cost, and artifact plans', async () => {
    const cases = [
      request([sourceA], { maximumDepth: 1, maximumFanOut: 2, maximumPartitionItems: 1 }),
      request([sourceA], { maximumFanOut: 1, maximumPartitionItems: 1 }),
      request([sourceA], { maximumTokens: 19 }),
      request([sourceA], { maximumEstimatedCostMicros: 9 }),
      request([sourceA], { maximumArtifacts: 1, maximumPartitionItems: 1 }),
    ]
    const entries = [
      entry('a', sourceA, { normalizedPath: 'a/a.json' }),
      entry('b', sourceA, { normalizedPath: 'b/b.json' }),
      entry('c', sourceA, { normalizedPath: 'c/c.json' }),
      entry('d', sourceA, { normalizedPath: 'd/d.json' }),
      entry('e', sourceA, { normalizedPath: 'e/e.json' }),
    ]
    for (const recursiveRequest of cases) {
      const result = await run(Effect.either(
        CorpusPartitioning.plan(
          manifest(entries),
          recursiveRequest,
        ),
      ))
      expect(result._tag).toBe('Left')
    }
  })
})

describe('recursive partition scheduling', () => {
  async function fixture(): Promise<{
    plan: RecursivePartitionPlan
    state: RecursiveSchedulerState
  }> {
    const partitionPlan = await plan([
      entry('a'),
      entry('b', sourceA, { normalizedPath: 'other/b.json' }),
      entry('c', sourceA, { normalizedPath: 'third/c.json' }),
    ])
    const state = await run(CorpusPartitioning.initialState(partitionPlan))
    return { plan: partitionPlan, state }
  }

  it('bounds claims by concurrency and accepts the exact elapsed limit', async () => {
    const setup = await fixture()
    const claimed = await run(CorpusPartitioning.claim(
      setup.plan,
      setup.state,
      setup.plan.request.policy.maximumElapsedMilliseconds,
    ))
    expect(claimed.claims).toHaveLength(2)
    expect(claimed.state.progress.filter((item) => item.status === 'running'))
      .toHaveLength(2)
    const noCapacity = await run(CorpusPartitioning.claim(
      setup.plan,
      claimed.state,
      setup.plan.request.policy.maximumElapsedMilliseconds,
    ))
    expect(noCapacity.claims).toHaveLength(0)
  })

  it('interrupts queued and leased work on cancellation', async () => {
    const setup = await fixture()
    const claimed = await run(CorpusPartitioning.claim(setup.plan, setup.state, 1))
    const cancelled = await run(
      CorpusPartitioning.cancel(setup.plan, claimed.state),
    )
    expect(cancelled.status).toBe('cancelled')
    expect(cancelled.progress.every((item) => item.status === 'cancelled')).toBe(true)
    expect(cancelled.progress.every((item) => item.lease === null)).toBe(true)
  })

  it('recovers lease loss, retries with a new fenced lease, and exhausts deterministically', async () => {
    const setup = await fixture()
    const first = await run(CorpusPartitioning.claim(setup.plan, setup.state, 1))
    const resumed = await run(CorpusPartitioning.resume(setup.plan, first.state))
    expect(resumed.progress.filter((item) => item.status === 'retryable'))
      .toHaveLength(2)
    const second = await run(CorpusPartitioning.claim(setup.plan, resumed, 2))
    expect(second.claims[0]!.lease.id).not.toBe(first.claims[0]!.lease.id)
    expect(second.claims[0]!.lease.attempt).toBe(2)
    const retried = await run(CorpusPartitioning.fail(
      setup.plan,
      second.state,
      second.claims[0]!,
    ))
    const third = await run(CorpusPartitioning.claim(setup.plan, retried, 3))
    const thirdClaim = third.claims.find((claim) =>
      claim.partition.id === first.claims[0]!.partition.id)!
    const exhausted = await run(CorpusPartitioning.fail(
      setup.plan,
      third.state,
      thirdClaim,
    ))
    expect(exhausted.progress.find((item) =>
      item.partitionId === thirdClaim.partition.id)?.status).toBe('failed')
  })

  it('resumes without replaying or duplicating a committed partition', async () => {
    const setup = await fixture()
    const claimed = await run(CorpusPartitioning.claim(setup.plan, setup.state, 1))
    const committed = await run(CorpusPartitioning.commit(
      setup.plan,
      claimed.state,
      claimed.claims[0]!,
      artifact,
      { tokens: 10, estimatedCostMicros: 5 },
    ))
    const resumed = await run(CorpusPartitioning.resume(setup.plan, committed))
    const next = await run(CorpusPartitioning.claim(setup.plan, resumed, 2))
    expect(next.claims.some((claim) =>
      claim.partition.id === claimed.claims[0]!.partition.id)).toBe(false)
    const duplicate = await run(CorpusPartitioning.commit(
      setup.plan,
      resumed,
      claimed.claims[0]!,
      artifact,
      { tokens: 10, estimatedCostMicros: 5 },
    ))
    expect(duplicate).toEqual(resumed)
    expect(duplicate.consumedTokens).toBe(10)
  })

  it('converges to partial when the last running partition commits after a sibling failure', async () => {
    const setup = await fixture()
    const claimed = await run(CorpusPartitioning.claim(setup.plan, setup.state, 1))
    const active = claimed.claims[1]!
    const mixedState: RecursiveSchedulerState = {
      ...claimed.state,
      progress: claimed.state.progress.map((item, index) => {
        if (index === 0) {
          return {
            ...item,
            status: 'failed',
            lease: null,
            terminalReason: {
              kind: 'partition-attempts-exhausted',
              limit: setup.plan.request.policy.maximumPartitionAttempts,
            },
          }
        }
        if (index === 2) {
          return {
            ...item,
            status: 'cancelled',
            lease: null,
            terminalReason: { kind: 'cancelled' },
          }
        }
        return item
      }),
    }
    const committed = await run(CorpusPartitioning.commit(
      setup.plan,
      mixedState,
      active,
      artifact,
      { tokens: 10, estimatedCostMicros: 5 },
    ))
    expect(committed.status).toBe('partial')
  })

  it('terminates uncommitted work after the elapsed-time limit', async () => {
    const setup = await fixture()
    const timedOut = await run(CorpusPartitioning.claim(
      setup.plan,
      setup.state,
      setup.plan.request.policy.maximumElapsedMilliseconds + 1,
    ))
    expect(timedOut.state.status).toBe('failed')
    expect(timedOut.state.progress.every((item) =>
      item.terminalReason?.kind === 'time-limit')).toBe(true)
  })

  it('preserves earlier terminal reasons and cannot cancel a terminal scheduler', async () => {
    const setup = await fixture()
    const first = setup.state.progress[0]!
    const previouslyFailed: RecursiveSchedulerState = {
      ...setup.state,
      status: 'running',
      progress: setup.state.progress.map((item) =>
        item.partitionId === first.partitionId
          ? {
              ...item,
              status: 'failed',
              attempt: setup.plan.request.policy.maximumPartitionAttempts,
              terminalReason: {
                kind: 'partition-attempts-exhausted',
                limit: setup.plan.request.policy.maximumPartitionAttempts,
              },
            }
          : item),
    }
    const timedOut = await run(CorpusPartitioning.claim(
      setup.plan,
      previouslyFailed,
      setup.plan.request.policy.maximumElapsedMilliseconds + 1,
    ))
    expect(timedOut.state.status).toBe('failed')
    expect(timedOut.state.progress[0]!.terminalReason?.kind)
      .toBe('partition-attempts-exhausted')
    expect(timedOut.state.progress.slice(1).every((item) =>
      item.terminalReason?.kind === 'time-limit')).toBe(true)

    const cancelled = await run(
      CorpusPartitioning.cancel(setup.plan, timedOut.state),
    )
    expect(cancelled).toEqual(timedOut.state)
  })

  it('rejects malformed reconstructed lease and artifact accounting state', async () => {
    const setup = await fixture()
    const claimed = await run(CorpusPartitioning.claim(setup.plan, setup.state, 1))
    const missingLease: RecursiveSchedulerState = {
      ...claimed.state,
      progress: claimed.state.progress.map((item, index) =>
        index === 0 ? { ...item, lease: null } : item),
    }
    const leaseFailure = await run(Effect.either(
      CorpusPartitioning.resume(setup.plan, missingLease),
    ))
    expect(leaseFailure._tag).toBe('Left')

    const committed = await run(CorpusPartitioning.commit(
      setup.plan,
      claimed.state,
      claimed.claims[0]!,
      artifact,
      { tokens: 10, estimatedCostMicros: 5 },
    ))
    const wrongArtifactTotal: RecursiveSchedulerState = {
      ...committed,
      committedArtifactBytes: committed.committedArtifactBytes + 1,
    }
    const artifactFailure = await run(Effect.either(
      CorpusPartitioning.resume(setup.plan, wrongArtifactTotal),
    ))
    expect(artifactFailure._tag).toBe('Left')

    const wrongPlanTotal: RecursivePartitionPlan = {
      ...setup.plan,
      estimatedTokens: setup.plan.estimatedTokens + 1,
    }
    const planFailure = await run(Effect.either(
      CorpusPartitioning.resume(wrongPlanTotal, setup.state),
    ))
    expect(planFailure._tag).toBe('Left')
  })

  it('rejects clock rollback and malformed usage before durable mutation', async () => {
    const setup = await fixture()
    const claimed = await run(CorpusPartitioning.claim(setup.plan, setup.state, 10))
    const rollback = await run(Effect.either(CorpusPartitioning.claim(
      setup.plan,
      claimed.state,
      9,
    )))
    expect(rollback._tag).toBe('Left')
    const malformed = await run(Effect.either(CorpusPartitioning.commit(
      setup.plan,
      claimed.state,
      claimed.claims[0]!,
      artifact,
      { tokens: -1, estimatedCostMicros: 0 },
    )))
    expect(malformed._tag).toBe('Left')
  })
})
