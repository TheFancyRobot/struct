import {
  ResearchContractValidationError,
} from '@struct/domain'
import type * as Domain from '@struct/domain'
import { Effect } from 'effect'
import type { ResearchBranchKind } from './question-decomposition.js'

export interface ResearchNodeRoute {
  readonly branch: ResearchBranchKind | 'synthesis'
  readonly nodeId: Domain.ResearchPlanNode['id']
  readonly dependencies: Domain.ResearchPlanNode['dependencies']
}

const branchNodeKind: Readonly<
  Record<ResearchBranchKind, Domain.ResearchPlanNode['kind']>
> = {
  document: 'document-retrieval',
  dataset: 'dataset-query',
  recursive: 'recursive-analysis',
}
const researchBranchKinds = ['document', 'dataset', 'recursive'] as const

function routeFailure(
  reason: typeof ResearchContractValidationError.Type['reason'],
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

function reachesNodeKind(
  nodes: ReadonlyMap<Domain.ResearchPlanNode['id'], Domain.ResearchPlanNode>,
  node: Domain.ResearchPlanNode,
  kind: Domain.ResearchPlanNode['kind'],
  visited: ReadonlySet<Domain.ResearchPlanNode['id']>,
): boolean {
  if (node.kind === kind) return true
  return node.dependencies.some((dependencyId) => {
    if (visited.has(dependencyId)) return false
    const dependency = nodes.get(dependencyId)
    if (dependency === undefined) return false
    return reachesNodeKind(
      nodes,
      dependency,
      kind,
      new Set([...visited, dependencyId]),
    )
  })
}

/**
 * Maps validated plan nodes to deterministic execution branches and ensures
 * hybrid synthesis cannot run before all selected evidence paths complete.
 */
export const routeResearchPlan = Effect.fn('ResearchPlan.routeSources')(
  function* (
    plan: Domain.ResearchPlan,
    requestedBranches: ReadonlyArray<ResearchBranchKind>,
  ) {
    const branches = [...new Set(requestedBranches)].sort()
    const nodes = new Map(plan.nodes.map((node) => [node.id, node] as const))
    for (const branch of researchBranchKinds) {
      if (
        !branches.includes(branch)
        && plan.nodes.some((node) => node.kind === branchNodeKind[branch])
      ) {
        return yield* routeFailure(
          'unsupported-tool',
          'nodes',
          `The research plan includes an unselected ${branch} route`,
        )
      }
    }
    for (const branch of branches) {
      const branchNodes = plan.nodes.filter(
        (node) => node.kind === branchNodeKind[branch],
      )
      if (branchNodes.length === 0) {
        return yield* routeFailure(
          'missing-reference',
          'nodes',
          `The research plan is missing its required ${branch} route`,
        )
      }
      const branchEvidence = new Set(
        plan.evidenceRequirements
          .filter((requirement) => requirement.kind === branch)
          .map((requirement) => requirement.id),
      )
      if (
        branchEvidence.size === 0
        || !branchNodes.some((node) =>
          node.evidenceRefs.some((id) => branchEvidence.has(id)))
      ) {
        return yield* routeFailure(
          'missing-reference',
          'evidenceRequirements',
          `The ${branch} route requires matching plan-level evidence`,
        )
      }
    }

    if (branches.length > 1) {
      const synthesisNodes = plan.nodes.filter(
        (node) => node.kind === 'answer-synthesis',
      )
      if (synthesisNodes.length !== 1) {
        return yield* routeFailure(
          'malformed',
          'nodes',
          'A mixed research plan requires exactly one answer-synthesis node',
        )
      }
      const [synthesis] = synthesisNodes
      if (synthesis === undefined) {
        return yield* routeFailure(
          'malformed',
          'nodes',
          'A mixed research plan requires exactly one answer-synthesis node',
        )
      }
      for (const branch of branches) {
        if (!reachesNodeKind(
          nodes,
          synthesis,
          branchNodeKind[branch],
          new Set([synthesis.id]),
        )) {
          return yield* routeFailure(
            'missing-dependency',
            `nodes.${synthesis.id}.dependencies`,
            `Answer synthesis must wait for the ${branch} evidence route`,
          )
        }
      }
      const requiredEvidence = new Set(
        plan.evidenceRequirements.map((requirement) => requirement.id),
      )
      if (
        synthesis.evidenceRefs.length !== requiredEvidence.size
        || synthesis.evidenceRefs.some((id) => !requiredEvidence.has(id))
      ) {
        return yield* routeFailure(
          'missing-reference',
          `nodes.${synthesis.id}.evidenceRefs`,
          'Answer synthesis must retain every plan-level evidence requirement',
        )
      }
    }

    return plan.nodes.flatMap((node): ReadonlyArray<ResearchNodeRoute> => {
      const branch = branches.find(
        (candidate) => node.kind === branchNodeKind[candidate],
      )
      if (branch !== undefined) {
        return [{
          branch,
          nodeId: node.id,
          dependencies: node.dependencies,
        }]
      }
      if (node.kind === 'answer-synthesis') {
        return [{
          branch: 'synthesis',
          nodeId: node.id,
          dependencies: node.dependencies,
        }]
      }
      return []
    })
  },
)
