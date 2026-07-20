import { describe, expect, it } from 'bun:test'
import { Effect, Schema } from 'effect'
import {
  RecursiveAggregationResult,
  RecursiveAnalysisRequest,
  RecursiveDecompositionNodeId,
  RecursiveTerminalReason,
  decodeRecursiveAggregationResult,
  decodeRecursiveAnalysisRequest,
  decodeRecursiveDecomposition,
} from './recursive-analysis.js'

const sha = (character: string) => `sha256:${character.repeat(64)}`
const ids = {
  run: '610e8400-e29b-41d4-a716-446655440001',
  plan: '610e8400-e29b-41d4-a716-446655440002',
  workspace: '610e8400-e29b-41d4-a716-446655440003',
  project: '610e8400-e29b-41d4-a716-446655440004',
  checkpoint: '610e8400-e29b-41d4-a716-446655440005',
  sourceA: '610e8400-e29b-41d4-a716-446655440006',
  sourceB: '610e8400-e29b-41d4-a716-446655440007',
}

function requestInput() {
  return {
    version: '1',
    id: sha('a'),
    runId: ids.run,
    planId: ids.plan,
    workspaceId: ids.workspace,
    projectId: ids.project,
    objectiveSignature: sha('b'),
    sourceVersionIds: [ids.sourceA, ids.sourceB],
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
      id: ids.checkpoint,
      runId: ids.run,
      planId: ids.plan,
      executionContractVersion: '1',
    },
  }
}

async function failureReason(effect: Effect.Effect<unknown, { readonly reason: string }>) {
  const result = await Effect.runPromise(Effect.either(effect))
  return result._tag === 'Left' ? result.left.reason : 'success'
}

describe('recursive analysis domain contracts', () => {
  it('round-trips valid requests and decomposition lineage', async () => {
    const request = await Effect.runPromise(
      decodeRecursiveAnalysisRequest(requestInput()),
    )
    const rootId = RecursiveDecompositionNodeId.make(sha('c'))
    const childId = RecursiveDecompositionNodeId.make(sha('d'))
    const decomposition = await Effect.runPromise(
      decodeRecursiveDecomposition({
        request,
        nodes: [
          {
            id: rootId,
            groupKey: sha('8'),
            requestId: request.id,
            parentId: null,
            depth: 0,
            sourceVersionIds: request.sourceVersionIds,
            partitionIds: [],
          },
          {
            id: childId,
            groupKey: sha('9'),
            requestId: request.id,
            parentId: rootId,
            depth: 1,
            sourceVersionIds: [ids.sourceA],
            partitionIds: [],
          },
        ],
      }),
    )
    const encoded = Schema.encodeSync(RecursiveAnalysisRequest)(decomposition.request)
    await Effect.runPromise(decodeRecursiveAnalysisRequest(encoded))
    expect(decomposition.nodes).toHaveLength(2)
  })

  it('supports both initial execution and identity-matched checkpoint resume', async () => {
    const initial = await Effect.runPromise(decodeRecursiveAnalysisRequest({
      ...requestInput(),
      checkpoint: null,
    }))
    const resumed = await Effect.runPromise(
      decodeRecursiveAnalysisRequest(requestInput()),
    )
    expect(initial.checkpoint).toBeNull()
    expect(resumed.checkpoint?.planId).toBe(resumed.planId)
  })

  it('rejects duplicate sources, mismatched checkpoints, and illegal policy limits', async () => {
    expect(await failureReason(decodeRecursiveAnalysisRequest({
      ...requestInput(),
      sourceVersionIds: [ids.sourceA, ids.sourceA],
    }))).toBe('malformed')
    expect(await failureReason(decodeRecursiveAnalysisRequest({
      ...requestInput(),
      checkpoint: { ...requestInput().checkpoint, planId: ids.run },
    }))).toBe('malformed')
    const invalidPolicyValues = [
      ['maximumDepth', 0],
      ['maximumDepth', 17],
      ['maximumFanOut', 0],
      ['maximumFanOut', 65],
      ['maximumPartitionItems', 0],
      ['maximumPartitionItems', 25_001],
      ['maximumPartitionAttempts', 0],
      ['maximumPartitionAttempts', 17],
      ['maximumConcurrency', 0],
      ['maximumConcurrency', 65],
      ['maximumElapsedMilliseconds', 0],
      ['maximumElapsedMilliseconds', 86_400_001],
      ['maximumTokens', 0],
      ['maximumTokens', 10_000_001],
      ['maximumEstimatedCostMicros', -1],
      ['maximumEstimatedCostMicros', 1_000_000_001],
      ['maximumPartitionBytes', 0],
      ['maximumPartitionBytes', 1_073_741_825],
      ['maximumArtifactBytes', 0],
      ['maximumArtifactBytes', 67_108_865],
      ['maximumArtifacts', 0],
      ['maximumArtifacts', 65_537],
    ] as const
    for (const [field, value] of invalidPolicyValues) {
      expect(await failureReason(decodeRecursiveAnalysisRequest({
        ...requestInput(),
        policy: { ...requestInput().policy, [field]: value },
      }))).toBe('invalid-budget')
    }
  })

  it('rejects duplicate nodes, orphan parents, cycles, invalid lineage, depth, and fan-out', async () => {
    const request = await Effect.runPromise(
      decodeRecursiveAnalysisRequest(requestInput()),
    )
    const root = RecursiveDecompositionNodeId.make(sha('c'))
    const child = RecursiveDecompositionNodeId.make(sha('d'))
    const node = {
      id: root,
      groupKey: sha('8'),
      requestId: request.id,
      parentId: null,
      depth: 0,
      sourceVersionIds: request.sourceVersionIds,
      partitionIds: [],
    }
    expect(await failureReason(decodeRecursiveDecomposition({
      request,
      nodes: [node, node],
    }))).toBe('invalid-identity')
    expect(await failureReason(decodeRecursiveDecomposition({
      request,
      nodes: [
        node,
        {
          ...node,
          id: child,
          parentId: RecursiveDecompositionNodeId.make(sha('e')),
          depth: 1,
        },
      ],
    }))).toBe('missing-dependency')
    expect(await failureReason(decodeRecursiveDecomposition({
      request,
      nodes: [
        node,
        {
          ...node,
          id: child,
          parentId: root,
          depth: 2,
        },
      ],
    }))).toBe('invalid-lineage')
    expect(await failureReason(decodeRecursiveDecomposition({
      request,
      nodes: [{
        ...node,
        sourceVersionIds: [ids.sourceA],
      }],
    }))).toBe('invalid-lineage')
    expect(await failureReason(decodeRecursiveDecomposition({
      request,
      nodes: [{
        ...node,
        sourceVersionIds: [ids.sourceA, ids.sourceA],
      }],
    }))).toBe('malformed')
    expect(await failureReason(decodeRecursiveDecomposition({
      request,
      nodes: [{
        ...node,
        partitionIds: [sha('1'), sha('1')],
      }],
    }))).toBe('malformed')
    expect(await failureReason(decodeRecursiveDecomposition({
      request: {
        ...request,
        policy: { ...request.policy, maximumFanOut: 1 },
      },
      nodes: [
        node,
        { ...node, id: child, parentId: root, depth: 1 },
        {
          ...node,
          id: RecursiveDecompositionNodeId.make(sha('f')),
          parentId: root,
          depth: 1,
        },
      ],
    }))).toBe('fan-out-exceeded')
    expect(await failureReason(decodeRecursiveDecomposition({
      request,
      nodes: [
        node,
        {
          ...node,
          id: child,
          parentId: root,
          depth: 1,
          sourceVersionIds: [
            '610e8400-e29b-41d4-a716-446655440099',
          ],
        },
      ],
    }))).toBe('invalid-lineage')
    expect(await failureReason(decodeRecursiveDecomposition({
      request,
      nodes: [
        node,
        {
          ...node,
          id: child,
          parentId: child,
          depth: 1,
        },
      ],
    }))).not.toBe('success')
  })

  it('rejects impossible coverage, discarded contradictions, and false completion', async () => {
    const aggregation = {
      version: '1',
      id: sha('1'),
      requestId: sha('2'),
      nodeId: sha('3'),
      inputBatchIds: [sha('4')],
      findings: [],
      coverage: {
        id: sha('5'),
        expectedItems: 2,
        examinedItems: 1,
        missingItems: 1,
        excludedItems: 0,
        expectedPartitions: 2,
        examinedPartitions: 1,
        status: 'partial',
      },
      contradictions: [{
        id: sha('6'),
        claimSignature: sha('7'),
        supportingEvidence: [sha('8')],
        conflictingEvidence: [sha('9')],
        status: 'unresolved',
        limitations: [],
      }],
      sufficiency: {
        id: sha('a'),
        status: 'sufficient',
        evidenceIds: [sha('8')],
        contradictionIds: [],
        limitations: [],
      },
      terminal: { id: sha('b'), reason: { kind: 'completed' } },
    }
    expect(await failureReason(decodeRecursiveAggregationResult(aggregation)))
      .toBe('malformed')
    expect(() => Schema.decodeUnknownSync(RecursiveAggregationResult)({
      ...aggregation,
      coverage: {
        ...aggregation.coverage,
        examinedItems: 2,
      },
    })).toThrow()
    expect(() => Schema.decodeUnknownSync(RecursiveTerminalReason)({
      kind: 'unknown-reason',
    })).toThrow()
  })
})
