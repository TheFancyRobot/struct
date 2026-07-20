import { Effect, ParseResult, Schema } from 'effect'
import {
  ResearchCheckpointId,
  ResearchPlanId,
  ResearchPlanNodeId,
  ResearchRunId,
} from './branded-ids.js'
import { Sha256Digest } from './directory-manifest.js'
import {
  ResearchBudget,
  ResearchContractVersion,
} from './research-plan.js'
import { ResearchContractValidationError } from './typed-errors.js'

const Counter = Schema.Number.pipe(
  Schema.finite(),
  Schema.int(),
  Schema.nonNegative(),
)
const MAX_CHECKPOINT_BYTES = 64 * 1024

export const ResearchBudgetUsage = Schema.Struct({
  steps: Counter,
  modelCalls: Counter,
  toolCalls: Counter,
  tokens: Counter,
  elapsedMilliseconds: Counter,
  estimatedCostMicros: Counter,
  revisions: Counter,
})
export type ResearchBudgetUsage =
  Schema.Schema.Type<typeof ResearchBudgetUsage>

export const ResearchArtifactRef = Schema.Struct({
  digest: Sha256Digest,
  byteLength: Counter,
  mediaType: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(255)),
})
export type ResearchArtifactRef =
  Schema.Schema.Type<typeof ResearchArtifactRef>

export const ResearchExecutionState = Schema.Struct({
  version: ResearchContractVersion,
  runId: ResearchRunId,
  planId: ResearchPlanId,
  status: Schema.Literal(
    'pending',
    'running',
    'paused',
    'completed',
    'failed',
    'cancelled',
    'partial',
  ),
  currentNodeId: Schema.NullOr(ResearchPlanNodeId),
  completed: Schema.Array(Schema.Struct({
    nodeId: ResearchPlanNodeId,
    artifacts: Schema.Array(ResearchArtifactRef).pipe(Schema.maxItems(64)),
  })).pipe(Schema.maxItems(64)),
  budget: Schema.Struct({
    limits: ResearchBudget,
    used: ResearchBudgetUsage,
  }),
  cancellation: Schema.Literal('none', 'requested', 'acknowledged'),
  duplicateActionCount: Counter,
  noProgressCount: Counter,
  fredCorrelation: Schema.NullOr(Schema.String.pipe(Schema.minLength(1))),
  lastEventSequence: Counter,
})
export type ResearchExecutionState =
  Schema.Schema.Type<typeof ResearchExecutionState>

export const ResearchExecutionCheckpoint = Schema.Struct({
  version: ResearchContractVersion,
  id: ResearchCheckpointId,
  state: ResearchExecutionState,
})
export type ResearchExecutionCheckpoint =
  Schema.Schema.Type<typeof ResearchExecutionCheckpoint>

function executionFailure(
  error: ParseResult.ParseError,
): ResearchContractValidationError {
  const issue = ParseResult.ArrayFormatter.formatErrorSync(error)[0]
  const path = issue?.path.map(String).join('.') ?? ''
  return new ResearchContractValidationError({
    contract: 'execution',
    reason: path.includes('budget')
      ? 'invalid-budget'
      : /(^|\.)(id|runId|planId|nodeId|currentNodeId)(\.|$)/.test(path)
        ? 'invalid-identity'
        : 'malformed',
    path,
    message: issue?.message ?? 'Execution state validation failed',
  })
}

function exceedsBudget(state: ResearchExecutionState): boolean {
  const { limits, used } = state.budget
  return used.steps > limits.maximumSteps
    || used.modelCalls > limits.maximumModelCalls
    || used.toolCalls > limits.maximumToolCalls
    || used.tokens > limits.maximumTokens
    || used.elapsedMilliseconds > limits.maximumElapsedMilliseconds
    || used.estimatedCostMicros > limits.maximumEstimatedCostMicros
    || used.revisions > limits.maximumRevisions
}

export const decodeResearchExecutionCheckpoint = Effect.fn(
  'ResearchExecutionCheckpoint.decode',
)(function* (input: unknown) {
  const checkpoint = yield* Schema.decodeUnknown(ResearchExecutionCheckpoint)(
    input,
  ).pipe(Effect.mapError(executionFailure))
  if (exceedsBudget(checkpoint.state)) {
    return yield* new ResearchContractValidationError({
      contract: 'execution',
      reason: 'invalid-budget',
      path: 'state.budget.used',
      message: 'Research execution exceeds its declared budget',
    })
  }
  const encoded = Schema.encodeSync(ResearchExecutionCheckpoint)(checkpoint)
  const serializedBytes = new TextEncoder().encode(
    JSON.stringify(encoded),
  ).byteLength
  if (serializedBytes > MAX_CHECKPOINT_BYTES) {
    return yield* new ResearchContractValidationError({
      contract: 'execution',
      reason: 'invalid-budget',
      path: 'checkpoint',
      message: 'Research execution checkpoint exceeds the encoded size limit',
    })
  }
  if (
    checkpoint.state.status === 'running'
    && checkpoint.state.currentNodeId === null
  ) {
    return yield* new ResearchContractValidationError({
      contract: 'execution',
      reason: 'malformed',
      path: 'state.currentNodeId',
      message: 'Running research execution requires a current node',
    })
  }
  return checkpoint
})
