import { Effect, Schema } from 'effect'
import {
  EvidenceInsufficientError,
  ProjectId,
  ResearchAnswer,
  ResearchCitationValidationError,
  ResearchRunId,
  SourceVersionId,
  TextEvidence,
  WorkspaceId,
} from '@struct/domain'

export const WalkingSkeletonResearchInput = Schema.Struct({
  runId: ResearchRunId,
  workspaceId: WorkspaceId,
  projectId: ProjectId,
  sourceVersionIds: Schema.Array(SourceVersionId).pipe(Schema.minItems(1)),
  question: Schema.String.pipe(Schema.minLength(1)),
})
export type WalkingSkeletonResearchInput = Schema.Schema.Type<typeof WalkingSkeletonResearchInput>

export const WalkingSkeletonPlan = Schema.Struct({
  query: Schema.String,
  maxSteps: Schema.Literal(5),
  maxToolCalls: Schema.Literal(1),
  maxModelCalls: Schema.Literal(1),
})
export type WalkingSkeletonPlan = Schema.Schema.Type<typeof WalkingSkeletonPlan>

export const WalkingSkeletonWorkflowResult = Schema.Struct({
  plan: WalkingSkeletonPlan,
  evidence: Schema.Array(TextEvidence).pipe(Schema.minItems(1)),
  answer: ResearchAnswer,
})
export type WalkingSkeletonWorkflowResult = Schema.Schema.Type<typeof WalkingSkeletonWorkflowResult>

export const makeWalkingSkeletonPlan = (
  input: WalkingSkeletonResearchInput,
): WalkingSkeletonPlan => ({
  query: input.question.trim(),
  maxSteps: 5,
  maxToolCalls: 1,
  maxModelCalls: 1,
})

export const requireEvidence = (
  question: string,
  evidence: ReadonlyArray<typeof TextEvidence.Type>,
): Effect.Effect<ReadonlyArray<typeof TextEvidence.Type>, EvidenceInsufficientError, never> =>
  evidence.length === 0
    ? Effect.fail(
        new EvidenceInsufficientError({
          question,
          message: 'No relevant source text was found',
        }),
      )
    : Effect.succeed(evidence)

export const validateAnswerCitations = (
  answer: typeof ResearchAnswer.Type,
  evidence: ReadonlyArray<typeof TextEvidence.Type>,
): Effect.Effect<typeof ResearchAnswer.Type, ResearchCitationValidationError, never> => {
  const valid = new Set(evidence.map((item) => `${item.sourceVersionId}:${item.locator}`))
  const invalid = answer.citations.find(
    (citation) => !valid.has(`${citation.sourceVersionId}:${citation.locator}`),
  )
  if (invalid) {
    return Effect.fail(
      new ResearchCitationValidationError({
        sourceVersionId: invalid.sourceVersionId,
        locator: invalid.locator,
        message: 'Answer citation does not match retrieved evidence',
      }),
    )
  }
  if (answer.citations.length === 0) {
    const first = evidence[0]
    return Effect.fail(
      new ResearchCitationValidationError({
        sourceVersionId: first.sourceVersionId,
        locator: first.locator,
        message: 'Grounded answers require at least one citation',
      }),
    )
  }
  return Effect.succeed(answer)
}
