import { describe, expect, it } from 'bun:test'
import {
  RecursiveAnalysisRequest,
  RecursiveAnalysisRequestId,
  RecursiveCorpusManifestEntry,
  Sha256Digest,
  SourceVersionId,
  computeRecursiveCorpusManifestDigest,
  type RecursiveCorpusManifest,
} from '@struct/domain'
import {
  CorpusPartitioning,
  computeRecursiveAnalysisRequestId,
} from '@struct/research-engine'
import { Effect, Option, Schema } from 'effect'
import {
  makePartitionAnalysisJob,
  type DurablePartitionAnalysis,
  type PartitionAnalysisJournalEvent,
} from './partition-analysis.js'

const digest = (character: string) =>
  Sha256Digest.make(`sha256:${character.repeat(64)}`)
const sourceVersionId = SourceVersionId.make(
  '640e8400-e29b-41d4-a716-446655440001',
)

function fixture() {
  const entries = ['a', 'b', 'c'].map((key, index) =>
    Schema.decodeUnknownSync(RecursiveCorpusManifestEntry)({
      entryKey: key,
      sourceVersionId,
      normalizedPath: `${key}/${key}.json`,
      schemaFamily: index === 2 ? 'fam.telemetry' : 'fam.call-log',
      byteLength: 100,
      contentDigest: digest(key),
      disposition: 'included',
      exclusionReason: null,
      estimatedTokens: 10,
      estimatedCostMicros: 5,
      estimatedArtifactBytes: 25,
    }))
  const manifest: RecursiveCorpusManifest = {
    version: '1',
    digest: computeRecursiveCorpusManifestDigest(entries),
    entries,
  }
  const withoutId = {
    version: '1' as const,
    runId: '640e8400-e29b-41d4-a716-446655440002',
    planId: '640e8400-e29b-41d4-a716-446655440003',
    workspaceId: '640e8400-e29b-41d4-a716-446655440004',
    projectId: '640e8400-e29b-41d4-a716-446655440005',
    objectiveSignature: digest('f'),
    sourceVersionIds: [sourceVersionId],
    policy: {
      maximumDepth: 4,
      maximumFanOut: 4,
      maximumPartitionItems: 1,
      maximumPartitionAttempts: 3,
      maximumConcurrency: 2,
      maximumElapsedMilliseconds: 60_000,
      maximumTokens: 100,
      maximumEstimatedCostMicros: 100,
      maximumPartitionBytes: 100,
      maximumArtifactBytes: 25,
      maximumArtifacts: 10,
    },
    checkpoint: null,
  }
  const decodedRequest = Schema.decodeUnknownSync(RecursiveAnalysisRequest)({
    ...withoutId,
    id: RecursiveAnalysisRequestId.make(`sha256:${'0'.repeat(64)}`),
  })
  const { id: _id, ...typedRequest } = decodedRequest
  const request = {
    ...typedRequest,
    id: computeRecursiveAnalysisRequestId(typedRequest),
  }
  return { manifest, request }
}

const run = <A, E>(effect: Effect.Effect<A, E, CorpusPartitioning>) =>
  Effect.runPromise(effect.pipe(Effect.provide(CorpusPartitioning.Default)))

describe('partition analysis worker journal surface', () => {
  it('enqueues idempotently, claims bounded work, monitors, and resumes lease loss', async () => {
    const values = new Map<string, DurablePartitionAnalysis>()
    const events: PartitionAnalysisJournalEvent[] = []
    let creates = 0
    const job = makePartitionAnalysisJob({
      load: (planId) => Effect.succeed(Option.fromNullable(values.get(planId))),
      create: (value, event) => Effect.sync(() => {
        creates += 1
        values.set(value.plan.id, value)
        events.push(event)
      }),
      compareAndSwap: (expected, value, event) => Effect.sync(() => {
        if (values.get(value.plan.id) !== expected) return false
        values.set(value.plan.id, value)
        events.push(event)
        return true
      }),
    })
    const input = fixture()

    const enqueued = await run(job.enqueue(input.manifest, input.request))
    const duplicate = await run(job.enqueue(input.manifest, input.request))
    expect(duplicate).toEqual(enqueued)
    expect(creates).toBe(1)

    const claimed = await run(job.claim(enqueued.plan.id, 10))
    expect(claimed.claims).toHaveLength(2)
    expect(claimed.scheduler.progress.filter((item) => item.status === 'running'))
      .toHaveLength(2)

    const monitored = await run(job.monitor(enqueued.plan.id))
    expect(monitored.scheduler).toEqual(claimed.scheduler)

    const resumed = await run(job.resume(enqueued.plan.id))
    expect(resumed.scheduler.progress.filter((item) =>
      item.status === 'retryable')).toHaveLength(2)
    expect(resumed.scheduler.progress.every((item) => item.lease === null)).toBe(true)
    expect(events.map((event) => event.type)).toEqual([
      'partition-analysis-enqueued',
      'partition-analysis-claimed',
      'partition-analysis-resumed',
    ])
  })

  it('atomically fences concurrent claims from the same durable snapshot', async () => {
    const input = fixture()
    const prepared = await Effect.runPromise(
      prepareForTest(input.manifest, input.request),
    )
    let current: DurablePartitionAnalysis = prepared
    let loadCount = 0
    let releaseLoads!: () => void
    const bothLoaded = new Promise<void>((resolve) => {
      releaseLoads = resolve
    })
    const job = makePartitionAnalysisJob({
      load: () => Effect.promise(async () => {
        const snapshot = current
        loadCount += 1
        if (loadCount === 2) releaseLoads()
        await bothLoaded
        return Option.some(snapshot)
      }),
      create: () => Effect.void,
      compareAndSwap: (expected, next) => Effect.sync(() => {
        if (current !== expected) return false
        current = next
        return true
      }),
    })

    const results = await Promise.allSettled([
      run(job.claim(prepared.plan.id, 1)),
      run(job.claim(prepared.plan.id, 1)),
    ])
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1)
    const rejected = results.find((result) => result.status === 'rejected')
    expect(String(rejected?.reason)).toContain('JobClaimError')
    expect(current.scheduler.progress.filter((item) => item.status === 'running'))
      .toHaveLength(input.request.policy.maximumConcurrency)
  })

  it('returns a typed not-found failure for unknown monitoring identity', async () => {
    const job = makePartitionAnalysisJob({
      load: () => Effect.succeed(Option.none()),
      create: () => Effect.void,
      compareAndSwap: () => Effect.succeed(true),
    })
    const result = await run(Effect.either(
      job.monitor('sha256:missing'),
    ))
    expect(result._tag).toBe('Left')
    if (result._tag === 'Left') expect(result.left._tag).toBe('NotFoundError')
  })

  it('rejects corrupted reconstructed scheduler state before monitoring', async () => {
    const input = fixture()
    const prepared = await Effect.runPromise(
      prepareForTest(input.manifest, input.request),
    )
    const corrupted: DurablePartitionAnalysis = {
      ...prepared,
      scheduler: {
        ...prepared.scheduler,
        committedArtifactBytes: 1,
      },
    }
    const job = makePartitionAnalysisJob({
      load: () => Effect.succeed(Option.some(corrupted)),
      create: () => Effect.void,
      compareAndSwap: () => Effect.succeed(true),
    })
    const result = await run(Effect.either(
      job.monitor(prepared.plan.id),
    ))
    expect(result._tag).toBe('Left')
  })
})

function prepareForTest(
  manifest: RecursiveCorpusManifest,
  request: ReturnType<typeof fixture>['request'],
) {
  return Effect.gen(function* () {
    const plan = yield* CorpusPartitioning.plan(manifest, request)
    const scheduler = yield* CorpusPartitioning.initialState(plan)
    return { plan, scheduler }
  }).pipe(Effect.provide(CorpusPartitioning.Default))
}
