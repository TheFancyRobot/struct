import type {
  DocumentChunkId,
  SourceVersionId,
} from '@struct/domain'
import {
  buildDocumentContext,
  encodeDocumentLocator,
  fuseCandidates,
} from '@struct/retrieval'
import type {
  KeywordCandidate,
  VectorCandidate,
} from '@struct/retrieval'

export interface RetrievalEvaluationThresholds {
  readonly minimumKeywordRecall: number
  readonly minimumVectorRecall: number
  readonly minimumHybridRecall: number
  readonly minimumLocatorFidelity: number
  readonly maximumScopeLeaks: number
  readonly maximumStaleVersionLeaks: number
}

export interface RetrievalEvaluationCase {
  readonly id: string
  readonly keywordRelevantChunkIds: ReadonlyArray<DocumentChunkId>
  readonly vectorRelevantChunkIds: ReadonlyArray<DocumentChunkId>
  readonly hybridRelevantChunkIds: ReadonlyArray<DocumentChunkId>
  readonly allowedSourceVersionIds: ReadonlyArray<SourceVersionId>
  readonly chunkingVersion: string
  readonly expectedCitationLocators: Readonly<Record<string, string>>
  readonly keywordCandidates: ReadonlyArray<KeywordCandidate>
  readonly vectorCandidates: ReadonlyArray<VectorCandidate>
  readonly limit: number
}

export interface RetrievalEvaluationReport {
  readonly metrics: {
    readonly minimumKeywordRecall: number
    readonly minimumVectorRecall: number
    readonly minimumHybridRecall: number
    readonly locatorFidelity: number
    readonly scopeLeaks: number
    readonly staleVersionLeaks: number
  }
  readonly gates: ReadonlyArray<{
    readonly id: string
    readonly passed: boolean
  }>
  readonly passed: boolean
}

function recall(
  relevant: ReadonlyArray<DocumentChunkId>,
  returned: ReadonlyArray<DocumentChunkId>,
): number {
  const returnedIds = new Set(returned)
  return relevant.filter((id) => returnedIds.has(id)).length / relevant.length
}

function minimum(values: ReadonlyArray<number>): number {
  return values.reduce(
    (current, value) => Math.min(current, value),
    Number.POSITIVE_INFINITY,
  )
}

function isUnitInterval(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1
}

/**
 * Measures deterministic retrieval recall, locator fidelity, and provenance
 * isolation against a fixed fixture.
 */
export function evaluateDocumentRetrieval(
  cases: ReadonlyArray<RetrievalEvaluationCase>,
  thresholds: RetrievalEvaluationThresholds,
): RetrievalEvaluationReport {
  const fixtureIsValid =
    isUnitInterval(thresholds.minimumKeywordRecall)
    && isUnitInterval(thresholds.minimumVectorRecall)
    && isUnitInterval(thresholds.minimumHybridRecall)
    && isUnitInterval(thresholds.minimumLocatorFidelity)
    && Number.isSafeInteger(thresholds.maximumScopeLeaks)
    && thresholds.maximumScopeLeaks >= 0
    && Number.isSafeInteger(thresholds.maximumStaleVersionLeaks)
    && thresholds.maximumStaleVersionLeaks >= 0
    && cases.length > 0
    && cases.every(
      (testCase) =>
        testCase.keywordRelevantChunkIds.length > 0
        && testCase.vectorRelevantChunkIds.length > 0
        && testCase.hybridRelevantChunkIds.length > 0
        && testCase.limit > 0
        && testCase.hybridRelevantChunkIds.every(
          (chunkId) =>
            testCase.expectedCitationLocators[chunkId] !== undefined,
        ),
    )
  if (!fixtureIsValid) {
    return {
      metrics: {
        minimumKeywordRecall: 0,
        minimumVectorRecall: 0,
        minimumHybridRecall: 0,
        locatorFidelity: 0,
        scopeLeaks: 0,
        staleVersionLeaks: 0,
      },
      gates: [{
        id: 'fixture-validity',
        passed: false,
      }],
      passed: false,
    }
  }

  const results = cases.map((testCase) => {
    const hybrid = fuseCandidates(
      testCase.keywordCandidates,
      testCase.vectorCandidates,
      testCase.limit,
    )
    const allCandidates = [
      ...testCase.keywordCandidates,
      ...testCase.vectorCandidates,
    ]
    const allowedVersions = new Set(testCase.allowedSourceVersionIds)
    const relevant = new Set(testCase.hybridRelevantChunkIds)
    const relevantEvidence = buildDocumentContext(hybrid).evidence.filter(
      (evidence) => relevant.has(evidence.chunkId),
    )
    const faithfulLocators = relevantEvidence.filter(
      (evidence) =>
        evidence.citationLocator
          === testCase.expectedCitationLocators[evidence.chunkId]
        && evidence.citationLocator === encodeDocumentLocator(evidence.locator),
    ).length

    return {
      keywordRecall: recall(
        testCase.keywordRelevantChunkIds,
        testCase.keywordCandidates.map((candidate) => candidate.chunkId),
      ),
      vectorRecall: recall(
        testCase.vectorRelevantChunkIds,
        testCase.vectorCandidates.map((candidate) => candidate.chunkId),
      ),
      hybridRecall: recall(
        testCase.hybridRelevantChunkIds,
        hybrid.map((candidate) => candidate.chunkId),
      ),
      faithfulLocators,
      relevantEvidenceCount: relevantEvidence.length,
      scopeLeaks: allCandidates.filter(
        (candidate) => !allowedVersions.has(candidate.sourceVersionId),
      ).length,
      staleVersionLeaks: allCandidates.filter(
        (candidate) => candidate.chunkingVersion !== testCase.chunkingVersion,
      ).length,
    }
  })

  const faithfulLocators = results.reduce(
    (total, result) => total + result.faithfulLocators,
    0,
  )
  const relevantEvidenceCount = results.reduce(
    (total, result) => total + result.relevantEvidenceCount,
    0,
  )
  const metrics = {
    minimumKeywordRecall: minimum(
      results.map((result) => result.keywordRecall),
    ),
    minimumVectorRecall: minimum(
      results.map((result) => result.vectorRecall),
    ),
    minimumHybridRecall: minimum(
      results.map((result) => result.hybridRecall),
    ),
    locatorFidelity:
      relevantEvidenceCount === 0
        ? 0
        : faithfulLocators / relevantEvidenceCount,
    scopeLeaks: results.reduce(
      (total, result) => total + result.scopeLeaks,
      0,
    ),
    staleVersionLeaks: results.reduce(
      (total, result) => total + result.staleVersionLeaks,
      0,
    ),
  }
  const gates = [
    {
      id: 'fixture-validity',
      passed: true,
    },
    {
      id: 'keyword-recall',
      passed:
        metrics.minimumKeywordRecall >= thresholds.minimumKeywordRecall,
    },
    {
      id: 'vector-recall',
      passed: metrics.minimumVectorRecall >= thresholds.minimumVectorRecall,
    },
    {
      id: 'hybrid-recall',
      passed: metrics.minimumHybridRecall >= thresholds.minimumHybridRecall,
    },
    {
      id: 'locator-fidelity',
      passed:
        metrics.locatorFidelity >= thresholds.minimumLocatorFidelity,
    },
    {
      id: 'source-version-scope-isolation',
      passed: metrics.scopeLeaks <= thresholds.maximumScopeLeaks,
    },
    {
      id: 'stale-chunking-version-isolation',
      passed:
        metrics.staleVersionLeaks <= thresholds.maximumStaleVersionLeaks,
    },
  ]

  return {
    metrics,
    gates,
    passed: gates.every((gate) => gate.passed),
  }
}
