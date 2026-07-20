import {
  ResearchContractValidationError,
} from '@struct/domain'
import type * as Domain from '@struct/domain'
import { Effect } from 'effect'

export type ResearchBranchKind = Domain.ResearchSourceScope['kind']

function incompatibleClassification(
  message: string,
): ResearchContractValidationError {
  return new ResearchContractValidationError({
    contract: 'classification',
    reason: 'missing-reference',
    path: 'sourceScopes',
    message,
  })
}

/**
 * Resolves the evidence branches a classifier may request without granting it
 * any authority beyond the caller-owned immutable source scopes.
 */
export const decomposeQuestionRoutes = Effect.fn(
  'ResearchQuestion.decomposeRoutes',
)(function* (
  classification: Domain.QuestionClassification,
  sourceScopes: ReadonlyArray<Domain.ResearchSourceScope>,
) {
  const available = new Set(sourceScopes.map((scope) => scope.kind))
  for (const route of classification.routes) {
    if (!available.has(route)) {
      return yield* incompatibleClassification(
        `The ${route} classification route has no matching authorized source scope`,
      )
    }
  }
  return [...classification.routes].sort()
})
