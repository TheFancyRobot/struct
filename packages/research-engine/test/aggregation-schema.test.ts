import { describe, expect, it } from 'bun:test'
import {
  RecursiveAnalysisRequest,
  RecursiveAnalysisRequestId,
  RecursiveAggregationId,
  RecursiveBatchId,
  RecursiveContradictionId,
  RecursiveDecompositionNodeId,
  RecursiveFindingId,
  RecursivePartitionId,
  RecursiveSufficiencyId,
  RecursiveTerminalStateId,
  ResearchPlanId,
  ResearchContractValidationError,
  Sha256Digest,
  SourceVersionId,
} from '@struct/domain'
import { Effect, Schema } from 'effect'
import {
  computeRecursiveAnalysisRequestId,
  computeRecursiveAggregationId,
  computeRecursiveBatchId,
  computeRecursiveDecompositionNodeId,
  computeRecursiveEvidenceId,
  computeRecursivePartitionId,
  computeRecursiveSufficiencyId,
  computeRecursiveTerminalStateId,
  orderCanonicalIdentities,
  validateRecursiveAggregationContract,
  validateRecursiveBatchInputContract,
  validateRecursiveBatchResultContract,
  validateRecursiveRequestContract,
} from '../src/aggregation-schema.js'
import { computeCoverageSnapshotId } from '../src/coverage-metadata.js'

const sha = (character: string) => `sha256:${character.repeat(64)}`
const sourceA = SourceVersionId.make('620e8400-e29b-41d4-a716-446655440001')
const sourceB = SourceVersionId.make('620e8400-e29b-41d4-a716-446655440002')

function requestWithoutId() {
  const request = Schema.decodeUnknownSync(RecursiveAnalysisRequest)({
    version: '1',
    id: sha('f'),
    runId: '620e8400-e29b-41d4-a716-446655440003',
    planId: '620e8400-e29b-41d4-a716-446655440004',
    workspaceId: '620e8400-e29b-41d4-a716-446655440005',
    projectId: '620e8400-e29b-41d4-a716-446655440006',
    objectiveSignature: sha('a'),
    sourceVersionIds: [sourceB, sourceA],
    policy: {
      maximumDepth: 4,
      maximumFanOut: 8,
      maximumConcurrency: 4,
      maximumElapsedMilliseconds: 60_000,
      maximumTokens: 100_000,
      maximumEstimatedCostMicros: 100_000,
      maximumPartitionBytes: 1_000_000,
      maximumArtifactBytes: 100_000,
      maximumArtifacts: 100,
    },
    checkpoint: {
      id: '620e8400-e29b-41d4-a716-446655440007',
      runId: '620e8400-e29b-41d4-a716-446655440003',
      planId: '620e8400-e29b-41d4-a716-446655440004',
      executionContractVersion: '1',
    },
  })
  const { id: _id, ...withoutId } = request
  return withoutId
}

describe('recursive canonical identities', () => {
  it('orders identities by canonical UTF-8 bytes without mutating input', () => {
    const input = ['z', 'ä', 'a']
    expect(orderCanonicalIdentities(input)).toEqual(['a', 'z', 'ä'])
    expect(input).toEqual(['z', 'ä', 'a'])
  })

  it('keeps request identity stable across source permutations', () => {
    const request = requestWithoutId()
    const reversed = {
      ...request,
      sourceVersionIds: [...request.sourceVersionIds].reverse(),
    }
    expect(computeRecursiveAnalysisRequestId(request))
      .toBe(computeRecursiveAnalysisRequestId(reversed))
  })

  it('changes identity for source version, plan, objective, or policy changes', () => {
    const request = requestWithoutId()
    const original = computeRecursiveAnalysisRequestId(request)
    const changes = [
      { ...request, sourceVersionIds: [sourceA] },
      {
        ...request,
        planId: ResearchPlanId.make(
          '620e8400-e29b-41d4-a716-446655440099',
        ),
      },
      { ...request, objectiveSignature: Sha256Digest.make(sha('b')) },
      {
        ...request,
        policy: { ...request.policy, maximumConcurrency: 5 },
      },
    ]
    for (const changed of changes) {
      expect(computeRecursiveAnalysisRequestId(changed)).not.toBe(original)
    }
  })

  it('keeps node, partition, and batch identities stable across permutations', () => {
    const request = requestWithoutId()
    const requestId = computeRecursiveAnalysisRequestId(request)
    const node = {
      requestId,
      parentId: null,
      depth: 0,
      sourceVersionIds: [sourceB, sourceA],
    }
    const nodeId = computeRecursiveDecompositionNodeId(node)
    expect(nodeId).toBe(computeRecursiveDecompositionNodeId({
      ...node,
      sourceVersionIds: [sourceA, sourceB],
    }))
    const partition = {
      nodeId,
      schemaFamily: 'incident-v1',
      sourceVersionIds: [sourceB, sourceA],
      entryKeys: ['z.json', 'a.json'],
      byteLength: 512,
    }
    const partitionId = computeRecursivePartitionId(partition)
    expect(partitionId).toBe(computeRecursivePartitionId({
      ...partition,
      sourceVersionIds: [sourceA, sourceB],
      entryKeys: ['a.json', 'z.json'],
    }))
    const batchId = computeRecursiveBatchId({
      version: '1',
      requestId,
      nodeId,
      partitionId,
      evidenceSchemaVersion: '1',
    })
    expect(Schema.is(RecursiveBatchId)(batchId)).toBe(true)
    expect(Schema.is(RecursivePartitionId)(partitionId)).toBe(true)
    expect(Schema.is(RecursiveDecompositionNodeId)(nodeId)).toBe(true)
  })

  it('stabilizes evidence and aggregation identities while retaining relevant changes', () => {
    const evidence = {
      sourceVersionId: sourceA,
      artifact: {
        digest: Sha256Digest.make(sha('a')),
        byteLength: 128,
        mediaType: 'application/json',
      },
      locator: '/items/0',
    }
    expect(computeRecursiveEvidenceId(evidence)).not.toBe(
      computeRecursiveEvidenceId({ ...evidence, sourceVersionId: sourceB }),
    )

    const base = {
      version: '1' as const,
      requestId: RecursiveAnalysisRequestId.make(sha('1')),
      nodeId: RecursiveDecompositionNodeId.make(sha('2')),
      inputBatchIds: [
        RecursiveBatchId.make(sha('3')),
        RecursiveBatchId.make(sha('4')),
      ],
      coverage: {
        id: computeCoverageSnapshotId({
          expectedItems: 0,
          examinedItems: 0,
          missingItems: 0,
          excludedItems: 0,
          expectedPartitions: 0,
          examinedPartitions: 0,
          status: 'complete',
        }),
        expectedItems: 0,
        examinedItems: 0,
        missingItems: 0,
        excludedItems: 0,
        expectedPartitions: 0,
        examinedPartitions: 0,
        status: 'complete' as const,
      },
      findingIds: [
        RecursiveFindingId.make(sha('5')),
        RecursiveFindingId.make(sha('6')),
      ],
      contradictionIds: [
        RecursiveContradictionId.make(sha('7')),
        RecursiveContradictionId.make(sha('8')),
      ],
      sufficiencyId: RecursiveSufficiencyId.make(sha('9')),
      terminalId: RecursiveTerminalStateId.make(sha('a')),
    }
    expect(computeRecursiveAggregationId(base)).toBe(
      computeRecursiveAggregationId({
        ...base,
        inputBatchIds: [...base.inputBatchIds].reverse(),
        findingIds: [...base.findingIds].reverse(),
        contradictionIds: [...base.contradictionIds].reverse(),
      }),
    )
  })

  it('returns a typed invariant failure for a forged request identity', async () => {
    const request = requestWithoutId()
    const result = await Effect.runPromise(Effect.either(
      validateRecursiveRequestContract({
        ...request,
        id: RecursiveAnalysisRequestId.make(sha('f')),
      }),
    ))
    expect(result._tag).toBe('Left')
    if (result._tag === 'Left') {
      expect(result.left).toBeInstanceOf(ResearchContractValidationError)
      expect(result.left.reason).toBe('invalid-identity')
    }
  })

  it('decodes and validates a canonically identified aggregation result', async () => {
    const request = requestWithoutId()
    const requestId = computeRecursiveAnalysisRequestId(request)
    const nodeId = RecursiveDecompositionNodeId.make(sha('1'))
    const coverageWithoutId = {
      expectedItems: 0,
      examinedItems: 0,
      missingItems: 0,
      excludedItems: 0,
      expectedPartitions: 0,
      examinedPartitions: 0,
      status: 'complete' as const,
    }
    const coverage = {
      ...coverageWithoutId,
      id: computeCoverageSnapshotId(coverageWithoutId),
    }
    const sufficiencyWithoutId = {
      status: 'insufficient' as const,
      evidenceIds: [],
      contradictionIds: [],
      limitations: ['No qualifying evidence was extracted'],
    }
    const sufficiency = {
      ...sufficiencyWithoutId,
      id: computeRecursiveSufficiencyId(sufficiencyWithoutId),
    }
    const terminalReason = { kind: 'insufficient-evidence' as const }
    const terminal = {
      id: computeRecursiveTerminalStateId(terminalReason),
      reason: terminalReason,
    }
    const inputBatchIds = [RecursiveBatchId.make(sha('2'))]
    const id = computeRecursiveAggregationId({
      version: '1',
      requestId,
      nodeId,
      inputBatchIds,
      coverage,
      findingIds: [],
      contradictionIds: [],
      sufficiencyId: sufficiency.id,
      terminalId: terminal.id,
    })
    const result = await Effect.runPromise(validateRecursiveAggregationContract({
      version: '1',
      id,
      requestId,
      nodeId,
      inputBatchIds,
      findings: [],
      coverage,
      contradictions: [],
      sufficiency,
      terminal,
    }))
    expect(Schema.is(RecursiveAggregationId)(result.id)).toBe(true)
    expect(Schema.is(RecursiveFindingId)(sha('3'))).toBe(true)
    expect(Schema.is(RecursiveContradictionId)(sha('4'))).toBe(true)
    expect(Schema.is(RecursiveSufficiencyId)(sufficiency.id)).toBe(true)
    expect(Schema.is(RecursiveTerminalStateId)(terminal.id)).toBe(true)
  })

  it('validates batch input and result identities together', async () => {
    const request = requestWithoutId()
    const requestId = computeRecursiveAnalysisRequestId(request)
    const nodeId = RecursiveDecompositionNodeId.make(sha('1'))
    const partitionWithoutIdentity = {
      nodeId,
      schemaFamily: 'incident-v1',
      sourceVersionIds: [sourceA],
      entryKeys: ['incidents/1.json'],
      byteLength: 512,
    }
    const partition = {
      ...partitionWithoutIdentity,
      id: computeRecursivePartitionId(partitionWithoutIdentity),
      ordinal: 0,
    }
    const batchWithoutIdentity = {
      version: '1' as const,
      requestId,
      nodeId,
      partitionId: partition.id,
      evidenceSchemaVersion: '1',
    }
    const batch = {
      version: '1' as const,
      id: computeRecursiveBatchId(batchWithoutIdentity),
      requestId,
      nodeId,
      partition,
      evidenceSchemaVersion: '1',
    }
    await Effect.runPromise(validateRecursiveBatchInputContract(batch))

    const coverageWithoutId = {
      expectedItems: 0,
      examinedItems: 0,
      missingItems: 0,
      excludedItems: 0,
      expectedPartitions: 0,
      examinedPartitions: 0,
      status: 'complete' as const,
    }
    const coverage = {
      ...coverageWithoutId,
      id: computeCoverageSnapshotId(coverageWithoutId),
    }
    const sufficiencyWithoutId = {
      status: 'insufficient' as const,
      evidenceIds: [],
      contradictionIds: [],
      limitations: [],
    }
    const terminalReason = { kind: 'insufficient-evidence' as const }
    const result = await Effect.runPromise(validateRecursiveBatchResultContract({
      version: '1',
      batchId: batch.id,
      findings: [],
      coverage,
      contradictions: [],
      sufficiency: {
        ...sufficiencyWithoutId,
        id: computeRecursiveSufficiencyId(sufficiencyWithoutId),
      },
      terminal: {
        reason: terminalReason,
        id: computeRecursiveTerminalStateId(terminalReason),
      },
    }, batch))
    expect(result.batchId).toBe(batch.id)
  })
})
