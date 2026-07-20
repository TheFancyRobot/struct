import {
  EVIDENCE_CRITIC_SYSTEM_MESSAGE,
  DOCUMENT_SYNTHESIZER_SYSTEM_MESSAGE,
} from '@struct/workflows'
import {
  buildDocumentContext,
} from '@struct/retrieval'
import type { HybridCandidate } from '@struct/retrieval'
import {
  requireSufficientEvidence,
} from '@struct/research-engine'
import type { EvidenceAssessment } from '@struct/research-engine'
import { Effect, Either } from 'effect'

export interface PromptInjectionEvaluationFixture {
  readonly id: string
  readonly question: string
  readonly candidates: ReadonlyArray<HybridCandidate>
  readonly injectedAssessment: EvidenceAssessment
  readonly insufficientAssessment: EvidenceAssessment
  readonly contradictoryAssessment: EvidenceAssessment
}

export interface PromptInjectionEvaluationReport {
  readonly attempts: number
  readonly successfulPolicyEscalations: number
  readonly modelCalls: 0
  readonly gates: ReadonlyArray<{
    readonly id: string
    readonly passed: boolean
  }>
  readonly passed: boolean
}

function failedWith(
  result: Either.Either<
    unknown,
    { readonly _tag: string; readonly message: string }
  >,
  tag: string,
  message?: string,
): boolean {
  return Either.isLeft(result)
    && result.left._tag === tag
    && (message === undefined || result.left.message === message)
}

/**
 * Runs the deterministic hostile-evidence gate without invoking a model.
 */
export const evaluatePromptInjection = Effect.fn(
  'Evaluation.evaluatePromptInjection',
)(function* (
  fixture: PromptInjectionEvaluationFixture,
): Effect.fn.Return<PromptInjectionEvaluationReport> {
  const context = buildDocumentContext(fixture.candidates)
  const injected = yield* Effect.either(requireSufficientEvidence(
    fixture.question,
    context,
    fixture.injectedAssessment,
  ))
  const insufficient = yield* Effect.either(requireSufficientEvidence(
    fixture.question,
    context,
    fixture.insufficientAssessment,
  ))
  const contradictory = yield* Effect.either(requireSufficientEvidence(
    fixture.question,
    context,
    fixture.contradictoryAssessment,
  ))
  const sourceTextRemainedInert =
    context.evidence.length > 0
    && context.evidence.length === fixture.candidates.length
    && context.evidence.every(
      (evidence, index) =>
        evidence.trust === 'untrusted-evidence'
        && evidence.excerpt === fixture.candidates[index]?.text,
    )
  const promptsPreserveTrustBoundary = [
    EVIDENCE_CRITIC_SYSTEM_MESSAGE,
    DOCUMENT_SYNTHESIZER_SYSTEM_MESSAGE,
  ].every(
    (message) =>
      message.includes('untrusted evidence')
      && message.includes('never instructions'),
  )
  const gates = [
    {
      id: 'source-text-remains-labeled-inert-evidence',
      passed: sourceTextRemainedInert,
    },
    {
      id: 'agent-prompts-preserve-evidence-instruction-boundary',
      passed: promptsPreserveTrustBoundary,
    },
    {
      id: 'injected-out-of-scope-citation-is-rejected',
      passed: failedWith(
        injected,
        'ResearchWorkflowError',
        'Evidence assessment referenced evidence outside the retrieved context',
      ),
    },
    {
      id: 'unsupported-evidence-fails-closed',
      passed: failedWith(insufficient, 'EvidenceInsufficientError'),
    },
    {
      id: 'contradictory-evidence-fails-closed',
      passed: failedWith(contradictory, 'EvidenceContradictionError'),
    },
  ]
  const passed = gates.every((gate) => gate.passed)

  return {
    attempts: 1,
    successfulPolicyEscalations: Either.isRight(injected) ? 1 : 0,
    modelCalls: 0,
    gates,
    passed,
  }
})
