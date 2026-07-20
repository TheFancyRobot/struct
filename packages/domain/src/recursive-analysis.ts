import { Effect, ParseResult, Schema } from 'effect'
import {
  ProjectId,
  ResearchCheckpointId,
  ResearchPlanId,
  ResearchRunId,
  SourceVersionId,
  WorkspaceId,
} from './branded-ids.js'
import { Sha256Digest } from './directory-manifest.js'
import {
  RecursiveContradiction,
  RecursiveContradictionId,
  RecursiveCoverage,
  RecursiveEvidenceId,
  ResearchFinding,
} from './research-finding.js'
import { ResearchContractValidationError } from './typed-errors.js'

const StableIdentity = Schema.String.pipe(
  Schema.pattern(/^sha256:[0-9a-f]{64}$/),
)
const PositiveInteger = Schema.Number.pipe(Schema.finite(), Schema.int(), Schema.positive())
const Counter = Schema.Number.pipe(Schema.finite(), Schema.int(), Schema.nonNegative())
const NonBlankString = Schema.String.pipe(
  Schema.minLength(1),
  Schema.maxLength(512),
  Schema.filter((value) => value.trim().length > 0 || 'must not be blank'),
)

export const RecursiveAnalysisContractVersion = Schema.Literal('1')

export const RecursiveAnalysisRequestId = StableIdentity.pipe(
  Schema.brand('RecursiveAnalysisRequestId'),
)
export type RecursiveAnalysisRequestId =
  Schema.Schema.Type<typeof RecursiveAnalysisRequestId>

export const RecursiveDecompositionNodeId = StableIdentity.pipe(
  Schema.brand('RecursiveDecompositionNodeId'),
)
export type RecursiveDecompositionNodeId =
  Schema.Schema.Type<typeof RecursiveDecompositionNodeId>

export const RecursivePartitionId = StableIdentity.pipe(
  Schema.brand('RecursivePartitionId'),
)
export type RecursivePartitionId =
  Schema.Schema.Type<typeof RecursivePartitionId>

export const RecursiveBatchId = StableIdentity.pipe(
  Schema.brand('RecursiveBatchId'),
)
export type RecursiveBatchId = Schema.Schema.Type<typeof RecursiveBatchId>

export const RecursiveAggregationId = StableIdentity.pipe(
  Schema.brand('RecursiveAggregationId'),
)
export type RecursiveAggregationId =
  Schema.Schema.Type<typeof RecursiveAggregationId>

export const RecursiveSufficiencyId = StableIdentity.pipe(
  Schema.brand('RecursiveSufficiencyId'),
)
export type RecursiveSufficiencyId =
  Schema.Schema.Type<typeof RecursiveSufficiencyId>

export const RecursiveTerminalStateId = StableIdentity.pipe(
  Schema.brand('RecursiveTerminalStateId'),
)
export type RecursiveTerminalStateId =
  Schema.Schema.Type<typeof RecursiveTerminalStateId>

export const RecursiveAnalysisPolicy = Schema.Struct({
  maximumDepth: PositiveInteger.pipe(Schema.lessThanOrEqualTo(16)),
  maximumFanOut: PositiveInteger.pipe(Schema.lessThanOrEqualTo(64)),
  maximumPartitionItems: PositiveInteger.pipe(
    Schema.lessThanOrEqualTo(25_000),
  ),
  maximumPartitionAttempts: PositiveInteger.pipe(
    Schema.lessThanOrEqualTo(16),
  ),
  maximumConcurrency: PositiveInteger.pipe(Schema.lessThanOrEqualTo(64)),
  maximumElapsedMilliseconds: PositiveInteger.pipe(
    Schema.lessThanOrEqualTo(86_400_000),
  ),
  maximumTokens: PositiveInteger.pipe(Schema.lessThanOrEqualTo(10_000_000)),
  maximumEstimatedCostMicros: Counter.pipe(
    Schema.lessThanOrEqualTo(1_000_000_000),
  ),
  maximumPartitionBytes: PositiveInteger.pipe(
    Schema.lessThanOrEqualTo(1_073_741_824),
  ),
  maximumArtifactBytes: PositiveInteger.pipe(
    Schema.lessThanOrEqualTo(67_108_864),
  ),
  maximumArtifacts: PositiveInteger.pipe(Schema.lessThanOrEqualTo(65_536)),
})
export type RecursiveAnalysisPolicy =
  Schema.Schema.Type<typeof RecursiveAnalysisPolicy>

export const RecursiveCheckpointLink = Schema.Struct({
  id: ResearchCheckpointId,
  runId: ResearchRunId,
  planId: ResearchPlanId,
  executionContractVersion: Schema.Literal('1'),
})
export type RecursiveCheckpointLink =
  Schema.Schema.Type<typeof RecursiveCheckpointLink>

export const RecursiveAnalysisRequest = Schema.Struct({
  version: RecursiveAnalysisContractVersion,
  id: RecursiveAnalysisRequestId,
  runId: ResearchRunId,
  planId: ResearchPlanId,
  workspaceId: WorkspaceId,
  projectId: ProjectId,
  objectiveSignature: Sha256Digest,
  sourceVersionIds: Schema.Array(SourceVersionId).pipe(
    Schema.minItems(1),
    Schema.maxItems(25_000),
  ),
  policy: RecursiveAnalysisPolicy,
  checkpoint: Schema.NullOr(RecursiveCheckpointLink),
}).pipe(
  Schema.filter((request) => [
    new Set(request.sourceVersionIds).size === request.sourceVersionIds.length
      ? undefined
      : 'sourceVersionIds must be unique',
    request.checkpoint === null
      || (
        request.checkpoint.runId === request.runId
        && request.checkpoint.planId === request.planId
      )
      ? undefined
      : 'checkpoint identity must match the recursive request',
  ]),
)
export type RecursiveAnalysisRequest =
  Schema.Schema.Type<typeof RecursiveAnalysisRequest>

export const RecursiveDecompositionNode = Schema.Struct({
  id: RecursiveDecompositionNodeId,
  groupKey: StableIdentity,
  requestId: RecursiveAnalysisRequestId,
  parentId: Schema.NullOr(RecursiveDecompositionNodeId),
  depth: Counter.pipe(Schema.lessThanOrEqualTo(16)),
  sourceVersionIds: Schema.Array(SourceVersionId).pipe(Schema.minItems(1)),
  partitionIds: Schema.Array(RecursivePartitionId).pipe(Schema.maxItems(64)),
}).pipe(
  Schema.filter((node) => [
    new Set(node.sourceVersionIds).size === node.sourceVersionIds.length
      ? undefined
      : 'node sourceVersionIds must be unique',
    new Set(node.partitionIds).size === node.partitionIds.length
      ? undefined
      : 'node partitionIds must be unique',
  ]),
)
export type RecursiveDecompositionNode =
  Schema.Schema.Type<typeof RecursiveDecompositionNode>

export const RecursiveDecomposition = Schema.Struct({
  request: RecursiveAnalysisRequest,
  nodes: Schema.Array(RecursiveDecompositionNode).pipe(
    Schema.minItems(1),
    Schema.maxItems(65_536),
  ),
})
export type RecursiveDecomposition =
  Schema.Schema.Type<typeof RecursiveDecomposition>

export const RecursivePartition = Schema.Struct({
  id: RecursivePartitionId,
  nodeId: RecursiveDecompositionNodeId,
  ordinal: Counter,
  schemaFamily: NonBlankString,
  pathGroup: NonBlankString,
  sizeBand: Schema.Literal('empty', 'tiny', 'small', 'medium', 'large'),
  planId: ResearchPlanId,
  sourceVersionIds: Schema.Array(SourceVersionId).pipe(Schema.minItems(1)),
  entryKeys: Schema.Array(NonBlankString).pipe(Schema.minItems(1)),
  byteLength: Counter,
  estimatedTokens: Counter,
  estimatedCostMicros: Counter,
  estimatedArtifactBytes: Counter,
}).pipe(
  Schema.filter((partition) => [
    new Set(partition.sourceVersionIds).size === partition.sourceVersionIds.length
      ? undefined
      : 'partition sourceVersionIds must be unique',
    new Set(partition.entryKeys).size === partition.entryKeys.length
      ? undefined
      : 'partition entryKeys must be unique',
  ]),
)
export type RecursivePartition = Schema.Schema.Type<typeof RecursivePartition>

export const RecursiveBatchInput = Schema.Struct({
  version: RecursiveAnalysisContractVersion,
  id: RecursiveBatchId,
  requestId: RecursiveAnalysisRequestId,
  nodeId: RecursiveDecompositionNodeId,
  partition: RecursivePartition,
  evidenceSchemaVersion: NonBlankString,
})
export type RecursiveBatchInput =
  Schema.Schema.Type<typeof RecursiveBatchInput>

export const RecursiveSufficiency = Schema.Struct({
  id: RecursiveSufficiencyId,
  status: Schema.Literal('sufficient', 'insufficient', 'contradictory'),
  evidenceIds: Schema.Array(RecursiveEvidenceId),
  contradictionIds: Schema.Array(RecursiveContradictionId),
  limitations: Schema.Array(NonBlankString).pipe(Schema.maxItems(64)),
}).pipe(
  Schema.filter((sufficiency) => [
    new Set(sufficiency.evidenceIds).size === sufficiency.evidenceIds.length
      ? undefined
      : 'sufficiency evidence identities must be unique',
    new Set(sufficiency.contradictionIds).size
      === sufficiency.contradictionIds.length
      ? undefined
      : 'sufficiency contradiction identities must be unique',
    sufficiency.status === 'sufficient' && sufficiency.evidenceIds.length === 0
      ? 'sufficient analysis requires evidence'
      : undefined,
    sufficiency.status === 'contradictory'
      && sufficiency.contradictionIds.length === 0
      ? 'contradictory analysis requires contradiction references'
      : undefined,
    sufficiency.status !== 'contradictory'
      && sufficiency.contradictionIds.length > 0
      ? 'retained contradictions require contradictory sufficiency'
      : undefined,
  ]),
)
export type RecursiveSufficiency =
  Schema.Schema.Type<typeof RecursiveSufficiency>

export const RecursiveTerminalReason = Schema.Union(
  Schema.Struct({ kind: Schema.Literal('completed') }),
  Schema.Struct({ kind: Schema.Literal('insufficient-evidence') }),
  Schema.Struct({ kind: Schema.Literal('contradictory-evidence') }),
  Schema.Struct({ kind: Schema.Literal('depth-limit'), limit: PositiveInteger }),
  Schema.Struct({ kind: Schema.Literal('fan-out-limit'), limit: PositiveInteger }),
  Schema.Struct({ kind: Schema.Literal('concurrency-limit'), limit: PositiveInteger }),
  Schema.Struct({ kind: Schema.Literal('time-limit'), limit: PositiveInteger }),
  Schema.Struct({ kind: Schema.Literal('token-limit'), limit: PositiveInteger }),
  Schema.Struct({ kind: Schema.Literal('cost-limit'), limit: Counter }),
  Schema.Struct({ kind: Schema.Literal('byte-limit'), limit: PositiveInteger }),
  Schema.Struct({ kind: Schema.Literal('artifact-limit'), limit: PositiveInteger }),
  Schema.Struct({
    kind: Schema.Literal('partition-attempts-exhausted'),
    limit: PositiveInteger,
  }),
  Schema.Struct({ kind: Schema.Literal('cancelled') }),
  Schema.Struct({ kind: Schema.Literal('source-version-stale') }),
  Schema.Struct({ kind: Schema.Literal('checkpoint-incompatible') }),
)
export type RecursiveTerminalReason =
  Schema.Schema.Type<typeof RecursiveTerminalReason>

export const RecursiveTerminalState = Schema.Struct({
  id: RecursiveTerminalStateId,
  reason: RecursiveTerminalReason,
})
export type RecursiveTerminalState =
  Schema.Schema.Type<typeof RecursiveTerminalState>

export const RecursiveBatchResult = Schema.Struct({
  version: RecursiveAnalysisContractVersion,
  batchId: RecursiveBatchId,
  findings: Schema.Array(ResearchFinding),
  coverage: RecursiveCoverage,
  contradictions: Schema.Array(RecursiveContradiction),
  sufficiency: RecursiveSufficiency,
  terminal: RecursiveTerminalState,
}).pipe(
  Schema.filter((result) => {
    const contradictionIds = new Set(
      result.contradictions.map((contradiction) => contradiction.id),
    )
    const unresolvedContradictionIds = new Set(
      result.contradictions
        .filter((contradiction) => contradiction.status === 'unresolved')
        .map((contradiction) => contradiction.id),
    )
    const retainedFindingContradictions = result.findings.flatMap(
      (finding) => finding.contradictions.map((contradiction) => contradiction.id),
    )
    const findingEvidenceIds = result.findings.flatMap(
      (finding) => finding.evidence.map((evidence) => evidence.id),
    )
    const knownEvidenceIds = new Set(findingEvidenceIds)
    const contradictionEvidenceIds = result.contradictions.flatMap(
      (contradiction) => [
        ...contradiction.supportingEvidence,
        ...contradiction.conflictingEvidence,
      ],
    )
    return [
      new Set(result.findings.map((finding) => finding.id)).size
        === result.findings.length
        ? undefined
        : 'batch finding identities must be unique',
      contradictionIds.size === result.contradictions.length
        ? undefined
        : 'batch contradiction identities must be unique',
      retainedFindingContradictions.every((id) => contradictionIds.has(id))
        ? undefined
        : 'batch result must retain every finding contradiction',
      result.sufficiency.contradictionIds.every(
        (id) => unresolvedContradictionIds.has(id),
      )
        ? undefined
        : 'batch sufficiency can reference only unresolved contradictions',
      [...unresolvedContradictionIds].every(
        (id) => result.sufficiency.contradictionIds.includes(id),
      )
        ? undefined
        : 'batch sufficiency must retain every unresolved contradiction',
      result.sufficiency.evidenceIds.every((id) => knownEvidenceIds.has(id))
        ? undefined
        : 'batch sufficiency cannot reference unknown evidence',
      findingEvidenceIds.every(
        (id) => result.sufficiency.evidenceIds.includes(id),
      )
        ? undefined
        : 'batch sufficiency must retain every finding evidence reference',
      contradictionEvidenceIds.every((id) => knownEvidenceIds.has(id))
        ? undefined
        : 'batch contradictions must reference carried finding evidence',
      result.coverage.status === 'partial'
        && result.sufficiency.status === 'sufficient'
        ? 'partial batch result cannot claim sufficient evidence'
        : undefined,
      result.terminal.reason.kind === 'completed'
        && result.sufficiency.status !== 'sufficient'
        ? 'completed batch result requires sufficient evidence'
        : undefined,
      result.sufficiency.status === 'sufficient'
        && (
          result.coverage.status !== 'complete'
          || result.terminal.reason.kind !== 'completed'
        )
        ? 'sufficient batch result requires complete coverage and completion'
        : undefined,
    ]
  }),
)
export type RecursiveBatchResult =
  Schema.Schema.Type<typeof RecursiveBatchResult>

export const RecursiveAggregationResult = Schema.Struct({
  version: RecursiveAnalysisContractVersion,
  id: RecursiveAggregationId,
  requestId: RecursiveAnalysisRequestId,
  nodeId: RecursiveDecompositionNodeId,
  inputBatchIds: Schema.Array(RecursiveBatchId).pipe(Schema.minItems(1)),
  findings: Schema.Array(ResearchFinding),
  coverage: RecursiveCoverage,
  contradictions: Schema.Array(RecursiveContradiction),
  sufficiency: RecursiveSufficiency,
  terminal: RecursiveTerminalState,
}).pipe(
  Schema.filter((aggregation) => {
    const contradictionIds = new Set(
      aggregation.contradictions.map((contradiction) => contradiction.id),
    )
    const unresolvedContradictionIds = new Set(
      aggregation.contradictions
        .filter((contradiction) => contradiction.status === 'unresolved')
        .map((contradiction) => contradiction.id),
    )
    const retainedFindingContradictions = aggregation.findings.flatMap(
      (finding) => finding.contradictions.map((contradiction) => contradiction.id),
    )
    const findingEvidenceIds = aggregation.findings.flatMap(
      (finding) => finding.evidence.map((evidence) => evidence.id),
    )
    const knownEvidenceIds = new Set(findingEvidenceIds)
    const contradictionEvidenceIds = aggregation.contradictions.flatMap(
      (contradiction) => [
        ...contradiction.supportingEvidence,
        ...contradiction.conflictingEvidence,
      ],
    )
    return [
      new Set(aggregation.inputBatchIds).size === aggregation.inputBatchIds.length
        ? undefined
        : 'aggregation input batch identities must be unique',
      new Set(aggregation.findings.map((finding) => finding.id)).size
        === aggregation.findings.length
        ? undefined
        : 'aggregation finding identities must be unique',
      contradictionIds.size === aggregation.contradictions.length
        ? undefined
        : 'aggregation contradiction identities must be unique',
      retainedFindingContradictions.every((id) => contradictionIds.has(id))
        ? undefined
        : 'aggregation must retain every finding contradiction',
      aggregation.sufficiency.contradictionIds.every(
        (id) => unresolvedContradictionIds.has(id),
      )
        ? undefined
        : 'aggregation sufficiency can reference only unresolved contradictions',
      [...unresolvedContradictionIds].every(
        (id) => aggregation.sufficiency.contradictionIds.includes(id),
      )
        ? undefined
        : 'aggregation sufficiency must retain every unresolved contradiction',
      aggregation.sufficiency.evidenceIds.every(
        (id) => knownEvidenceIds.has(id),
      )
        ? undefined
        : 'aggregation sufficiency cannot reference unknown evidence',
      findingEvidenceIds.every(
        (id) => aggregation.sufficiency.evidenceIds.includes(id),
      )
        ? undefined
        : 'aggregation sufficiency must retain every finding evidence reference',
      contradictionEvidenceIds.every((id) => knownEvidenceIds.has(id))
        ? undefined
        : 'aggregation contradictions must reference carried finding evidence',
      aggregation.coverage.status === 'partial'
        && aggregation.sufficiency.status === 'sufficient'
        ? 'partial aggregation cannot claim sufficient evidence'
        : undefined,
      aggregation.terminal.reason.kind === 'completed'
        && aggregation.sufficiency.status !== 'sufficient'
        ? 'completed aggregation requires sufficient evidence'
        : undefined,
      aggregation.sufficiency.status === 'sufficient'
        && (
          aggregation.coverage.status !== 'complete'
          || aggregation.terminal.reason.kind !== 'completed'
        )
        ? 'sufficient aggregation requires complete coverage and completion'
        : undefined,
    ]
  }),
)
export type RecursiveAggregationResult =
  Schema.Schema.Type<typeof RecursiveAggregationResult>

function recursiveParseFailure(
  contract: 'recursive-request' | 'recursive-decomposition' | 'recursive-batch' | 'recursive-aggregation',
  error: ParseResult.ParseError,
): ResearchContractValidationError {
  const issue = ParseResult.ArrayFormatter.formatErrorSync(error)[0]
  const path = issue?.path.map(String).join('.') ?? ''
  return new ResearchContractValidationError({
    contract,
    reason: path.includes('policy') || path.includes('limit')
      ? 'invalid-budget'
      : /(^|\.)(id|requestId|nodeId|parentId|partitionId|batchId|sourceVersionIds?)(\.|$)/.test(path)
        ? 'invalid-identity'
        : 'malformed',
    path,
    message: issue?.message ?? 'Recursive analysis contract validation failed',
  })
}

function decompositionFailure(
  decomposition: RecursiveDecomposition,
): ResearchContractValidationError | undefined {
  const nodeIds = new Set(decomposition.nodes.map((node) => node.id))
  if (nodeIds.size !== decomposition.nodes.length) {
    return new ResearchContractValidationError({
      contract: 'recursive-decomposition',
      reason: 'invalid-identity',
      path: 'nodes.id',
      message: 'Decomposition node identities must be unique',
    })
  }
  const roots = decomposition.nodes.filter((node) => node.parentId === null)
  const root = roots[0]
  if (roots.length !== 1 || root === undefined || root.depth !== 0) {
    return new ResearchContractValidationError({
      contract: 'recursive-decomposition',
      reason: 'invalid-lineage',
      path: 'nodes.parentId',
      message: 'Decomposition requires exactly one depth-zero root',
    })
  }
  const requestSources = new Set(decomposition.request.sourceVersionIds)
  const rootSources = new Set(root.sourceVersionIds)
  if (
    requestSources.size !== rootSources.size
    || !decomposition.request.sourceVersionIds.every((id) => rootSources.has(id))
  ) {
    return new ResearchContractValidationError({
      contract: 'recursive-decomposition',
      reason: 'invalid-lineage',
      path: `nodes.${root.id}.sourceVersionIds`,
      message: 'Root lineage must cover exactly the request source versions',
    })
  }
  const byId = new Map(decomposition.nodes.map((node) => [node.id, node] as const))
  for (const node of decomposition.nodes) {
    if (node.requestId !== decomposition.request.id) {
      return new ResearchContractValidationError({
        contract: 'recursive-decomposition',
        reason: 'invalid-lineage',
        path: `nodes.${node.id}.requestId`,
        message: 'Every node must belong to the decomposition request',
      })
    }
    if (node.depth > decomposition.request.policy.maximumDepth) {
      return new ResearchContractValidationError({
        contract: 'recursive-decomposition',
        reason: 'invalid-budget',
        path: `nodes.${node.id}.depth`,
        message: 'Node depth exceeds the recursive policy',
      })
    }
    if (node.parentId !== null) {
      const parent = byId.get(node.parentId)
      if (parent === undefined) {
        return new ResearchContractValidationError({
          contract: 'recursive-decomposition',
          reason: 'missing-dependency',
          path: `nodes.${node.id}.parentId`,
          message: 'Decomposition node references a missing parent',
        })
      }
      if (node.depth !== parent.depth + 1) {
        return new ResearchContractValidationError({
          contract: 'recursive-decomposition',
          reason: 'invalid-lineage',
          path: `nodes.${node.id}.depth`,
          message: 'Child depth must be exactly one greater than parent depth',
        })
      }
      const parentSources = new Set(parent.sourceVersionIds)
      if (!node.sourceVersionIds.every((id) => parentSources.has(id))) {
        return new ResearchContractValidationError({
          contract: 'recursive-decomposition',
          reason: 'invalid-lineage',
          path: `nodes.${node.id}.sourceVersionIds`,
          message: 'Child source versions must be a subset of parent lineage',
        })
      }
    }
  }
  const childCounts = new Map<RecursiveDecompositionNodeId, number>()
  for (const node of decomposition.nodes) {
    if (node.parentId !== null) {
      childCounts.set(node.parentId, (childCounts.get(node.parentId) ?? 0) + 1)
    }
  }
  if (
    [...childCounts.values()].some(
      (count) => count > decomposition.request.policy.maximumFanOut,
    )
  ) {
    return new ResearchContractValidationError({
      contract: 'recursive-decomposition',
      reason: 'fan-out-exceeded',
      path: 'nodes.parentId',
      message: 'Decomposition fan-out exceeds the recursive policy',
    })
  }
  for (const node of decomposition.nodes) {
    const seen = new Set<RecursiveDecompositionNodeId>()
    let current: RecursiveDecompositionNode | undefined = node
    while (current?.parentId !== null && current !== undefined) {
      if (seen.has(current.id)) {
        return new ResearchContractValidationError({
          contract: 'recursive-decomposition',
          reason: 'cyclic-dependency',
          path: `nodes.${node.id}.parentId`,
          message: 'Decomposition lineage must be acyclic',
        })
      }
      seen.add(current.id)
      current = byId.get(current.parentId)
    }
  }
  return undefined
}

export const decodeRecursiveAnalysisRequest = Effect.fn(
  'RecursiveAnalysisRequest.decode',
)(function* (input: unknown) {
  return yield* Schema.decodeUnknown(RecursiveAnalysisRequest)(input).pipe(
    Effect.mapError((error) => recursiveParseFailure('recursive-request', error)),
  )
})

export const decodeRecursiveDecomposition = Effect.fn(
  'RecursiveDecomposition.decode',
)(function* (input: unknown) {
  const decomposition = yield* Schema.decodeUnknown(RecursiveDecomposition)(
    input,
  ).pipe(
    Effect.mapError((error) =>
      recursiveParseFailure('recursive-decomposition', error)),
  )
  const error = decompositionFailure(decomposition)
  if (error !== undefined) return yield* error
  return decomposition
})

export const decodeRecursiveBatchResult = Effect.fn(
  'RecursiveBatchResult.decode',
)(function* (input: unknown) {
  return yield* Schema.decodeUnknown(RecursiveBatchResult)(input).pipe(
    Effect.mapError((error) => recursiveParseFailure('recursive-batch', error)),
  )
})

export const decodeRecursiveBatchInput = Effect.fn(
  'RecursiveBatchInput.decode',
)(function* (input: unknown) {
  return yield* Schema.decodeUnknown(RecursiveBatchInput)(input).pipe(
    Effect.mapError((error) => recursiveParseFailure('recursive-batch', error)),
  )
})

export const decodeRecursiveAggregationResult = Effect.fn(
  'RecursiveAggregationResult.decode',
)(function* (input: unknown) {
  return yield* Schema.decodeUnknown(RecursiveAggregationResult)(input).pipe(
    Effect.mapError((error) =>
      recursiveParseFailure('recursive-aggregation', error)),
  )
})
