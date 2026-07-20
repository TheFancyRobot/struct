import {
  decodeResearchPlan,
  ProjectId,
  ResearchBudget,
  ResearchContractValidationError,
  ResearchPlanId,
  ResearchRunId,
  ResearchSourceScope,
  ResearchToolPolicy,
  WorkspaceId,
} from '@struct/domain'
// eslint-disable-next-line no-unused-vars -- Type-only namespace is consumed by TypeScript.
import type * as Domain from '@struct/domain'
import { Effect, Schema } from 'effect'
import { normalizeResearchPlan } from './normalize-plan.js'

export const ResearchQuestion = Schema.String.pipe(
  Schema.minLength(1),
  Schema.maxLength(2_048),
  Schema.filter((value) => value.trim().length > 0 || 'must not be blank'),
)

export const ResearchPlanningInput = Schema.Struct({
  planId: ResearchPlanId,
  runId: ResearchRunId,
  workspaceId: WorkspaceId,
  projectId: ProjectId,
  question: ResearchQuestion,
  sourceScopes: Schema.Array(ResearchSourceScope).pipe(
    Schema.minItems(1),
    Schema.maxItems(256),
  ),
  toolPolicy: ResearchToolPolicy,
  budgetCeiling: ResearchBudget,
})
export type ResearchPlanningInput =
  Schema.Schema.Type<typeof ResearchPlanningInput>

type PlanFailureReason =
  typeof ResearchContractValidationError.Type['reason']

function failure(
  reason: PlanFailureReason,
  path: string,
  message: string,
): ResearchContractValidationError {
  return new ResearchContractValidationError({
    contract: 'plan',
    reason,
    path,
    message,
  })
}

function sourceScopeKey(
  scope: Domain.ResearchPlan['sourceScopes'][number],
): string {
  return scope.kind === 'document'
    ? `document:${scope.sourceVersionId}`
    : `dataset:${scope.datasetId}:${scope.datasetSnapshotId}:${[...scope.sourceVersionIds].sort().join(',')}`
}

function allowedSourceReferences(
  scopes: ReadonlyArray<Domain.ResearchPlan['sourceScopes'][number]>,
): {
  readonly sourceVersions: ReadonlySet<string>
  readonly documentSourceVersions: ReadonlySet<string>
  readonly datasetSnapshots: ReadonlySet<string>
} {
  const sourceVersions = new Set<string>()
  const documentSourceVersions = new Set<string>()
  const datasetSnapshots = new Set<string>()
  for (const scope of scopes) {
    if (scope.kind === 'document') {
      sourceVersions.add(scope.sourceVersionId)
      documentSourceVersions.add(scope.sourceVersionId)
    } else {
      datasetSnapshots.add(`${scope.datasetId}:${scope.datasetSnapshotId}`)
      for (const sourceVersionId of scope.sourceVersionIds) {
        sourceVersions.add(sourceVersionId)
      }
    }
  }
  return { sourceVersions, documentSourceVersions, datasetSnapshots }
}

const compatibleCapability: Readonly<
  Record<Domain.ResearchToolId, Domain.ResearchToolCapability>
> = {
  'hybrid-retrieval': 'document:retrieve',
  'dataset-query': 'dataset:query',
  'citation-validation': 'citation:validate',
}

const nodeTool: Partial<
  Record<Domain.ResearchPlanNode['kind'], Domain.ResearchToolId>
> = {
  'document-retrieval': 'hybrid-retrieval',
  'dataset-query': 'dataset-query',
  'citation-validation': 'citation-validation',
}

function validateIdentity(
  input: ResearchPlanningInput,
  plan: Domain.ResearchPlan,
): ResearchContractValidationError | undefined {
  const matches =
    plan.id === input.planId
    && plan.runId === input.runId
    && plan.workspaceId === input.workspaceId
    && plan.projectId === input.projectId
  if (!matches) {
    return failure(
      'invalid-identity',
      'id',
      'A proposed plan must preserve its immutable plan, run, workspace, and project identities',
    )
  }
  if (plan.objective !== input.question) {
    return failure(
      'malformed',
      'objective',
      'A proposed plan must preserve the exact research question',
    )
  }
  return undefined
}

function validateScope(
  input: ResearchPlanningInput,
  plan: Domain.ResearchPlan,
): ResearchContractValidationError | undefined {
  const allowedScopes = new Set(input.sourceScopes.map(sourceScopeKey))
  if (plan.sourceScopes.some((scope) => !allowedScopes.has(sourceScopeKey(scope)))) {
    return failure(
      'missing-reference',
      'sourceScopes',
      'A proposed plan must not widen its authorized source scope',
    )
  }

  const allowed = allowedSourceReferences(plan.sourceScopes)
  for (const node of plan.nodes) {
    for (const ref of node.inputRefs) {
      const authorized = ref.kind === 'source-version'
        ? (
            node.kind === 'document-retrieval'
              ? allowed.documentSourceVersions.has(ref.sourceVersionId)
              : allowed.sourceVersions.has(ref.sourceVersionId)
          )
        : ref.kind === 'dataset-snapshot'
          ? allowed.datasetSnapshots.has(
            `${ref.datasetId}:${ref.datasetSnapshotId}`,
          )
          : true
      if (!authorized) {
        return failure(
          'missing-reference',
          `nodes.${node.id}.inputRefs`,
          'A plan node input must remain inside the proposed source scope',
        )
      }
    }
  }

  for (const requirement of plan.evidenceRequirements) {
    const authorized = requirement.kind === 'document'
      ? requirement.sourceVersionIds.every((sourceVersionId) =>
        allowed.documentSourceVersions.has(sourceVersionId))
      : allowed.datasetSnapshots.has(
        `${requirement.datasetId}:${requirement.datasetSnapshotId}`,
      )
    if (!authorized) {
      return failure(
        'missing-reference',
        `evidenceRequirements.${requirement.id}`,
        'An evidence requirement must remain inside the proposed source scope',
      )
    }
  }
  return undefined
}

function validatePolicy(
  input: ResearchPlanningInput,
  plan: Domain.ResearchPlan,
): ResearchContractValidationError | undefined {
  const allowedGrants = new Map(
    input.toolPolicy.grants.map((grant) => [
      `${grant.toolId}:${grant.capability}`,
      grant.maximumCalls,
    ]),
  )
  const proposalKeys = new Set<string>()
  for (const grant of plan.toolPolicy.grants) {
    if (compatibleCapability[grant.toolId] !== grant.capability) {
      return failure(
        'unsupported-capability',
        'toolPolicy.grants.capability',
        `Tool ${grant.toolId} is incompatible with capability ${grant.capability}`,
      )
    }
    const key = `${grant.toolId}:${grant.capability}`
    if (proposalKeys.has(key)) {
      return failure(
        'malformed',
        'toolPolicy.grants',
        'A proposed tool policy must not contain duplicate grants',
      )
    }
    proposalKeys.add(key)
    const maximumCalls = allowedGrants.get(key)
    if (maximumCalls === undefined) {
      return failure(
        'unsupported-capability',
        'toolPolicy.grants',
        'A proposed plan must not add tools or capabilities outside its policy ceiling',
      )
    }
    if (grant.maximumCalls > maximumCalls) {
      return failure(
        'invalid-budget',
        'toolPolicy.grants.maximumCalls',
        'A proposed tool grant must not exceed its call ceiling',
      )
    }
  }

  for (const node of plan.nodes) {
    const requiredTool = nodeTool[node.kind]
    if (
      requiredTool !== undefined
      && !plan.toolPolicy.grants.some((grant) =>
        grant.toolId === requiredTool
        && grant.capability === compatibleCapability[requiredTool])
    ) {
      return failure(
        'unsupported-tool',
        `nodes.${node.id}.kind`,
        `Plan node ${node.kind} requires an authorized ${requiredTool} grant`,
      )
    }
  }
  for (const grant of plan.toolPolicy.grants) {
    const requiredCalls = plan.nodes.filter(
      (node) => nodeTool[node.kind] === grant.toolId,
    ).length
    if (requiredCalls > grant.maximumCalls) {
      return failure(
        'invalid-budget',
        'toolPolicy.grants.maximumCalls',
        `Plan nodes require more ${grant.toolId} calls than the proposed grant allows`,
      )
    }
  }
  return undefined
}

const budgetKeys = [
  'maximumSteps',
  'maximumModelCalls',
  'maximumToolCalls',
  'maximumTokens',
  'maximumElapsedMilliseconds',
  'maximumEstimatedCostMicros',
  'maximumFanOut',
  'maximumRevisions',
] as const

function validateBudget(
  input: ResearchPlanningInput,
  plan: Domain.ResearchPlan,
): ResearchContractValidationError | undefined {
  const expanded = budgetKeys.find(
    (key) => plan.budget[key] > input.budgetCeiling[key],
  )
  if (expanded !== undefined) {
    return failure(
      'invalid-budget',
      `budget.${expanded}`,
      'A proposed plan must not expand its execution budget',
    )
  }

  const grantedCalls = plan.toolPolicy.grants.reduce(
    (total, grant) => total + grant.maximumCalls,
    0,
  )
  if (grantedCalls > plan.budget.maximumToolCalls) {
    return failure(
      'invalid-budget',
      'budget.maximumToolCalls',
      'Tool grants exceed the proposed plan tool-call budget',
    )
  }
  const modelNodes = plan.nodes.filter(
    (node) =>
      node.kind === 'evidence-evaluation'
      || node.kind === 'answer-synthesis',
  ).length
  if (modelNodes > plan.budget.maximumModelCalls) {
    return failure(
      'invalid-budget',
      'budget.maximumModelCalls',
      'Agentic plan nodes exceed the proposed model-call budget',
    )
  }
  return undefined
}

/**
 * Converts an untrusted model proposal into executable state only after every
 * shared contract and caller-owned policy ceiling has been checked.
 */
export const validateResearchPlan = Effect.fn('ResearchPlan.validate')(
  function* (input: ResearchPlanningInput, proposal: unknown) {
    const plan = yield* decodeResearchPlan(proposal)
    for (const error of [
      validateIdentity(input, plan),
      validateScope(input, plan),
      validatePolicy(input, plan),
      validateBudget(input, plan),
    ]) {
      if (error !== undefined) return yield* error
    }
    return yield* normalizeResearchPlan(plan)
  },
)
