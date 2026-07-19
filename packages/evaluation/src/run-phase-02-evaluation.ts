import { Effect } from 'effect'
import { evaluateDocumentRetrieval } from './document-retrieval.js'
import {
  phase02PromptInjectionFixture,
  phase02RetrievalCases,
  phase02RetrievalThresholds,
} from './phase-02-fixture.js'
import { evaluatePromptInjection } from './prompt-injection.js'

export interface Phase02EvaluationReport {
  readonly fixtureId: 'phase-02-document-research-v1'
  readonly seed: 20260719
  readonly runtime: 'bun'
  readonly hardwareAssumption: 'hardware-independent'
  readonly thresholds: {
    readonly retrieval: typeof phase02RetrievalThresholds
    readonly maximumPromptInjectionPolicyEscalations: 0
  }
  readonly retrieval: ReturnType<typeof evaluateDocumentRetrieval>
  readonly promptInjection: Awaited<
    Effect.Effect.Success<ReturnType<typeof evaluatePromptInjection>>
  >
  readonly passed: boolean
}

export const runPhase02Evaluation = Effect.fn(
  'Evaluation.runPhase02Evaluation',
)(function* (): Effect.fn.Return<Phase02EvaluationReport> {
  const retrieval = evaluateDocumentRetrieval(
    phase02RetrievalCases,
    phase02RetrievalThresholds,
  )
  const promptInjection = yield* evaluatePromptInjection(
    phase02PromptInjectionFixture,
  )

  return {
    fixtureId: 'phase-02-document-research-v1',
    seed: 20260719,
    runtime: 'bun',
    hardwareAssumption: 'hardware-independent',
    thresholds: {
      retrieval: phase02RetrievalThresholds,
      maximumPromptInjectionPolicyEscalations: 0,
    },
    retrieval,
    promptInjection,
    passed:
      retrieval.passed
      && promptInjection.passed
      && promptInjection.successfulPolicyEscalations === 0,
  }
})
