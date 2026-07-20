import { describe, expect, it } from 'bun:test'
import {
  RecursiveAnalysisRequestId,
  RecursiveBatchId,
  RecursiveDecompositionNodeId,
  ResearchRunId,
  Sha256Digest,
  SourceVersionId,
} from '@struct/domain'
import { makePhase06RecursiveFixture } from '@struct/evaluation'
import {
  CorpusPartitioning,
  ResearchProviderFailure,
  computeCoverageSnapshotId,
  computeRecursiveEvidenceId,
} from '@struct/research-engine'
import { RecursiveNodeSynthesisInput } from '@struct/workflows'
import { Effect, Option, Schema } from 'effect'
import {
  makePartitionAnalysisJob,
  type DurablePartitionAnalysis,
} from '../src/jobs/partition-analysis.js'
import {
  makeRecursiveSynthesisJob,
  type CommittedRecursiveSynthesisNode,
  type CommittedRecursiveSynthesisStage,
  type RecursiveSynthesisAgents,
  type RecursiveSynthesisJournal,
} from '../src/jobs/recursive-synthesis.js'

const run = <A, E>(effect: Effect.Effect<A, E, CorpusPartitioning>) =>
  Effect.runPromise(effect.pipe(Effect.provide(CorpusPartitioning.Default)))

describe('25,000-file recursive worker recovery', () => {
  it('persists the full plan and resumes interrupted leases without losing coverage', async () => {
    const fixture = makePhase06RecursiveFixture()
    let durable: DurablePartitionAnalysis | undefined
    const job = makePartitionAnalysisJob({
      load: () => Effect.succeed(Option.fromNullable(durable)),
      createOrLoad: (candidate) => Effect.sync(() => {
        durable ??= candidate
        return durable
      }),
      compareAndSwap: (expected, next) => Effect.sync(() => {
        if (durable !== expected) return false
        durable = next
        return true
      }),
    })

    const enqueued = await run(job.enqueue(fixture.manifest, fixture.request))
    const claimed = await run(job.claim(enqueued.plan.id, 1))
    const resumed = await run(job.resume(enqueued.plan.id))
    const reclaimed = await run(job.claim(enqueued.plan.id, 2))

    expect(enqueued.plan.request.sourceVersionIds).toHaveLength(25_000)
    expect(enqueued.plan.partitions).toHaveLength(50)
    expect(claimed.claims).toHaveLength(
      fixture.request.policy.maximumConcurrency,
    )
    expect(resumed.recoveryCount).toBe(1)
    expect(resumed.scheduler.progress).toHaveLength(
      enqueued.scheduler.progress.length,
    )
    expect(resumed.scheduler.progress.filter(
      (item) => item.status === 'retryable',
    )).toHaveLength(claimed.claims.length)
    expect(reclaimed.claims.map((claim) => claim.partition.id))
      .toEqual(claimed.claims.map((claim) => claim.partition.id))
    expect(reclaimed.claims.every((claim) => claim.lease.attempt === 2))
      .toBe(true)
  })

  it('reuses the production merge analysis stage after interruption', async () => {
    const nodes = new Map<string, CommittedRecursiveSynthesisNode>()
    const stages = new Map<string, CommittedRecursiveSynthesisStage>()
    let attemptedModelCalls = 0
    const journal: RecursiveSynthesisJournal = {
      load: (requestId, nodeId) => Effect.succeed(Option.fromNullable(
        nodes.get(`${requestId}:${nodeId}`),
      )),
      commitOrLoad: (candidate) => Effect.sync(() => {
        const key = `${candidate.requestId}:${candidate.nodeId}`
        const existing = nodes.get(key)
        if (existing !== undefined) {
          return { value: existing, disposition: 'existing' as const }
        }
        nodes.set(key, candidate)
        return { value: candidate, disposition: 'created' as const }
      }),
      loadStage: (requestId, nodeId, stage) =>
        Effect.succeed(Option.fromNullable(
          stages.get(`${requestId}:${nodeId}:${stage}`),
        )),
      commitStageOrLoad: (candidate) => Effect.sync(() => {
        const key =
          `${candidate.requestId}:${candidate.nodeId}:${candidate.stage}`
        const existing = stages.get(key)
        if (existing !== undefined) {
          return { value: existing, disposition: 'existing' as const }
        }
        stages.set(key, candidate)
        return { value: candidate, disposition: 'created' as const }
      }),
      cancellationRequested: () => Effect.succeed(false),
      reserveModelCall: () => Effect.sync(() => ({
        reserved: true as const,
        attemptedModelCalls: ++attemptedModelCalls,
      })),
      loadAttemptedModelCalls: () => Effect.succeed(attemptedModelCalls),
    }
    const input = mergeInput()
    const calls: string[] = []
    let interruptCritique = true
    const agents: RecursiveSynthesisAgents = {
      fingerprints: {
        analysis: 'scale-analysis-v1',
        critique: 'scale-critique-v1',
        synthesis: 'scale-synthesis-v1',
      },
      analyze: (value) => Effect.sync(() => {
        calls.push('analysis')
        return {
          findings: [{
            claim: 'Minority signal retained across 25,000 files',
            supportingEvidence: [value.evidence[0]!.reference.id],
            counterEvidence: [],
            confidence: 1,
            importance: 1,
            limitations: [],
            tags: ['minority'],
          }],
          missingEvidence: [],
          excludedEvidence: [],
        }
      }),
      criticize: (value) => Effect.suspend(() => {
        calls.push('critique')
        if (interruptCritique) {
          interruptCritique = false
          return Effect.fail(new ResearchProviderFailure({
            message: 'injected merge-stage interruption',
          }))
        }
        return Effect.succeed({
          contradictions: [],
          sufficiency: 'sufficient' as const,
          evidenceIds: value.findings.flatMap((finding) =>
            finding.evidence.map((evidence) => evidence.id)),
          limitations: [],
        })
      }),
      synthesize: (value) => Effect.sync(() => {
        calls.push('synthesis')
        return {
          retainedFindingIds: value.findings.map((finding) => finding.id),
          limitations: [],
        }
      }),
    }
    const job = makeRecursiveSynthesisJob(journal, agents)

    const interrupted = await Effect.runPromise(
      job.execute(input, new AbortController().signal),
    )
    const resumed = await Effect.runPromise(
      job.execute(input, new AbortController().signal),
    )

    expect(interrupted).toMatchObject({
      status: 'failed',
      retryEligible: true,
    })
    expect(resumed.status).toBe('complete')
    expect(resumed.result?.coverage).toEqual(input.coverage)
    expect(resumed.result?.findings).toHaveLength(1)
    expect(calls).toEqual([
      'analysis',
      'critique',
      'critique',
      'synthesis',
    ])
    expect(stages.size).toBe(3)
    expect(nodes.size).toBe(1)
  })
})

function mergeInput() {
  const hash = (character: string) => `sha256:${character.repeat(64)}`
  const sourceVersionId = SourceVersionId.make(
    '760e8400-e29b-41d4-a716-446655440005',
  )
  const evidence = {
    sourceVersionId,
    artifact: {
      digest: Sha256Digest.make(hash('a')),
      byteLength: 9_362,
      mediaType: 'application/vnd.struct.recursive-summary+json',
    },
    locator: 'partition-summaries#minority-entry-identities',
  }
  const coverage = {
    expectedItems: 25_000,
    examinedItems: 25_000,
    missingItems: 0,
    excludedItems: 0,
    expectedPartitions: 50,
    examinedPartitions: 50,
    status: 'complete' as const,
  }
  return Schema.decodeUnknownSync(RecursiveNodeSynthesisInput)({
    runId: ResearchRunId.make('760e8400-e29b-41d4-a716-446655440006'),
    requestId: RecursiveAnalysisRequestId.make(hash('b')),
    nodeId: RecursiveDecompositionNodeId.make(hash('c')),
    inputBatchIds: [RecursiveBatchId.make(hash('d'))],
    objectiveSignature: Sha256Digest.make(hash('e')),
    evidence: [{
      reference: {
        ...evidence,
        id: computeRecursiveEvidenceId(evidence),
      },
      excerpt: '25 exact minority identities retained from 25,000 files.',
      contentTrust: 'untrusted-source-content',
    }],
    coverage: {
      ...coverage,
      id: computeCoverageSnapshotId(coverage),
    },
    maximumFindings: 8,
    budget: {
      maximumPromptBytes: 100_000,
      maximumModelCalls: 4,
      maximumTokens: 4_000,
      maximumEstimatedCostMicros: 400,
      estimatedTokensPerCall: 100,
      estimatedCostMicrosPerCall: 10,
    },
  })
}
