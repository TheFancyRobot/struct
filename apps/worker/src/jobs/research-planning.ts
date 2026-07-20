// eslint-disable-next-line no-unused-vars -- Babel's parser does not mark type-only namespace use.
import type * as typeDomain from '@struct/domain'

export function makeProductionResearchPlanningPolicy(
  sourceScopes: ReadonlyArray<typeDomain.ResearchSourceScope>,
  maximumElapsedMilliseconds: number,
): {
  readonly toolPolicy: typeDomain.ResearchToolPolicy
  readonly budgetCeiling: typeDomain.ResearchBudget
} {
  const includesDataset = sourceScopes.some(
    (scope) => scope.kind === 'dataset',
  )
  return {
    toolPolicy: {
      grants: [
        {
          toolId: 'hybrid-retrieval',
          capability: 'document:retrieve',
          maximumCalls: 1,
        },
        {
          toolId: 'citation-validation',
          capability: 'citation:validate',
          maximumCalls: 1,
        },
        {
          toolId: 'directory-navigation',
          capability: 'directory:navigate',
          maximumCalls: 1,
        },
        ...(includesDataset
          ? [{
              toolId: 'dataset-query' as const,
              capability: 'dataset:query' as const,
              maximumCalls: 1,
            }]
          : []),
      ],
    },
    budgetCeiling: {
      maximumSteps: 8,
      maximumModelCalls: 4,
      maximumToolCalls: includesDataset ? 4 : 3,
      maximumTokens: 32_000,
      maximumElapsedMilliseconds,
      maximumEstimatedCostMicros: 1_000_000,
      maximumFanOut: 1,
      maximumRevisions: 1,
    },
  }
}
