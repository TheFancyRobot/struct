import { beforeAll, describe, expect, it } from 'bun:test'
import { Effect } from 'effect'
import { canonicalJson } from '../src/corpus.js'
import {
  runHybridResearchEvaluation,
  serializeHybridResearchEvaluationReport,
  verifyHybridResearchEvaluationReport,
  type HybridResearchEvaluationReport,
} from '../src/hybrid-research.js'

function sha256(value: string): string {
  return new Bun.CryptoHasher('sha256').update(value).digest('hex')
}

function rehash(
  report: HybridResearchEvaluationReport,
  changes: Readonly<Record<string, unknown>>,
): string {
  const { reportSha256: _, ...originalBody } = report
  const body = { ...originalBody, ...changes }
  return canonicalJson({
    ...body,
    reportSha256: sha256(canonicalJson(body)),
  })
}

const verify = (input: string) =>
  Effect.runPromise(verifyHybridResearchEvaluationReport(input))
const trackedArtifactUrl = new URL(
  '../results/phase-07-hybrid-research-v1.json',
  import.meta.url,
)

describe('Phase 07 deterministic hybrid research evaluation', () => {
  let reports: [HybridResearchEvaluationReport, HybridResearchEvaluationReport]

  beforeAll(async () => {
    reports = [
      await Effect.runPromise(runHybridResearchEvaluation()),
      await Effect.runPromise(runHybridResearchEvaluation()),
    ]
  })

  it('passes exactness, provenance, contradiction, injection, and resource gates', () => {
    const report = reports[0]
    expect(report.status).toBe('passed')
    expect(report.metrics).toEqual({
      passed: report.criteria.length,
      failed: 0,
      total: report.criteria.length,
    })
    expect(report.criteria.every((item) => item.status === 'passed')).toBe(true)
    expect(report.cases).toEqual({
      total: 7,
      aligned: 4,
      mismatched: 1,
      contradictory: 1,
      insufficient: 1,
    })
    expect(report.failureTaxonomy.map((item) => item.category)).toEqual([
      'wrong-routing',
      'stale-citation',
      'unsupported-reconciliation',
      'security-boundary-violation',
    ])
    expect(report.failureTaxonomy.every((item) => item.detected)).toBe(true)
    expect(
      report.criteria.find((item) =>
        item.id === 'prompt-injection-containment'
      )?.evidence,
    ).toMatchObject({
      injectedInstructionRejected: true,
      injectionRejectionReason: 'untrusted-instruction',
      injectionReachedAnswer: false,
    })
    expect(report.resources).toMatchObject({
      observedModelCalls: 1,
      maximumModelCalls: 1,
      observedToolCalls: 2,
      maximumToolCalls: 2,
      observedConcurrency: 2,
      maximumConcurrency: 2,
      observedElapsedMilliseconds: 9,
      maximumElapsedMilliseconds: 10_000,
      observedTokens: 24,
      maximumTokens: 10_000,
      observedEstimatedCostMicros: 3,
      maximumEstimatedCostMicros: 10,
      observedArtifactBytes: 1_920,
      maximumRows: 10,
      maximumColumns: 8,
      maximumSummaryBytes: 32_768,
      maximumClaims: 8,
      maximumOutputBytes: 65_536,
    })
  })

  it('is byte-identical on replay and verifies the canonical artifact', async () => {
    const first = serializeHybridResearchEvaluationReport(reports[0])
    const second = serializeHybridResearchEvaluationReport(reports[1])
    expect(second).toBe(first)
    expect(first.endsWith('\n')).toBe(true)
    expect(first.endsWith('\n\n')).toBe(false)
    expect(await verify(first)).toEqual(reports[0])
  })

  it('matches the tracked phase 07 artifact exactly', async () => {
    const tracked = await Bun.file(trackedArtifactUrl).text()
    expect(tracked).toBe(serializeHybridResearchEvaluationReport(reports[0]))
    expect(await verify(tracked)).toEqual(reports[0])
  })

  it('rejects independently tampered fields after outer-hash recomputation', async () => {
    const report = reports[0]
    const [firstCriterion, ...remainingCriteria] = report.criteria
    const mutations: ReadonlyArray<string> = [
      rehash(report, { evaluationId: 'phase-07-hybrid-research-v2' }),
      rehash(report, { status: 'failed' }),
      rehash(report, {
        metrics: { ...report.metrics, passed: report.metrics.passed - 1 },
      }),
      rehash(report, { criteria: remainingCriteria }),
      rehash(report, {
        criteria: [{
          ...firstCriterion!,
          evidence: { ...firstCriterion!.evidence, sourceKinds: ['dataset'] },
        }, ...remainingCriteria],
      }),
      rehash(report, {
        provenanceSha256: '0'.repeat(64),
      }),
      rehash(report, {
        fixtureSha256: '0'.repeat(64),
      }),
      rehash(report, {
        failureTaxonomy: report.failureTaxonomy.slice(1),
      }),
    ]
    for (const mutation of mutations) {
      await expect(verify(mutation)).rejects.toThrow()
    }
  })

  it('rejects an altered report hash and non-canonical newlines', async () => {
    const serialized = serializeHybridResearchEvaluationReport(reports[0])
    await expect(verify(
      serialized.replace(
        reports[0].reportSha256,
        '0'.repeat(64),
      ),
    )).rejects.toThrow('report hash is invalid')
    await expect(verify(serialized.trimEnd())).rejects.toThrow(
      'report newline is invalid',
    )
    await expect(verify(`${serialized}\n`)).rejects.toThrow(
      'report newline is invalid',
    )
    await expect(verify('{not-json}\n')).rejects.toThrow(
      'report JSON is invalid',
    )
  })
})
