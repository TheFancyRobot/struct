import {
  EvidenceContradictionError,
  EvidenceInsufficientError,
  ProjectId,
  ResearchAnswer,
  ResearchCitation,
  ResearchCitationValidationError,
  ResearchRunId,
  ResearchWorkflowError,
  SourceVersionId,
  WorkspaceId,
} from '@struct/domain'
// eslint-disable-next-line no-unused-vars -- Type-only namespace is consumed by TypeScript.
import type * as Domain from '@struct/domain'
import {
  DocumentResearchContext,
  EmbeddingVector,
} from '@struct/retrieval'
import { Effect, Schema } from 'effect'

const NonBlankString = Schema.String.pipe(
  Schema.filter((value) => value.trim().length > 0 || 'must not be blank'),
)

export const DocumentResearchInput = Schema.Struct({
  runId: ResearchRunId,
  workspaceId: WorkspaceId,
  projectId: ProjectId,
  sourceVersionIds: Schema.Array(SourceVersionId).pipe(Schema.minItems(1)),
  question: NonBlankString,
  chunkingVersion: NonBlankString,
  embeddingModel: NonBlankString,
  embedding: EmbeddingVector,
  evidenceLimit: Schema.Number.pipe(Schema.int(), Schema.between(1, 20)),
})
export type DocumentResearchInput =
  Schema.Schema.Type<typeof DocumentResearchInput>

export const DocumentResearchPlan = Schema.Struct({
  strategy: Schema.Literal('hybrid-document'),
  queries: Schema.Array(NonBlankString).pipe(
    Schema.minItems(1),
    Schema.maxItems(2),
  ),
  evidenceRequirement: NonBlankString,
  maxSteps: Schema.Literal(7),
  maxToolCalls: Schema.Literal(1),
  maxModelCalls: Schema.Literal(3),
  maxRetries: Schema.Literal(0),
})
export type DocumentResearchPlan =
  Schema.Schema.Type<typeof DocumentResearchPlan>

export const EvidenceConflict = Schema.Struct({
  summary: NonBlankString,
  citations: Schema.Array(ResearchCitation).pipe(
    Schema.minItems(2),
    Schema.maxItems(8),
  ),
})
export type EvidenceConflict = Schema.Schema.Type<typeof EvidenceConflict>

export const EvidenceAssessment = Schema.Struct({
  status: Schema.Literal('sufficient', 'insufficient', 'contradictory'),
  summary: NonBlankString,
  citedEvidence: Schema.Array(ResearchCitation).pipe(Schema.maxItems(20)),
  limitations: Schema.Array(NonBlankString).pipe(Schema.maxItems(8)),
  contradictions: Schema.Array(EvidenceConflict).pipe(Schema.maxItems(8)),
})
export type EvidenceAssessment =
  Schema.Schema.Type<typeof EvidenceAssessment>

export const GroundedDocumentAnswer = Schema.Struct({
  ...ResearchAnswer.fields,
  citations: Schema.Array(ResearchCitation).pipe(Schema.minItems(1)),
})
export type GroundedDocumentAnswer =
  Schema.Schema.Type<typeof GroundedDocumentAnswer>

export const DocumentResearchWorkflowResult = Schema.Struct({
  plan: DocumentResearchPlan,
  context: DocumentResearchContext,
  assessment: EvidenceAssessment,
  answer: GroundedDocumentAnswer,
})
export type DocumentResearchWorkflowResult =
  Schema.Schema.Type<typeof DocumentResearchWorkflowResult>

function citationKey(citation: typeof ResearchCitation.Type): string {
  return `${citation.sourceVersionId}:${citation.locator}`
}

export const requireSufficientEvidence = Effect.fn(
  'EvidenceSufficiency.require',
)(function* (
  question: string,
  context: DocumentResearchContext,
  assessment: EvidenceAssessment,
) {
  const decoded = yield* Schema.decodeUnknown(EvidenceAssessment)(
    assessment,
  ).pipe(
    Effect.mapError(() =>
      new ResearchWorkflowError({
        stage: 'evidence-assessment',
        message: 'Evidence assessment did not match its typed contract',
      }),
    ),
  )
  const validCitations = new Set(
    context.evidence.map((item) =>
      `${item.sourceVersionId}:${item.citationLocator}`),
  )
  const allCitations = [
    ...decoded.citedEvidence,
    ...decoded.contradictions.flatMap((conflict) => conflict.citations),
  ]
  if (allCitations.some((citation) => !validCitations.has(citationKey(citation)))) {
    return yield* new ResearchWorkflowError({
      stage: 'evidence-assessment',
      message: 'Evidence assessment referenced evidence outside the retrieved context',
    })
  }
  if (
    decoded.status === 'contradictory'
    && decoded.contradictions.length === 0
  ) {
    return yield* new ResearchWorkflowError({
      stage: 'evidence-assessment',
      message: 'Contradictory evidence must include the surfaced conflicts',
    })
  }
  if (
    decoded.status === 'contradictory'
    || decoded.contradictions.length > 0
  ) {
    return yield* new EvidenceContradictionError({
      question,
      conflictCount: Math.max(1, decoded.contradictions.length),
      message: 'Retrieved evidence contains unresolved contradictions',
    })
  }
  if (
    decoded.status !== 'sufficient'
    || decoded.citedEvidence.length === 0
  ) {
    return yield* new EvidenceInsufficientError({
      question,
      message: 'Retrieved evidence is not sufficient for a grounded answer',
    })
  }
  return decoded
})

export const validateDocumentAnswerCitations = Effect.fn(
  'EvidenceSufficiency.validateAnswerCitations',
)(function* (
  answer: typeof Domain.ResearchAnswer.Type,
  context: DocumentResearchContext,
  assessment: EvidenceAssessment,
) {
  const contextCitations = new Set(
    context.evidence.map((item) =>
      `${item.sourceVersionId}:${item.citationLocator}`),
  )
  const validCitations = new Set(
    assessment.citedEvidence
      .map(citationKey)
      .filter((key) => contextCitations.has(key)),
  )
  const invalid = answer.citations.find(
    (citation) => !validCitations.has(citationKey(citation)),
  )
  if (invalid !== undefined) {
    return yield* new ResearchCitationValidationError({
      sourceVersionId: invalid.sourceVersionId,
      locator: invalid.locator,
      message: 'Answer citation was not approved by the evidence assessment',
    })
  }
  if (answer.citations.length === 0) {
    const first = context.evidence[0]
    if (first === undefined) {
      return yield* new EvidenceInsufficientError({
        question: 'document research question',
        message: 'No document evidence was available for citation validation',
      })
    }
    return yield* new ResearchCitationValidationError({
      sourceVersionId: first.sourceVersionId,
      locator: first.citationLocator,
      message: 'Grounded document answers require at least one citation',
    })
  }
  return answer
})
