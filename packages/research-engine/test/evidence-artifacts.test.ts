import { describe, expect, it } from 'bun:test'
import {
  RecursiveAnalysisRequestId,
  RecursiveDecompositionNodeId,
  ResearchPlanId,
  Sha256Digest,
  SourceVersionId,
  type RecursiveBatchInput,
} from '@struct/domain'
import {
  makeBatchSelectionPlan,
  type BatchEvidenceSource,
  type BatchSelectionPlan,
} from '@struct/retrieval'
import { Effect } from 'effect'
import {
  BatchEvidenceArtifacts,
  computeBatchEvidenceTransformationIdentity,
  computeRecursiveBatchId,
  computeRecursivePartitionId,
} from '../src/index.js'

const sourceA = SourceVersionId.make('660e8400-e29b-41d4-a716-446655440001')
const sourceB = SourceVersionId.make('660e8400-e29b-41d4-a716-446655440002')
const nodeId = RecursiveDecompositionNodeId.make(`sha256:${'2'.repeat(64)}`)
const requestId = RecursiveAnalysisRequestId.make(`sha256:${'3'.repeat(64)}`)
const planId = ResearchPlanId.make('660e8400-e29b-41d4-a716-446655440003')

function source(
  entryKey: string,
  sourceVersionId: typeof sourceA,
  normalizedPath: string,
  value: unknown,
): BatchEvidenceSource {
  const bytes = new TextEncoder().encode(JSON.stringify(value))
  return {
    entryKey,
    sourceVersionId,
    normalizedPath,
    schemaFamily: 'events-v1',
    bytes,
    contentDigest: Sha256Digest.make(
      `sha256:${new Bun.CryptoHasher('sha256').update(bytes).digest('hex')}`,
    ),
  }
}

function batch(
  sources: ReadonlyArray<BatchEvidenceSource>,
  evidenceSchemaVersion = 'evidence-v1',
): RecursiveBatchInput {
  const withoutId = {
    nodeId,
    schemaFamily: 'events-v1',
    pathGroup: 'events',
    sizeBand: 'small' as const,
    planId,
    sourceVersionIds: [...new Set(sources.map((item) => item.sourceVersionId))],
    entryKeys: sources.map((item) => item.entryKey),
    byteLength: sources.reduce((total, item) => total + item.bytes.byteLength, 0),
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
    evidenceSchemaVersion,
  }
  return {
    ...identity,
    id: computeRecursiveBatchId(identity),
    partition,
  }
}

async function selection(maximumRecords = 100): Promise<BatchSelectionPlan> {
  return Effect.runPromise(makeBatchSelectionPlan({
    predicates: [],
    projection: ['name', 'amount'],
    groupBy: ['team'],
    aggregations: [
      { name: 'count', operation: 'count' },
      { name: 'sum', operation: 'sum', field: 'amount' },
    ],
    maximumRecords,
    maximumGroups: 100,
  }))
}

function build(
  input: RecursiveBatchInput,
  sources: ReadonlyArray<BatchEvidenceSource>,
  plan: BatchSelectionPlan,
  maximumBytes = 1_000_000,
) {
  return Effect.runPromise(BatchEvidenceArtifacts.build(
    input,
    sources,
    plan,
    maximumBytes,
  ).pipe(Effect.provide(BatchEvidenceArtifacts.Default)))
}

describe('recursive evidence artifacts', () => {
  it('produces stable canonical bytes across source ordering and duplicate content', async () => {
    const repeated = [{ name: 'same', amount: 0.1, team: 'blue' }]
    const first = source('a', sourceA, 'events/a.json', repeated)
    const second = source('b', sourceB, 'events/b.json', repeated)
    const input = batch([first, second])
    const plan = await selection()
    const left = await build(input, [first, second], plan)
    const right = await build(input, [second, first], plan)

    expect(right.digest).toBe(left.digest)
    expect(right.bytes).toEqual(left.bytes)
    expect(left.artifact.sources).toHaveLength(2)
    expect(left.artifact.records).toHaveLength(2)
    expect(left.artifact.contentTrust.classification)
      .toBe('untrusted-source-content')
  })

  it('changes bytes for transformation or evidence schema identity changes', async () => {
    const item = source('a', sourceA, 'events/a.json', [
      { name: 'A', amount: 1, team: 'blue' },
    ])
    const firstBatch = batch([item], 'evidence-v1')
    const secondBatch = batch([item], 'evidence-v2')
    const firstPlan = await selection()
    const secondPlan = await Effect.runPromise(makeBatchSelectionPlan({
      ...firstPlan,
      projection: ['name'],
    }))
    const first = await build(firstBatch, [item], firstPlan)
    const schemaChanged = await build(secondBatch, [item], firstPlan)
    const transformChanged = await build(firstBatch, [item], secondPlan)

    expect(schemaChanged.digest).not.toBe(first.digest)
    expect(transformChanged.digest).not.toBe(first.digest)
    expect(schemaChanged.artifact.queryIdentity)
      .toBe(first.artifact.queryIdentity)
    expect(schemaChanged.artifact.transformationIdentity)
      .not.toBe(first.artifact.transformationIdentity)
    expect(computeBatchEvidenceTransformationIdentity(
      firstPlan.id,
      firstBatch.evidenceSchemaVersion,
      100_000,
    )).not.toBe(computeBatchEvidenceTransformationIdentity(
      firstPlan.id,
      firstBatch.evidenceSchemaVersion,
      99_999,
    ))
  })

  it('changes artifact identity for immutable source version or content changes', async () => {
    const original = source('a', sourceA, 'events/a.json', [
      { name: 'A', amount: 1, team: 'blue' },
    ])
    const changedVersion = source('a', sourceB, 'events/a.json', [
      { name: 'A', amount: 1, team: 'blue' },
    ])
    const changedContent = source('a', sourceA, 'events/a.json', [
      { name: 'A', amount: 2, team: 'blue' },
    ])
    const plan = await selection()
    const originalArtifact = await build(batch([original]), [original], plan)
    const versionArtifact = await build(
      batch([changedVersion]),
      [changedVersion],
      plan,
    )
    const contentArtifact = await build(
      batch([changedContent]),
      [changedContent],
      plan,
    )

    expect(versionArtifact.digest).not.toBe(originalArtifact.digest)
    expect(contentArtifact.digest).not.toBe(originalArtifact.digest)
    expect(versionArtifact.bytes).not.toEqual(originalArtifact.bytes)
    expect(contentArtifact.bytes).not.toEqual(originalArtifact.bytes)
  })

  it('rejects duplicate inputs, foreign schemas, digest mismatches, and byte overflow', async () => {
    const item = source('a', sourceA, 'events/a.json', [{ team: 'blue' }])
    const input = batch([item])
    const plan = await selection()
    const variants: ReadonlyArray<ReadonlyArray<BatchEvidenceSource>> = [
      [item, item],
      [{ ...item, schemaFamily: 'foreign-v1' }],
      [{ ...item, contentDigest: Sha256Digest.make(`sha256:${'f'.repeat(64)}`) }],
      [{ ...item, bytes: new Uint8Array(input.partition.byteLength + 1) }],
    ]

    for (const candidate of variants) {
      const result = await Effect.runPromise(Effect.either(
        BatchEvidenceArtifacts.build(input, candidate, plan, 1_000_000)
          .pipe(Effect.provide(BatchEvidenceArtifacts.Default)),
      ))
      expect(result._tag).toBe('Left')
    }
  })

  it('truncates records, groups, and aggregate contributor provenance to byte bounds', async () => {
    const records = Array.from({ length: 100 }, (_, index) => ({
      name: `record-${index}-${'x'.repeat(50)}`,
      amount: index,
      team: `team-${index}`,
    }))
    const item = source('a', sourceA, 'events/a.json', records)
    const input = batch([item])
    const plan = await selection()
    const full = await build(input, [item], plan)
    const bounded = await build(
      input,
      [item],
      plan,
      full.byteLength - 1_000,
    )

    expect(bounded.byteLength).toBeLessThanOrEqual(full.byteLength - 1_000)
    expect(bounded.artifact.truncated).toBe(true)
    expect(
      bounded.artifact.counts.truncatedRecords
      + bounded.artifact.counts.truncatedGroups,
    ).toBeGreaterThan(0)
    const contributor = full.artifact.groups
      .find((group) => group.values[0]?.truncatedContributors === 0)
    expect(contributor).toBeDefined()
  })

  it('bounds aggregate contributor provenance independently of artifact rows', async () => {
    const item = source(
      'a',
      sourceA,
      'events/a.json',
      Array.from({ length: 80 }, (_, amount) => ({
        name: `record-${amount}`,
        amount,
        team: 'blue',
      })),
    )
    const result = await build(batch([item]), [item], await selection())
    const count = result.artifact.groups[0]?.values[0]

    expect(count?.contributors).toHaveLength(64)
    expect(count?.truncatedContributors).toBe(16)
  })
})
