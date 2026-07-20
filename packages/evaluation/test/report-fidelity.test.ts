import { beforeAll, describe, expect, it } from 'bun:test'
import { Effect } from 'effect'
import { canonicalJson } from '../src/corpus.js'
import {
  REPORT_FIDELITY_LIMITS,
  runReportFidelityEvaluation,
  runReportFidelityEvaluationWithinLimits,
  serializeReportFidelityEvaluationReport,
  verifyReportFidelityEvaluationReport,
  type ReportFidelityEvaluationReport,
} from '../src/report-fidelity.js'

function sha256(value: string): string {
  return new Bun.CryptoHasher('sha256').update(value).digest('hex')
}

function rehash(
  report: ReportFidelityEvaluationReport,
  changes: Readonly<Record<string, unknown>>,
): string {
  const { reportSha256: _, ...original } = report
  const body = { ...original, ...changes }
  return canonicalJson({
    ...body,
    reportSha256: sha256(canonicalJson(body)),
  })
}

const verify = (input: string) =>
  Effect.runPromise(verifyReportFidelityEvaluationReport(input))

describe('deterministic report fidelity evaluation', () => {
  let reports: [ReportFidelityEvaluationReport, ReportFidelityEvaluationReport]

  beforeAll(async () => {
    reports = [
      await Effect.runPromise(runReportFidelityEvaluation()),
      await Effect.runPromise(runReportFidelityEvaluation()),
    ]
  })

  it('passes every bounded fidelity, drift, audit, security, and limit case', () => {
    const report = reports[0]
    expect(report.status).toBe('passed')
    expect(report.counts).toEqual({
      total: 26,
      passed: 26,
      failed: 0,
    })
    expect(report.cases.map((item) => item.id)).toEqual([
      'mode-document',
      'mode-dataset',
      'mode-recursive',
      'mode-hybrid',
      'revision-generated',
      'revision-user',
      'citation-draft',
      'citation-valid',
      'citation-stale',
      'citation-broken',
      'citation-unauthorized',
      'citation-incompatible',
      'citation-superseded',
      'citation-publishable',
      'unsupported-publication-block',
      'contradiction-rejected',
      'repair-audit-history',
      'source-version-drift',
      'restart-replay',
      'export-round-trip',
      'authorization-containment',
      'prompt-injection-containment',
      'limit-wall-clock',
      'limit-concurrency',
      'limit-artifact-bytes',
      'limit-case-count',
    ])
    expect(report.cases.every((item) => item.status === 'passed')).toBe(true)
    expect(report.resources.observedCases).toBe(report.counts.total)
    expect(report.resources.observedConcurrency)
      .toBeLessThanOrEqual(report.limits.maximumConcurrency)
    expect(report.resources.observedArtifactBytes)
      .toBeLessThanOrEqual(report.limits.maximumArtifactBytes)

    const citationCases = report.cases.filter((item) =>
      item.category === 'citation')
    const documentClaimId = report.cases.find((item) =>
      item.id === 'mode-document')!.observed['claimId']
    if (typeof documentClaimId !== 'string') {
      throw new Error('Document mode case must record its claim identity')
    }
    expect(citationCases).toHaveLength(8)
    for (const citationCase of citationCases) {
      const expectedAllowed = citationCase.observed['state'] === 'publishable'
      expect(citationCase.observed['expectedAllowed']).toBe(expectedAllowed)
      expect(citationCase.observed['publicationAllowed']).toBe(expectedAllowed)
      expect(citationCase.observed['exportAllowed']).toBe(expectedAllowed)
      expect(citationCase.observed['publicationResult']).toBe(
        expectedAllowed ? 'publishable' : 'ReportNotPublishableError',
      )
      expect(citationCase.observed['exportResult']).toBe(
        expectedAllowed
          ? 'prepared'
          : 'ReportExportBlockedError:citation-not-valid',
      )
      expect(citationCase.observed['exportBlockingClaimIds']).toEqual(
        expectedAllowed ? [] : [documentClaimId],
      )
    }
  })

  it('is byte-identical on replay and verifies its canonical tracked form', async () => {
    const first = serializeReportFidelityEvaluationReport(reports[0])
    const second = serializeReportFidelityEvaluationReport(reports[1])
    expect(second).toBe(first)
    expect(first.endsWith('\n')).toBe(true)
    expect(first.endsWith('\n\n')).toBe(false)
    expect(await verify(first)).toEqual(reports[0])
  })

  it('measures and enforces the real wall-clock limit outside the semantic hash', async () => {
    const measured = await Effect.runPromise(
      runReportFidelityEvaluationWithinLimits(),
    )
    expect(measured.observedElapsedMilliseconds).toBeGreaterThanOrEqual(0)
    expect(measured.observedElapsedMilliseconds)
      .toBeLessThanOrEqual(REPORT_FIDELITY_LIMITS.maximumElapsedMilliseconds)
    expect(measured.report).toEqual(reports[0])
  })

  it('rejects semantic tampering even after the outer hash is recomputed', async () => {
    const report = reports[0]
    const mutations = [
      rehash(report, { status: 'failed' }),
      rehash(report, {
        counts: { ...report.counts, passed: report.counts.passed - 1 },
      }),
      rehash(report, { cases: report.cases.slice(1) }),
      rehash(report, {
        cases: report.cases.map((item, index) => index === 0
          ? { ...item, status: 'failed' }
          : item),
      }),
      rehash(report, {
        cases: report.cases.map((item) =>
          item.id === 'mode-document'
            ? { ...item, observed: { ...item.observed, claimId: 'tampered' } }
            : item),
      }),
      rehash(report, {
        cases: report.cases.map((item) =>
          item.id === 'source-version-drift'
            ? {
              ...item,
              observed: {
                ...item.observed,
                refreshedSourceVersionId:
                  item.observed['anchoredSourceVersionId'],
              },
            }
            : item),
      }),
      rehash(report, {
        cases: report.cases.map((item) =>
          item.id === 'repair-audit-history'
            ? { ...item, observed: { ...item.observed, revisions: ['2'] } }
            : item),
      }),
      rehash(report, {
        cases: report.cases.map((item) =>
          item.id === 'export-round-trip'
            ? { ...item, observed: { ...item.observed, digest: `sha256:${'0'.repeat(64)}` } }
            : item),
      }),
      rehash(report, {
        resources: { ...report.resources, observedConcurrency: 2 },
      }),
      rehash(report, {
        resources: {
          ...report.resources,
          wallClockEnforcement: 'measured-effect-timeout-disabled',
        },
      }),
      rehash(report, {
        limits: { ...report.limits, maximumCases: 31 },
      }),
    ]
    for (const mutation of mutations) {
      await expect(verify(mutation)).rejects.toThrow()
    }
  })

  it('rejects hash, schema, and newline tampering', async () => {
    const serialized = serializeReportFidelityEvaluationReport(reports[0])
    await expect(verify(serialized.replace(
      reports[0].reportSha256,
      '0'.repeat(64),
    ))).rejects.toThrow('outer hash is invalid')
    await expect(verify(serialized.trimEnd())).rejects.toThrow(
      'newline is invalid',
    )
    await expect(verify(`${serialized}\n`)).rejects.toThrow(
      'newline is invalid',
    )
    await expect(verify('{bad-json}\n')).rejects.toThrow('JSON is invalid')
  })
})
