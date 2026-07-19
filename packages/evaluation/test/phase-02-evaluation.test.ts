import { describe, expect, it } from 'bun:test'
import { Effect } from 'effect'
import {
  evaluateDocumentRetrieval,
  phase02RetrievalCases,
  phase02RetrievalThresholds,
  runPhase02Evaluation,
} from '../src/index.js'

describe('Phase 02 deterministic evaluation', () => {
  it('passes every fixed retrieval, provenance, and injection gate', async () => {
    const report = await Effect.runPromise(runPhase02Evaluation())
    const expected = await Bun.file(
      new URL('../results/phase-02-document-evaluation.json', import.meta.url),
    ).json()

    expect(report).toEqual(expected)
    expect(report.passed).toBe(true)
    expect(report.promptInjection.modelCalls).toBe(0)
  })

  it('fails closed when a foreign source version reaches evaluation', () => {
    const sourceCase = phase02RetrievalCases[0]
    if (sourceCase === undefined) {
      throw new Error('Phase 02 retrieval fixtures are incomplete')
    }
    const leaked = evaluateDocumentRetrieval([{
      ...sourceCase,
      allowedSourceVersionIds: sourceCase.allowedSourceVersionIds.slice(0, 1),
    }], phase02RetrievalThresholds)

    expect(leaked.passed).toBe(false)
    expect(leaked.metrics.scopeLeaks).toBeGreaterThan(0)
  })

  it('fails closed when stale chunking provenance reaches evaluation', () => {
    const sourceCase = phase02RetrievalCases[0]
    if (sourceCase === undefined) {
      throw new Error('Phase 02 retrieval fixtures are incomplete')
    }
    const first = sourceCase.keywordCandidates[0]
    if (first === undefined) {
      throw new Error('Keyword fixture is incomplete')
    }
    const stale = evaluateDocumentRetrieval([{
      ...sourceCase,
      keywordCandidates: [{
        ...first,
        chunkingVersion: 'fragments-v0',
      }],
    }], phase02RetrievalThresholds)

    expect(stale.passed).toBe(false)
    expect(stale.metrics.staleVersionLeaks).toBe(1)
  })

  it('fails closed with finite metrics for empty or malformed fixtures', () => {
    const empty = evaluateDocumentRetrieval(
      [],
      phase02RetrievalThresholds,
    )
    const sourceCase = phase02RetrievalCases[0]
    if (sourceCase === undefined) {
      throw new Error('Phase 02 retrieval fixtures are incomplete')
    }
    const noRelevantEvidence = evaluateDocumentRetrieval([{
      ...sourceCase,
      hybridRelevantChunkIds: [],
    }], phase02RetrievalThresholds)
    const retrievalMiss = evaluateDocumentRetrieval([{
      ...sourceCase,
      keywordCandidates: [],
      vectorCandidates: [],
    }], phase02RetrievalThresholds)
    const invalidThresholds = evaluateDocumentRetrieval(
      [sourceCase],
      {
        ...phase02RetrievalThresholds,
        minimumKeywordRecall: Number.NaN,
        maximumScopeLeaks: -1,
      },
    )

    expect(empty.passed).toBe(false)
    expect(noRelevantEvidence.passed).toBe(false)
    expect(retrievalMiss.passed).toBe(false)
    expect(retrievalMiss.metrics.locatorFidelity).toBe(0)
    expect(Object.values(retrievalMiss.metrics).every(Number.isFinite)).toBe(true)
    expect(invalidThresholds.passed).toBe(false)
    expect(Object.values(empty.metrics).every(Number.isFinite)).toBe(true)
    expect(empty.gates).toEqual([{
      id: 'fixture-validity',
      passed: false,
    }])
  })
})
