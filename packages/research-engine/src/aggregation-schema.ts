import {
  RecursiveAggregationId,
  RecursiveAnalysisRequestId,
  RecursiveBatchId,
  RecursiveContradictionId,
  RecursiveDecompositionNodeId,
  RecursiveEvidenceId,
  RecursiveFindingId,
  RecursivePartitionId,
  RecursiveSufficiencyId,
  RecursiveTerminalStateId,
  ResearchContractValidationError,
  decodeRecursiveAggregationResult,
  decodeRecursiveAnalysisRequest,
  decodeRecursiveBatchInput,
  decodeRecursiveBatchResult,
  decodeRecursiveDecomposition,
} from '@struct/domain'
import type * as Domain from '@struct/domain'
import { Effect } from 'effect'
import { validateCoverageIdentity } from './coverage-metadata.js'

function compareBytes(leftBytes: Uint8Array, rightBytes: Uint8Array): number {
  const sharedLength = Math.min(leftBytes.length, rightBytes.length)
  for (let index = 0; index < sharedLength; index += 1) {
    const difference = leftBytes[index]! - rightBytes[index]!
    if (difference !== 0) return difference
  }
  return leftBytes.length - rightBytes.length
}

export function orderCanonicalIdentities<T extends string>(
  identities: ReadonlyArray<T>,
): ReadonlyArray<T> {
  const encoder = new TextEncoder()
  return Array.from(identities, (value) => ({
    value,
    bytes: encoder.encode(value),
  }))
    .sort((left, right) => compareBytes(left.bytes, right.bytes))
    .map(({ value }) => value)
}

function digestFields(fields: ReadonlyArray<string>): string {
  const canonical = fields.map((field) => `${field.length}:${field}`).join('')
  return `sha256:${new Bun.CryptoHasher('sha256').update(canonical).digest('hex')}`
}

function policyFields(
  policy: Domain.RecursiveAnalysisRequest['policy'],
): ReadonlyArray<string> {
  return [
    String(policy.maximumDepth),
    String(policy.maximumFanOut),
    String(policy.maximumConcurrency),
    String(policy.maximumElapsedMilliseconds),
    String(policy.maximumTokens),
    String(policy.maximumEstimatedCostMicros),
    String(policy.maximumPartitionBytes),
    String(policy.maximumArtifactBytes),
    String(policy.maximumArtifacts),
  ]
}

export function computeRecursiveAnalysisRequestId(
  request: Omit<Domain.RecursiveAnalysisRequest, 'id'>,
): RecursiveAnalysisRequestId {
  return RecursiveAnalysisRequestId.make(digestFields([
    request.version,
    request.planId,
    request.objectiveSignature,
    ...orderCanonicalIdentities(request.sourceVersionIds),
    ...policyFields(request.policy),
  ]))
}

export function computeRecursiveDecompositionNodeId(
  node: Omit<Domain.RecursiveDecompositionNode, 'id' | 'partitionIds'>,
): RecursiveDecompositionNodeId {
  return RecursiveDecompositionNodeId.make(digestFields([
    node.requestId,
    node.parentId ?? '',
    String(node.depth),
    ...orderCanonicalIdentities(node.sourceVersionIds),
  ]))
}

export function computeRecursivePartitionId(
  partition: Omit<Domain.RecursivePartition, 'id' | 'ordinal'>,
): RecursivePartitionId {
  return RecursivePartitionId.make(digestFields([
    partition.nodeId,
    partition.schemaFamily,
    String(partition.byteLength),
    ...orderCanonicalIdentities(partition.sourceVersionIds),
    ...orderCanonicalIdentities(partition.entryKeys),
  ]))
}

export function computeRecursiveBatchId(
  batch: Omit<Domain.RecursiveBatchInput, 'id' | 'partition'> & {
    readonly partitionId: RecursivePartitionId
  },
): RecursiveBatchId {
  return RecursiveBatchId.make(digestFields([
    batch.version,
    batch.requestId,
    batch.nodeId,
    batch.partitionId,
    batch.evidenceSchemaVersion,
  ]))
}

export function computeRecursiveEvidenceId(
  evidence: Omit<Domain.RecursiveEvidenceReference, 'id'>,
): RecursiveEvidenceId {
  return RecursiveEvidenceId.make(digestFields([
    evidence.sourceVersionId,
    evidence.artifact.digest,
    String(evidence.artifact.byteLength),
    evidence.artifact.mediaType,
    evidence.locator,
  ]))
}

export function computeRecursiveContradictionId(
  contradiction: Omit<
    Domain.RecursiveContradiction,
    'id' | 'status' | 'limitations'
  >,
): RecursiveContradictionId {
  return RecursiveContradictionId.make(digestFields([
    contradiction.claimSignature,
    ...orderCanonicalIdentities(contradiction.supportingEvidence),
    ...orderCanonicalIdentities(contradiction.conflictingEvidence),
  ]))
}

export function computeRecursiveFindingId(
  finding: Omit<
    Domain.ResearchFinding,
    'id' | 'claim' | 'limitations' | 'tags'
  >,
): RecursiveFindingId {
  return RecursiveFindingId.make(digestFields([
    finding.claimSignature,
    finding.coverage.id,
    ...orderCanonicalIdentities(finding.evidence.map((evidence) => evidence.id)),
    ...orderCanonicalIdentities(finding.supportingExamples),
    ...orderCanonicalIdentities(finding.counterEvidence),
    ...orderCanonicalIdentities(
      finding.contradictions.map((contradiction) => contradiction.id),
    ),
    String(finding.confidence),
    String(finding.importance),
  ]))
}

export function computeRecursiveSufficiencyId(
  sufficiency: Omit<Domain.RecursiveSufficiency, 'id' | 'limitations'>,
): RecursiveSufficiencyId {
  return RecursiveSufficiencyId.make(digestFields([
    sufficiency.status,
    ...orderCanonicalIdentities(sufficiency.evidenceIds),
    ...orderCanonicalIdentities(sufficiency.contradictionIds),
  ]))
}

function terminalReasonFields(
  reason: Domain.RecursiveTerminalReason,
): ReadonlyArray<string> {
  return 'limit' in reason
    ? [reason.kind, String(reason.limit)]
    : [reason.kind]
}

export function computeRecursiveTerminalStateId(
  reason: Domain.RecursiveTerminalReason,
): RecursiveTerminalStateId {
  return RecursiveTerminalStateId.make(digestFields(terminalReasonFields(reason)))
}

export function computeRecursiveAggregationId(
  aggregation: Pick<
    Domain.RecursiveAggregationResult,
    'version' | 'requestId' | 'nodeId' | 'inputBatchIds' | 'coverage'
  > & {
    readonly findingIds: ReadonlyArray<RecursiveFindingId>
    readonly contradictionIds: ReadonlyArray<RecursiveContradictionId>
    readonly sufficiencyId: RecursiveSufficiencyId
    readonly terminalId: RecursiveTerminalStateId
  },
): RecursiveAggregationId {
  return RecursiveAggregationId.make(digestFields([
    aggregation.version,
    aggregation.requestId,
    aggregation.nodeId,
    aggregation.coverage.id,
    aggregation.sufficiencyId,
    aggregation.terminalId,
    ...orderCanonicalIdentities(aggregation.inputBatchIds),
    ...orderCanonicalIdentities(aggregation.findingIds),
    ...orderCanonicalIdentities(aggregation.contradictionIds),
  ]))
}

function identityFailure(
  contract: 'recursive-request' | 'recursive-decomposition' | 'recursive-batch' | 'recursive-aggregation',
  path: string,
  message: string,
) {
  return new ResearchContractValidationError({
    contract,
    reason: 'invalid-identity',
    path,
    message,
  })
}

function batchContractFailure(
  reason: 'invalid-lineage' | 'malformed',
  path: string,
  message: string,
) {
  return new ResearchContractValidationError({
    contract: 'recursive-batch',
    reason,
    path,
    message,
  })
}

export const validateRecursiveRequestContract = Effect.fn(
  'RecursiveAnalysisRequest.validate',
)(function* (input: unknown) {
  const request = yield* decodeRecursiveAnalysisRequest(input)
  if (request.id !== computeRecursiveAnalysisRequestId(request)) {
    return yield* identityFailure(
      'recursive-request',
      'id',
      'Recursive request identity does not match its canonical inputs',
    )
  }
  return request
})

export const validateRecursiveDecompositionContract = Effect.fn(
  'RecursiveDecomposition.validate',
)(function* (input: unknown) {
  const decomposition = yield* decodeRecursiveDecomposition(input)
  yield* validateRecursiveRequestContract(decomposition.request)
  for (const node of decomposition.nodes) {
    if (node.id !== computeRecursiveDecompositionNodeId(node)) {
      return yield* identityFailure(
        'recursive-decomposition',
        `nodes.${node.id}.id`,
        'Decomposition node identity does not match its canonical lineage',
      )
    }
  }
  return decomposition
})

const validateContradictionIdentity = Effect.fn(
  'RecursiveContradiction.validateIdentity',
)(function* (
  contradiction: Domain.RecursiveContradiction,
  contract: 'recursive-batch' | 'recursive-aggregation',
) {
  if (contradiction.id !== computeRecursiveContradictionId(contradiction)) {
    return yield* identityFailure(
      contract,
      `contradictions.${contradiction.id}.id`,
      'Contradiction identity does not match its canonical evidence',
    )
  }
  return contradiction
})

const validateFindingIdentity = Effect.fn(
  'ResearchFinding.validateRecursiveIdentity',
)(function* (
  finding: Domain.ResearchFinding,
  contract: 'recursive-batch' | 'recursive-aggregation',
) {
  yield* validateCoverageIdentity(finding.coverage, contract)
  for (const evidence of finding.evidence) {
    if (evidence.id !== computeRecursiveEvidenceId(evidence)) {
      return yield* identityFailure(
        contract,
        `findings.${finding.id}.evidence.${evidence.id}`,
        'Evidence identity does not match its immutable source and artifact',
      )
    }
  }
  for (const contradiction of finding.contradictions) {
    yield* validateContradictionIdentity(contradiction, contract)
  }
  if (finding.id !== computeRecursiveFindingId(finding)) {
    return yield* identityFailure(
      contract,
      `findings.${finding.id}.id`,
      'Finding identity does not match its canonical evidence',
    )
  }
  return finding
})

function validateSufficiencyAndTerminal(
  result: Pick<Domain.RecursiveBatchResult, 'sufficiency' | 'terminal'>,
  contract: 'recursive-batch' | 'recursive-aggregation',
) {
  if (
    result.sufficiency.id
    !== computeRecursiveSufficiencyId(result.sufficiency)
  ) {
    return identityFailure(
      contract,
      'sufficiency.id',
      'Sufficiency identity does not match its canonical evidence',
    )
  }
  if (
    result.terminal.id
    !== computeRecursiveTerminalStateId(result.terminal.reason)
  ) {
    return identityFailure(
      contract,
      'terminal.id',
      'Terminal-state identity does not match its deterministic reason',
    )
  }
  return undefined
}

export const validateRecursiveBatchResultContract = Effect.fn(
  'RecursiveBatchResult.validate',
)(function* (input: unknown, expectedBatchInput: unknown) {
  const expectedBatch = yield* validateRecursiveBatchInputContract(
    expectedBatchInput,
  )
  const result = yield* decodeRecursiveBatchResult(input)
  if (result.batchId !== expectedBatch.id) {
    return yield* identityFailure(
      'recursive-batch',
      'batchId',
      'Batch result identity does not match its canonical input',
    )
  }
  const expectedSourceVersionIds = new Set(
    expectedBatch.partition.sourceVersionIds,
  )
  for (const finding of result.findings) {
    for (const evidence of finding.evidence) {
      if (!expectedSourceVersionIds.has(evidence.sourceVersionId)) {
        return yield* batchContractFailure(
          'invalid-lineage',
          `findings.${finding.id}.evidence.${evidence.id}.sourceVersionId`,
          'Batch evidence source version must belong to the expected partition',
        )
      }
    }
  }
  if (result.coverage.expectedItems !== expectedBatch.partition.entryKeys.length) {
    return yield* batchContractFailure(
      'malformed',
      'coverage.expectedItems',
      'Batch coverage expectedItems must match the expected partition entry count',
    )
  }
  if (result.coverage.expectedPartitions !== 1) {
    return yield* batchContractFailure(
      'malformed',
      'coverage.expectedPartitions',
      'Batch coverage must account for exactly one expected partition',
    )
  }
  yield* validateCoverageIdentity(result.coverage, 'recursive-batch')
  for (const contradiction of result.contradictions) {
    yield* validateContradictionIdentity(contradiction, 'recursive-batch')
  }
  for (const finding of result.findings) {
    yield* validateFindingIdentity(finding, 'recursive-batch')
  }
  const error = validateSufficiencyAndTerminal(result, 'recursive-batch')
  if (error !== undefined) return yield* error
  return result
})

export const validateRecursiveBatchInputContract = Effect.fn(
  'RecursiveBatchInput.validate',
)(function* (input: unknown) {
  const batch = yield* decodeRecursiveBatchInput(input)
  if (batch.partition.nodeId !== batch.nodeId) {
    return yield* new ResearchContractValidationError({
      contract: 'recursive-batch',
      reason: 'invalid-lineage',
      path: 'partition.nodeId',
      message: 'Batch partition must belong to the batch decomposition node',
    })
  }
  if (batch.partition.id !== computeRecursivePartitionId(batch.partition)) {
    return yield* identityFailure(
      'recursive-batch',
      'partition.id',
      'Partition identity does not match its canonical inputs',
    )
  }
  if (
    batch.id !== computeRecursiveBatchId({
      version: batch.version,
      requestId: batch.requestId,
      nodeId: batch.nodeId,
      partitionId: batch.partition.id,
      evidenceSchemaVersion: batch.evidenceSchemaVersion,
    })
  ) {
    return yield* identityFailure(
      'recursive-batch',
      'id',
      'Batch identity does not match its canonical inputs',
    )
  }
  return batch
})

export const validateRecursiveAggregationContract = Effect.fn(
  'RecursiveAggregation.validate',
)(function* (input: unknown) {
  const aggregation = yield* decodeRecursiveAggregationResult(input)
  yield* validateCoverageIdentity(aggregation.coverage)
  for (const contradiction of aggregation.contradictions) {
    yield* validateContradictionIdentity(contradiction, 'recursive-aggregation')
  }
  for (const finding of aggregation.findings) {
    yield* validateFindingIdentity(finding, 'recursive-aggregation')
  }
  const identityError = validateSufficiencyAndTerminal(
    aggregation,
    'recursive-aggregation',
  )
  if (identityError !== undefined) return yield* identityError
  const expectedId = computeRecursiveAggregationId({
    version: aggregation.version,
    requestId: aggregation.requestId,
    nodeId: aggregation.nodeId,
    inputBatchIds: aggregation.inputBatchIds,
    coverage: aggregation.coverage,
    findingIds: aggregation.findings.map((finding) => finding.id),
    contradictionIds: aggregation.contradictions.map(
      (contradiction) => contradiction.id,
    ),
    sufficiencyId: aggregation.sufficiency.id,
    terminalId: aggregation.terminal.id,
  })
  if (aggregation.id !== expectedId) {
    return yield* identityFailure(
      'recursive-aggregation',
      'id',
      'Aggregation identity does not match its canonical inputs',
    )
  }
  return aggregation
})

export type ValidRecursiveDecomposition = Domain.RecursiveDecomposition
