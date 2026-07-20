// eslint-disable-next-line no-unused-vars -- Type-only namespace is consumed by TypeScript.
import type * as Domain from '@struct/domain'
import { Effect } from 'effect'

function compareString(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function scopeKey(scope: Domain.ResearchPlan['sourceScopes'][number]): string {
  return scope.kind === 'document'
    ? `document:${scope.sourceVersionId}`
    : `dataset:${scope.datasetId}:${scope.datasetSnapshotId}:${[...scope.sourceVersionIds].sort().join(',')}`
}

function inputRefKey(
  input: Domain.ResearchPlan['nodes'][number]['inputRefs'][number],
): string {
  switch (input.kind) {
    case 'source-version':
      return `source-version:${input.sourceVersionId}`
    case 'dataset-snapshot':
      return `dataset-snapshot:${input.datasetId}:${input.datasetSnapshotId}`
    case 'node-output':
      return `node-output:${input.nodeId}`
  }
}

/**
 * Produces one stable representation after validation without changing plan
 * authority, dependencies, or budgets.
 */
export const normalizeResearchPlan = Effect.fn('ResearchPlan.normalize')(
  (plan: Domain.ResearchPlan) =>
    Effect.succeed({
      ...plan,
      sourceScopes: [...plan.sourceScopes]
        .map((scope) => scope.kind === 'document'
          ? scope
          : {
              ...scope,
              sourceVersionIds: [...scope.sourceVersionIds].sort(compareString),
            })
        .sort(
          (left, right) => compareString(scopeKey(left), scopeKey(right)),
        ),
      nodes: [...plan.nodes]
        .map((node) => ({
          ...node,
          dependencies: [...node.dependencies].sort(),
          inputRefs: [...node.inputRefs].sort(
            (left, right) =>
              compareString(inputRefKey(left), inputRefKey(right)),
          ),
          evidenceRefs: [...node.evidenceRefs].sort(),
        }))
        .sort((left, right) => compareString(left.id, right.id)),
      evidenceRequirements: [...plan.evidenceRequirements]
        .map((requirement) => requirement.kind === 'dataset'
          ? requirement
          : {
              ...requirement,
              sourceVersionIds: [...requirement.sourceVersionIds].sort(
                compareString,
              ),
            })
        .sort(
          (left, right) => compareString(left.id, right.id),
        ),
      toolPolicy: {
        grants: [...plan.toolPolicy.grants].sort(
          (left, right) =>
            compareString(
              `${left.toolId}:${left.capability}`,
              `${right.toolId}:${right.capability}`,
            ),
        ),
      },
    }),
)
