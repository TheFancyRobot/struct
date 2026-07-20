import { describe, expect, it } from 'bun:test'
import {
  RecursiveAnalysisRequest,
  RecursiveAnalysisRequestId,
  RecursiveAggregationId,
  RecursiveBatchId,
  RecursiveContradictionId,
  RecursiveDecompositionNodeId,
  RecursiveEvidenceId,
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
  computeRecursiveContradictionId,
  computeRecursiveDecompositionNodeId,
  computeRecursiveEvidenceId,
  computeRecursiveFindingId,
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
      maximumPartitionItems: 100,
      maximumPartitionAttempts: 3,
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

function completeCoverage(expectedItems: number, expectedPartitions: number) {
  const withoutId = {
    expectedItems,
    examinedItems: expectedItems,
    missingItems: 0,
    excludedItems: 0,
    expectedPartitions,
    examinedPartitions: expectedPartitions,
    status: 'complete' as const,
  }
  return { ...withoutId, id: computeCoverageSnapshotId(withoutId) }
}

function evidenceFor(sourceVersionId: typeof sourceA, character: string) {
  const withoutId = {
    sourceVersionId,
    artifact: {
      digest: Sha256Digest.make(sha(character)),
      byteLength: 128,
      mediaType: 'application/json',
    },
    locator: `/items/${character}`,
  }
  return { ...withoutId, id: computeRecursiveEvidenceId(withoutId) }
}

function findingFor(
  evidence: ReadonlyArray<ReturnType<typeof evidenceFor>>,
  coverage: ReturnType<typeof completeCoverage>,
) {
  const identityInput = {
    claimSignature: Sha256Digest.make(sha('c')),
    evidence,
    confidence: 0.9,
    importance: 0.8,
    coverage,
    supportingExamples: [evidence[0]!.id],
    counterEvidence: [],
    contradictions: [],
  }
  return {
    ...identityInput,
    id: computeRecursiveFindingId(identityInput),
    claim: 'A source-grounded claim',
    limitations: [],
    tags: ['verified'],
  }
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
      groupKey: sha('9'),
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
      pathGroup: 'incidents',
      sizeBand: 'small' as const,
      planId: request.planId,
      sourceVersionIds: [sourceB, sourceA],
      entryKeys: ['z.json', 'a.json'],
      byteLength: 512,
      estimatedTokens: 128,
      estimatedCostMicros: 64,
      estimatedArtifactBytes: 256,
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

  it('retains resolved contradictions without blocking sufficient completion', async () => {
    const coverage = completeCoverage(2, 1)
    const evidence = [evidenceFor(sourceA, '1'), evidenceFor(sourceB, '2')]
    const finding = findingFor(evidence, coverage)
    const contradictionWithoutId = {
      claimSignature: Sha256Digest.make(sha('d')),
      supportingEvidence: [evidence[0]!.id],
      conflictingEvidence: [evidence[1]!.id],
    }
    const contradiction = {
      ...contradictionWithoutId,
      id: computeRecursiveContradictionId(contradictionWithoutId),
      status: 'resolved' as const,
      limitations: ['Resolved by newer immutable evidence'],
    }
    const sufficiencyWithoutId = {
      status: 'sufficient' as const,
      evidenceIds: evidence.map((item) => item.id),
      contradictionIds: [],
      limitations: [],
    }
    const sufficiency = {
      ...sufficiencyWithoutId,
      id: computeRecursiveSufficiencyId(sufficiencyWithoutId),
    }
    const terminalReason = { kind: 'completed' as const }
    const terminal = {
      reason: terminalReason,
      id: computeRecursiveTerminalStateId(terminalReason),
    }
    const aggregationWithoutId = {
      version: '1' as const,
      requestId: RecursiveAnalysisRequestId.make(sha('3')),
      nodeId: RecursiveDecompositionNodeId.make(sha('4')),
      inputBatchIds: [RecursiveBatchId.make(sha('5'))],
      findings: [finding],
      coverage,
      contradictions: [contradiction],
      sufficiency,
      terminal,
    }
    const aggregation = {
      ...aggregationWithoutId,
      id: computeRecursiveAggregationId({
        ...aggregationWithoutId,
        findingIds: [finding.id],
        contradictionIds: [contradiction.id],
        sufficiencyId: sufficiency.id,
        terminalId: terminal.id,
      }),
    }

    await expect(
      Effect.runPromise(validateRecursiveAggregationContract(aggregation)),
    ).resolves.toMatchObject({
      sufficiency: { status: 'sufficient', contradictionIds: [] },
      contradictions: [{ status: 'resolved' }],
      terminal: { reason: { kind: 'completed' } },
    })

    await expect(Effect.runPromise(Effect.either(
      validateRecursiveAggregationContract({
        ...aggregation,
        contradictions: [{ ...contradiction, status: 'unresolved' }],
      }),
    ))).resolves.toMatchObject({ _tag: 'Left' })
  })

  it('rejects top-level contradiction evidence not carried by findings', async () => {
    const coverage = completeCoverage(1, 1)
    const evidence = evidenceFor(sourceA, '1')
    const finding = findingFor([evidence], coverage)
    const contradictionWithoutId = {
      claimSignature: Sha256Digest.make(sha('d')),
      supportingEvidence: [evidence.id],
      conflictingEvidence: [RecursiveEvidenceId.make(sha('e'))],
    }
    const contradiction = {
      ...contradictionWithoutId,
      id: computeRecursiveContradictionId(contradictionWithoutId),
      status: 'resolved' as const,
      limitations: [],
    }
    const sufficiencyWithoutId = {
      status: 'sufficient' as const,
      evidenceIds: [evidence.id],
      contradictionIds: [],
      limitations: [],
    }
    const sufficiency = {
      ...sufficiencyWithoutId,
      id: computeRecursiveSufficiencyId(sufficiencyWithoutId),
    }
    const terminalReason = { kind: 'completed' as const }
    const terminal = {
      reason: terminalReason,
      id: computeRecursiveTerminalStateId(terminalReason),
    }
    const values = {
      version: '1' as const,
      requestId: RecursiveAnalysisRequestId.make(sha('3')),
      nodeId: RecursiveDecompositionNodeId.make(sha('4')),
      inputBatchIds: [RecursiveBatchId.make(sha('5'))],
      findings: [finding],
      coverage,
      contradictions: [contradiction],
      sufficiency,
      terminal,
    }
    const id = computeRecursiveAggregationId({
      ...values,
      findingIds: [finding.id],
      contradictionIds: [contradiction.id],
      sufficiencyId: sufficiency.id,
      terminalId: terminal.id,
    })

    await expect(Effect.runPromise(Effect.either(
      validateRecursiveAggregationContract({ ...values, id }),
    ))).resolves.toMatchObject({ _tag: 'Left' })
  })

  it('validates batch input and result identities together', async () => {
    const request = requestWithoutId()
    const requestId = computeRecursiveAnalysisRequestId(request)
    const nodeId = RecursiveDecompositionNodeId.make(sha('1'))
    const partitionWithoutIdentity = {
      nodeId,
      schemaFamily: 'incident-v1',
      pathGroup: 'incidents',
      sizeBand: 'small' as const,
      planId: request.planId,
      sourceVersionIds: [sourceA],
      entryKeys: ['incidents/1.json'],
      byteLength: 512,
      estimatedTokens: 128,
      estimatedCostMicros: 64,
      estimatedArtifactBytes: 256,
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
      expectedItems: 1,
      examinedItems: 1,
      missingItems: 0,
      excludedItems: 0,
      expectedPartitions: 1,
      examinedPartitions: 1,
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

  it('binds batch evidence lineage and coverage to the expected partition', async () => {
    const request = requestWithoutId()
    const requestId = computeRecursiveAnalysisRequestId(request)
    const nodeId = RecursiveDecompositionNodeId.make(sha('1'))
    const partitionWithoutIdentity = {
      nodeId,
      schemaFamily: 'incident-v1',
      pathGroup: 'incidents',
      sizeBand: 'small' as const,
      planId: request.planId,
      sourceVersionIds: [sourceA],
      entryKeys: ['incidents/1.json'],
      byteLength: 512,
      estimatedTokens: 128,
      estimatedCostMicros: 64,
      estimatedArtifactBytes: 256,
    }
    const partition = {
      ...partitionWithoutIdentity,
      id: computeRecursivePartitionId(partitionWithoutIdentity),
      ordinal: 0,
    }
    const batchIdentityInput = {
      version: '1' as const,
      requestId,
      nodeId,
      partitionId: partition.id,
      evidenceSchemaVersion: '1',
    }
    const batch = {
      version: '1' as const,
      id: computeRecursiveBatchId(batchIdentityInput),
      requestId,
      nodeId,
      partition,
      evidenceSchemaVersion: '1',
    }
    const coverage = completeCoverage(1, 1)
    const evidence = evidenceFor(sourceB, '2')
    const finding = findingFor([evidence], coverage)
    const sufficiencyWithoutId = {
      status: 'sufficient' as const,
      evidenceIds: [evidence.id],
      contradictionIds: [],
      limitations: [],
    }
    const terminalReason = { kind: 'completed' as const }
    const result = {
      version: '1' as const,
      batchId: batch.id,
      findings: [finding],
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
    }

    const wrongSource = await Effect.runPromise(Effect.either(
      validateRecursiveBatchResultContract(result, batch),
    ))
    expect(wrongSource).toMatchObject({
      _tag: 'Left',
      left: {
        reason: 'invalid-lineage',
      },
    })

    const emptyCoverage = completeCoverage(0, 1)
    const wrongCoverage = await Effect.runPromise(Effect.either(
      validateRecursiveBatchResultContract({
        ...result,
        findings: [],
        coverage: emptyCoverage,
        sufficiency: {
          id: computeRecursiveSufficiencyId({
            status: 'insufficient',
            evidenceIds: [],
            contradictionIds: [],
          }),
          status: 'insufficient',
          evidenceIds: [],
          contradictionIds: [],
          limitations: [],
        },
        terminal: {
          reason: { kind: 'insufficient-evidence' },
          id: computeRecursiveTerminalStateId({ kind: 'insufficient-evidence' }),
        },
      }, batch),
    ))
    expect(wrongCoverage).toMatchObject({
      _tag: 'Left',
      left: {
        reason: 'malformed',
        path: 'coverage.expectedItems',
      },
    })

    const twoPartitionCoverage = completeCoverage(1, 2)
    const wrongPartitionAccounting = await Effect.runPromise(Effect.either(
      validateRecursiveBatchResultContract({
        ...result,
        findings: [],
        coverage: twoPartitionCoverage,
        sufficiency: {
          id: computeRecursiveSufficiencyId({
            status: 'insufficient',
            evidenceIds: [],
            contradictionIds: [],
          }),
          status: 'insufficient',
          evidenceIds: [],
          contradictionIds: [],
          limitations: [],
        },
        terminal: {
          reason: { kind: 'insufficient-evidence' },
          id: computeRecursiveTerminalStateId({ kind: 'insufficient-evidence' }),
        },
      }, batch),
    ))
    expect(wrongPartitionAccounting).toMatchObject({
      _tag: 'Left',
      left: {
        reason: 'malformed',
        path: 'coverage.expectedPartitions',
      },
    })

    const carriedEvidence = evidenceFor(sourceA, '3')
    const carriedFinding = findingFor([carriedEvidence], coverage)
    const danglingContradictionInput = {
      claimSignature: Sha256Digest.make(sha('d')),
      supportingEvidence: [carriedEvidence.id],
      conflictingEvidence: [RecursiveEvidenceId.make(sha('e'))],
    }
    const danglingContradiction = {
      ...danglingContradictionInput,
      id: computeRecursiveContradictionId(danglingContradictionInput),
      status: 'resolved' as const,
      limitations: [],
    }
    const carriedSufficiencyInput = {
      status: 'sufficient' as const,
      evidenceIds: [carriedEvidence.id],
      contradictionIds: [],
      limitations: [],
    }
    const danglingEvidence = await Effect.runPromise(Effect.either(
      validateRecursiveBatchResultContract({
        ...result,
        findings: [carriedFinding],
        contradictions: [danglingContradiction],
        sufficiency: {
          ...carriedSufficiencyInput,
          id: computeRecursiveSufficiencyId(carriedSufficiencyInput),
        },
      }, batch),
    ))
    expect(danglingEvidence).toMatchObject({ _tag: 'Left' })
  })
})
