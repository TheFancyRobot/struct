import {
  decodeResearchPlan,
  ProjectId,
  QuestionClassification,
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
import { decomposeQuestionRoutes } from './question-decomposition.js'
import { routeResearchPlan } from './route-sources.js'

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
  classification: QuestionClassification,
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

function datasetScopeKey(
  scope: Extract<
    Domain.ResearchPlan['sourceScopes'][number],
    { readonly kind: 'dataset' }
  >,
): string {
  return `${scope.datasetId}:${scope.datasetSnapshotId}`
}

function allowedSourceReferences(
  scopes: ReadonlyArray<Domain.ResearchPlan['sourceScopes'][number]>,
): {
  readonly sourceVersions: ReadonlySet<string>
  readonly documentSourceVersions: ReadonlySet<string>
  readonly datasetSnapshots: ReadonlySet<string>
  readonly recursiveSourceSets: ReadonlyArray<ReadonlySet<string>>
} {
  const sourceVersions = new Set<string>()
  const documentSourceVersions = new Set<string>()
  const datasetSnapshots = new Set<string>()
  const recursiveSourceSets: Array<ReadonlySet<string>> = []
  for (const scope of scopes) {
    if (scope.kind === 'document') {
      sourceVersions.add(scope.sourceVersionId)
      documentSourceVersions.add(scope.sourceVersionId)
    } else if (scope.kind === 'dataset') {
      datasetSnapshots.add(`${scope.datasetId}:${scope.datasetSnapshotId}`)
      for (const sourceVersionId of scope.sourceVersionIds) {
        sourceVersions.add(sourceVersionId)
      }
    } else {
      const recursiveSources = new Set<string>(scope.sourceVersionIds)
      recursiveSourceSets.push(recursiveSources)
      for (const sourceVersionId of scope.sourceVersionIds) {
        sourceVersions.add(sourceVersionId)
      }
    }
  }
  return {
    sourceVersions,
    documentSourceVersions,
    datasetSnapshots,
    recursiveSourceSets,
  }
}

const compatibleCapability: Readonly<
  Record<Domain.ResearchToolId, Domain.ResearchToolCapability>
> = {
  'hybrid-retrieval': 'document:retrieve',
  'dataset-query': 'dataset:query',
  'directory-navigation': 'directory:navigate',
  'recursive-analysis': 'recursive:analyze',
  'citation-validation': 'citation:validate',
}

const nodeTool: Partial<
  Record<Domain.ResearchPlanNode['kind'], Domain.ResearchToolId>
> = {
  'document-retrieval': 'hybrid-retrieval',
  'dataset-query': 'dataset-query',
  'directory-navigation': 'directory-navigation',
  'recursive-analysis': 'recursive-analysis',
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
  const allowedDocuments = new Set(
    input.sourceScopes.flatMap((scope) =>
      scope.kind === 'document' ? [scope.sourceVersionId] : []),
  )
  const allowedDatasets = new Map<string, Set<string>>()
  const allowedRecursiveScopes: Array<ReadonlySet<string>> = []
  for (const scope of input.sourceScopes) {
    if (scope.kind === 'dataset') {
      const key = datasetScopeKey(scope)
      const sourceVersions = allowedDatasets.get(key) ?? new Set<string>()
      for (const sourceVersionId of scope.sourceVersionIds) {
        sourceVersions.add(sourceVersionId)
      }
      allowedDatasets.set(key, sourceVersions)
    } else if (scope.kind === 'recursive') {
      allowedRecursiveScopes.push(new Set(scope.sourceVersionIds))
    }
  }
  for (const scope of plan.sourceScopes) {
    const authorized = scope.kind === 'document'
      ? allowedDocuments.has(scope.sourceVersionId)
      : scope.kind === 'dataset'
        ? (() => {
          const sourceVersions = allowedDatasets.get(datasetScopeKey(scope))
          return sourceVersions !== undefined
            && scope.sourceVersionIds.every((sourceVersionId) =>
              sourceVersions.has(sourceVersionId))
        })()
        : allowedRecursiveScopes.some((authorizedSources) =>
          scope.sourceVersionIds.every((sourceVersionId) =>
            authorizedSources.has(sourceVersionId))
        )
    if (!authorized) {
      return failure(
        'missing-reference',
        'sourceScopes',
        'A proposed plan must not widen its authorized source scope',
      )
    }
  }

  const allowed = allowedSourceReferences(plan.sourceScopes)
  for (const node of plan.nodes) {
    const directInputs = node.inputRefs.filter((ref) =>
      ref.kind !== 'node-output')
    if (
      node.kind === 'document-retrieval'
      || node.kind === 'directory-navigation'
    ) {
      if (
        directInputs.length === 0
        || directInputs.some((ref) =>
          ref.kind !== 'source-version'
          || !allowed.documentSourceVersions.has(ref.sourceVersionId))
      ) {
        return failure(
          'missing-reference',
          `nodes.${node.id}.inputRefs`,
          'A document-retrieval node requires authorized document source-version inputs',
        )
      }
      if (
        node.kind === 'directory-navigation'
        && node.toolInput?.kind !== 'directory-navigation'
      ) {
        return failure(
          'malformed',
          `nodes.${node.id}.toolInput`,
          'A directory-navigation node requires a typed navigation spec',
        )
      }
    } else if (node.kind === 'dataset-query') {
      if (
        directInputs.length === 0
        || directInputs.some((ref) =>
          ref.kind !== 'dataset-snapshot'
          || !allowed.datasetSnapshots.has(
            `${ref.datasetId}:${ref.datasetSnapshotId}`,
          ))
      ) {
        return failure(
          'missing-reference',
          `nodes.${node.id}.inputRefs`,
          'A dataset-query node requires authorized dataset-snapshot inputs',
        )
      }
      if (
        node.toolInput?.kind !== 'dataset-query'
        || !allowed.datasetSnapshots.has(
          `${node.toolInput.snapshot.datasetId}:${node.toolInput.snapshot.datasetSnapshotId}`,
        )
        || (
          node.toolInput.operation === 'inspect'
          && node.toolInput.columns.length === 0
        )
      ) {
        return failure(
          'missing-reference',
          `nodes.${node.id}.toolInput`,
          'A dataset-query node requires a typed query spec inside its authorized immutable snapshot scope',
        )
      }
    } else if (node.kind === 'recursive-analysis') {
      const [recursiveInput, ...additionalRecursiveInputs] = directInputs.filter(
        (ref) => ref.kind === 'recursive-source-set',
      )
      if (
        directInputs.length !== 1
        || recursiveInput === undefined
        || additionalRecursiveInputs.length > 0
        || !allowed.recursiveSourceSets.some((sourceSet) =>
          recursiveInput.sourceVersionIds.every((sourceVersionId) =>
            sourceSet.has(sourceVersionId))
        )
        || node.toolInput?.kind !== 'recursive-analysis'
      ) {
        return failure(
          'missing-reference',
          `nodes.${node.id}`,
          'A recursive-analysis node requires one authorized immutable recursive source set',
        )
      }
    }
    for (const ref of node.inputRefs) {
      const authorized = ref.kind === 'source-version'
        ? (
            node.kind === 'document-retrieval'
              || node.kind === 'directory-navigation'
              ? allowed.documentSourceVersions.has(ref.sourceVersionId)
              : allowed.sourceVersions.has(ref.sourceVersionId)
          )
        : ref.kind === 'dataset-snapshot'
          ? allowed.datasetSnapshots.has(
            `${ref.datasetId}:${ref.datasetSnapshotId}`,
          )
          : ref.kind === 'recursive-source-set'
            ? allowed.recursiveSourceSets.some((sourceSet) =>
              ref.sourceVersionIds.every((sourceVersionId) =>
                sourceSet.has(sourceVersionId))
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
      : requirement.kind === 'dataset'
        ? allowed.datasetSnapshots.has(
          `${requirement.datasetId}:${requirement.datasetSnapshotId}`,
        )
        : allowed.recursiveSourceSets.some((sourceSet) =>
          requirement.sourceVersionIds.every((sourceVersionId) =>
            sourceSet.has(sourceVersionId))
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

function validateClassification(
  input: ResearchPlanningInput,
  plan: Domain.ResearchPlan,
): ResearchContractValidationError | undefined {
  if (!input.classification.requiresExactComputation) return undefined

  const hasAuthorizedDataset = input.sourceScopes.some(
    (scope) => scope.kind === 'dataset',
  )
  const hasProposedDataset = plan.sourceScopes.some(
    (scope) => scope.kind === 'dataset',
  )
  if (!hasAuthorizedDataset || !hasProposedDataset) {
    return failure(
      'missing-reference',
      'sourceScopes',
      'Exact computation requires an authorized dataset scope in the proposed plan',
    )
  }
  const nodes = new Map(plan.nodes.map((node) => [node.id, node] as const))
  const reachesDatasetQuery = (
    node: Domain.ResearchPlanNode,
    visited: Set<string>,
  ): boolean =>
    node.inputRefs.some((ref) => {
      if (ref.kind !== 'node-output' || visited.has(ref.nodeId)) return false
      const dependency = nodes.get(ref.nodeId)
      if (dependency === undefined) return false
      if (dependency.kind === 'dataset-query') return true
      visited.add(ref.nodeId)
      return reachesDatasetQuery(dependency, visited)
    })
  const hasDatasetQueryPath = plan.nodes.some(
    (node) =>
      node.kind === 'answer-synthesis'
      && reachesDatasetQuery(node, new Set([node.id])),
  )
  if (!hasDatasetQueryPath) {
    return failure(
      'unsupported-tool',
      'nodes',
      'Exact computation requires validated dataset-query output on a path to answer synthesis',
    )
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
      validateClassification(input, plan),
      validatePolicy(input, plan),
      validateBudget(input, plan),
    ]) {
      if (error !== undefined) return yield* error
    }
    const normalized = yield* normalizeResearchPlan(plan)
    const branches = yield* decomposeQuestionRoutes(
      input.classification,
      input.sourceScopes,
    )
    yield* routeResearchPlan(normalized, branches)
    return normalized
  },
)
