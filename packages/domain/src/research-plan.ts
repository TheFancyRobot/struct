import { Effect, ParseResult, Schema } from 'effect'
import {
  DatasetId,
  DatasetSnapshotId,
  EvidenceRequirementId,
  ProjectId,
  ResearchPlanId,
  ResearchPlanNodeId,
  ResearchRunId,
  SourceVersionId,
  WorkspaceId,
} from './branded-ids.js'
import { ResearchContractValidationError } from './typed-errors.js'

const NonBlankString = Schema.String.pipe(
  Schema.minLength(1),
  Schema.maxLength(2_048),
  Schema.filter((value) => value.trim().length > 0 || 'must not be blank'),
)
const BoundedInteger = Schema.Number.pipe(
  Schema.finite(),
  Schema.int(),
  Schema.nonNegative(),
)

export const ResearchContractVersion = Schema.Literal('1')

export const QuestionClassification = Schema.Struct({
  version: ResearchContractVersion,
  kind: Schema.Literal('document', 'dataset', 'mixed'),
  mode: Schema.Literal('quick', 'deep'),
  requiresExactComputation: Schema.Boolean,
  confidence: Schema.Number.pipe(Schema.finite(), Schema.between(0, 1)),
})
export type QuestionClassification =
  Schema.Schema.Type<typeof QuestionClassification>

export const ResearchSourceScope = Schema.Union(
  Schema.Struct({
    kind: Schema.Literal('document'),
    sourceVersionId: SourceVersionId,
  }),
  Schema.Struct({
    kind: Schema.Literal('dataset'),
    datasetId: DatasetId,
    datasetSnapshotId: DatasetSnapshotId,
    sourceVersionIds: Schema.Array(SourceVersionId).pipe(Schema.minItems(1)),
  }),
)
export type ResearchSourceScope =
  Schema.Schema.Type<typeof ResearchSourceScope>

export const ResearchEvidenceRequirement = Schema.Union(
  Schema.Struct({
    id: EvidenceRequirementId,
    kind: Schema.Literal('document'),
    sourceVersionIds: Schema.Array(SourceVersionId).pipe(Schema.minItems(1)),
    minimumCitations: BoundedInteger.pipe(Schema.positive()),
  }),
  Schema.Struct({
    id: EvidenceRequirementId,
    kind: Schema.Literal('dataset'),
    datasetId: DatasetId,
    datasetSnapshotId: DatasetSnapshotId,
    minimumCitations: BoundedInteger.pipe(Schema.positive()),
  }),
)
export type ResearchEvidenceRequirement =
  Schema.Schema.Type<typeof ResearchEvidenceRequirement>

export const ResearchToolId = Schema.Literal(
  'hybrid-retrieval',
  'dataset-query',
  'directory-navigation',
  'citation-validation',
)
export type ResearchToolId = Schema.Schema.Type<typeof ResearchToolId>

export const ResearchToolCapability = Schema.Literal(
  'document:retrieve',
  'dataset:query',
  'directory:navigate',
  'citation:validate',
)
export type ResearchToolCapability =
  Schema.Schema.Type<typeof ResearchToolCapability>

export const ResearchToolPolicy = Schema.Struct({
  grants: Schema.Array(Schema.Struct({
    toolId: ResearchToolId,
    capability: ResearchToolCapability,
    maximumCalls: BoundedInteger.pipe(
      Schema.positive(),
      Schema.lessThanOrEqualTo(256),
    ),
  })).pipe(Schema.maxItems(4)),
})
export type ResearchToolPolicy = Schema.Schema.Type<typeof ResearchToolPolicy>

export const ResearchPlanInputRef = Schema.Union(
  Schema.Struct({
    kind: Schema.Literal('source-version'),
    sourceVersionId: SourceVersionId,
  }),
  Schema.Struct({
    kind: Schema.Literal('dataset-snapshot'),
    datasetId: DatasetId,
    datasetSnapshotId: DatasetSnapshotId,
  }),
  Schema.Struct({
    kind: Schema.Literal('node-output'),
    nodeId: ResearchPlanNodeId,
  }),
)
export type ResearchPlanInputRef =
  Schema.Schema.Type<typeof ResearchPlanInputRef>

const QueryAlias = Schema.String.pipe(
  Schema.pattern(/^[a-z][a-z0-9_]{0,62}$/),
)
const PositiveInteger = Schema.Number.pipe(Schema.int(), Schema.positive())

export const ResearchDatasetQuerySpec = Schema.Struct({
  kind: Schema.Literal('dataset-query'),
  operation: Schema.Literal('inspect', 'count'),
  snapshot: Schema.Struct({
    alias: QueryAlias,
    datasetId: DatasetId,
    datasetSnapshotId: DatasetSnapshotId,
  }),
  columns: Schema.Array(
    Schema.String.pipe(Schema.pattern(/^[A-Za-z_][A-Za-z0-9_]{0,127}$/)),
  ).pipe(Schema.maxItems(32)),
  rowLimit: PositiveInteger.pipe(Schema.lessThanOrEqualTo(1_000)),
  limits: Schema.Struct({
    maxRows: PositiveInteger,
    maxOutputBytes: PositiveInteger,
    maxMemoryMb: PositiveInteger,
    timeoutMs: PositiveInteger,
  }),
})
export type ResearchDatasetQuerySpec =
  Schema.Schema.Type<typeof ResearchDatasetQuerySpec>

export const ResearchDirectoryNavigationSpec = Schema.Struct({
  kind: Schema.Literal('directory-navigation'),
  query: NonBlankString,
  maximumResults: PositiveInteger.pipe(Schema.lessThanOrEqualTo(80)),
})
export type ResearchDirectoryNavigationSpec =
  Schema.Schema.Type<typeof ResearchDirectoryNavigationSpec>

export const ResearchPlanToolInput = Schema.Union(
  ResearchDatasetQuerySpec,
  ResearchDirectoryNavigationSpec,
)
export type ResearchPlanToolInput =
  Schema.Schema.Type<typeof ResearchPlanToolInput>

export const ResearchPlanNode = Schema.Struct({
  id: ResearchPlanNodeId,
  kind: Schema.Literal(
    'document-retrieval',
    'dataset-query',
    'directory-navigation',
    'evidence-evaluation',
    'answer-synthesis',
    'citation-validation',
  ),
  goal: NonBlankString,
  dependencies: Schema.Array(ResearchPlanNodeId).pipe(Schema.maxItems(64)),
  inputRefs: Schema.Array(ResearchPlanInputRef).pipe(Schema.maxItems(64)),
  evidenceRefs: Schema.Array(EvidenceRequirementId).pipe(Schema.maxItems(64)),
  toolInput: Schema.optional(ResearchPlanToolInput),
})
export type ResearchPlanNode = Schema.Schema.Type<typeof ResearchPlanNode>

export const ResearchBudget = Schema.Struct({
  maximumSteps: BoundedInteger.pipe(Schema.between(1, 64)),
  maximumModelCalls: BoundedInteger.pipe(Schema.lessThanOrEqualTo(64)),
  maximumToolCalls: BoundedInteger.pipe(Schema.lessThanOrEqualTo(256)),
  maximumTokens: BoundedInteger.pipe(Schema.between(1, 2_000_000)),
  maximumElapsedMilliseconds: BoundedInteger.pipe(
    Schema.between(1, 86_400_000),
  ),
  maximumEstimatedCostMicros: BoundedInteger.pipe(
    Schema.lessThanOrEqualTo(1_000_000_000),
  ),
  maximumFanOut: BoundedInteger.pipe(Schema.between(1, 16)),
  maximumRevisions: BoundedInteger.pipe(Schema.lessThanOrEqualTo(8)),
})
export type ResearchBudget = Schema.Schema.Type<typeof ResearchBudget>

export const ResearchPlan = Schema.Struct({
  version: ResearchContractVersion,
  id: ResearchPlanId,
  runId: ResearchRunId,
  workspaceId: WorkspaceId,
  projectId: ProjectId,
  objective: NonBlankString,
  sourceScopes: Schema.Array(ResearchSourceScope).pipe(
    Schema.minItems(1),
    Schema.maxItems(256),
  ),
  nodes: Schema.Array(ResearchPlanNode).pipe(
    Schema.minItems(1),
    Schema.maxItems(64),
  ),
  evidenceRequirements: Schema.Array(ResearchEvidenceRequirement).pipe(
    Schema.maxItems(64),
  ),
  toolPolicy: ResearchToolPolicy,
  budget: ResearchBudget,
})
export type ResearchPlan = Schema.Schema.Type<typeof ResearchPlan>

type ValidationReason =
  typeof ResearchContractValidationError.Type['reason']

function parseFailure(
  contract: 'classification' | 'plan',
  error: ParseResult.ParseError,
): ResearchContractValidationError {
  const issue = ParseResult.ArrayFormatter.formatErrorSync(error)[0]
  const path = issue?.path.map(String).join('.') ?? ''
  const reason: ValidationReason =
    /(^|\.)(id|runId|workspaceId|projectId|sourceVersionIds?|datasetId|datasetSnapshotId|nodeId|dependencies|evidenceRefs)(\.|$)/.test(path)
      ? 'invalid-identity'
      : path.includes('toolId')
        ? 'unsupported-tool'
        : path.includes('capability')
          ? 'unsupported-capability'
          : path.includes('budget')
            ? 'invalid-budget'
            : 'malformed'
  return new ResearchContractValidationError({
    contract,
    reason,
    path,
    message: issue?.message ?? 'Contract validation failed',
  })
}

function graphFailure(plan: ResearchPlan): ResearchContractValidationError | undefined {
  const nodeIds = new Set(plan.nodes.map((node) => node.id))
  if (nodeIds.size !== plan.nodes.length) {
    return new ResearchContractValidationError({
      contract: 'plan',
      reason: 'invalid-identity',
      path: 'nodes.id',
      message: 'Research plan node identities must be unique',
    })
  }
  const evidenceIds = new Set(
    plan.evidenceRequirements.map((requirement) => requirement.id),
  )
  if (evidenceIds.size !== plan.evidenceRequirements.length) {
    return new ResearchContractValidationError({
      contract: 'plan',
      reason: 'invalid-identity',
      path: 'evidenceRequirements.id',
      message: 'Research evidence requirement identities must be unique',
    })
  }
  for (const node of plan.nodes) {
    const declaredDependencies = new Set(node.dependencies)
    if (node.dependencies.some((dependency) => !nodeIds.has(dependency))) {
      return new ResearchContractValidationError({
        contract: 'plan',
        reason: 'missing-dependency',
        path: `nodes.${node.id}.dependencies`,
        message: 'Research plan node references a missing dependency',
      })
    }
    if (
      node.inputRefs.some(
        (input) => input.kind === 'node-output' && !nodeIds.has(input.nodeId),
      )
      || node.evidenceRefs.some((evidenceId) => !evidenceIds.has(evidenceId))
    ) {
      return new ResearchContractValidationError({
        contract: 'plan',
        reason: 'missing-reference',
        path: `nodes.${node.id}`,
        message: 'Research plan node references a missing input or evidence requirement',
      })
    }
    if (
      node.inputRefs.some(
        (input) => input.kind === 'node-output'
          && !declaredDependencies.has(input.nodeId),
      )
    ) {
      return new ResearchContractValidationError({
        contract: 'plan',
        reason: 'missing-dependency',
        path: `nodes.${node.id}.dependencies`,
        message: 'Every node-output input must be declared as a dependency',
      })
    }
  }

  const visiting = new Set<ResearchPlanNodeId>()
  const visited = new Set<ResearchPlanNodeId>()
  const dependencies = new Map(
    plan.nodes.map((node) => [node.id, node.dependencies] as const),
  )
  function hasCycle(nodeId: ResearchPlanNodeId): boolean {
    if (visiting.has(nodeId)) return true
    if (visited.has(nodeId)) return false
    visiting.add(nodeId)
    const cyclic = (dependencies.get(nodeId) ?? []).some(hasCycle)
    visiting.delete(nodeId)
    visited.add(nodeId)
    return cyclic
  }
  if (plan.nodes.some((node) => hasCycle(node.id))) {
    return new ResearchContractValidationError({
      contract: 'plan',
      reason: 'cyclic-dependency',
      path: 'nodes.dependencies',
      message: 'Research plan dependencies must be acyclic',
    })
  }

  const fanOut = new Map<ResearchPlanNodeId, number>()
  for (const node of plan.nodes) {
    for (const dependency of node.dependencies) {
      fanOut.set(dependency, (fanOut.get(dependency) ?? 0) + 1)
    }
  }
  if ([...fanOut.values()].some((count) => count > plan.budget.maximumFanOut)) {
    return new ResearchContractValidationError({
      contract: 'plan',
      reason: 'fan-out-exceeded',
      path: 'nodes.dependencies',
      message: 'Research plan fan-out exceeds its declared budget',
    })
  }
  if (plan.nodes.length > plan.budget.maximumSteps) {
    return new ResearchContractValidationError({
      contract: 'plan',
      reason: 'invalid-budget',
      path: 'budget.maximumSteps',
      message: 'Research plan contains more nodes than its step budget allows',
    })
  }
  return undefined
}

export const decodeQuestionClassification = Effect.fn(
  'QuestionClassification.decode',
)(function* (input: unknown) {
  return yield* Schema.decodeUnknown(QuestionClassification)(input).pipe(
    Effect.mapError((error) => parseFailure('classification', error)),
  )
})

export const decodeResearchPlan = Effect.fn(
  'ResearchPlan.decode',
)(function* (input: unknown) {
  const plan = yield* Schema.decodeUnknown(ResearchPlan)(input).pipe(
    Effect.mapError((error) => parseFailure('plan', error)),
  )
  const error = graphFailure(plan)
  if (error !== undefined) return yield* error
  return plan
})
