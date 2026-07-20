import { beforeAll, describe, expect, it } from 'bun:test'
import { CorpusPartitioning } from '@struct/research-engine'
import { Effect } from 'effect'
import {
  PHASE_06_RECURSIVE_FILE_COUNT,
  runPhase06RecursiveEvaluation,
  serializePhase06RecursiveEvaluationReport,
  verifyPhase06RecursiveEvaluationReport,
} from '../src/recursive-analysis.js'
import { canonicalJson } from '../src/corpus.js'

function sha256(value: string): string {
  return new Bun.CryptoHasher('sha256').update(value).digest('hex')
}

function rehashReport(
  report: Awaited<ReturnType<typeof run>>,
  bodyChanges: Readonly<Record<string, unknown>>,
): string {
  const { reportSha256: _, ...originalBody } = report
  const body = { ...originalBody, ...bodyChanges }
  return canonicalJson({
    ...body,
    reportSha256: sha256(canonicalJson(body)),
  })
}

const run = () => Effect.runPromise(
  runPhase06RecursiveEvaluation().pipe(
    Effect.provide(CorpusPartitioning.Default),
  ),
)

describe('25,000-file recursive analysis evaluation', () => {
  let reports: Awaited<ReturnType<typeof run>>[]

  beforeAll(async () => {
    reports = [await run(), await run()]
  }, 30_000)

  it('passes correctness, budget, recovery, retention, and scale-signal gates', async () => {
    const report = reports[0]!

    expect(report.status).toBe('passed')
    expect(report.corpus.files).toBe(PHASE_06_RECURSIVE_FILE_COUNT)
    expect(report.criteria.every((item) => item.status === 'passed')).toBe(true)
    expect(report.recovery).toMatchObject({
      leafInterruptions: 1,
      mergeInterruptions: 1,
      recoveryCount: 1,
      duplicatePartitionEffects: 0,
      duplicateMergeEffects: 0,
      coveragePreserved: true,
    })
    expect(report.signals.minorityFindingsRetained)
      .toBe(report.signals.minorityFindingsExpected)
    expect(report.signals.contradictionsRetained)
      .toBe(report.signals.contradictionsExpected)
    expect(report.budget).toMatchObject({
      elapsedMilliseconds: 7,
      maximumElapsedMilliseconds: 600_000,
      committedArtifacts: 50,
      committedArtifactBytes: 1_600_000,
      maximumCommittedArtifactBytes: 6_553_600,
      maximumArtifactBytesObserved: 32_000,
      maximumPerArtifactBytes: 65_536,
      maximumArtifacts: 100,
    })
    expect(report.blockers).toEqual([])
  })

  it('is byte-identical across repeated runs and verifies its report hash', async () => {
    const first = reports[0]!
    const second = reports[1]!
    const firstBytes = serializePhase06RecursiveEvaluationReport(first)
    const secondBytes = serializePhase06RecursiveEvaluationReport(second)

    expect(secondBytes).toBe(firstBytes)
    expect(firstBytes.match(/\n*$/)?.[0]).toBe('\n')
    expect(secondBytes.match(/\n*$/)?.[0]).toBe('\n')
    expect(verifyPhase06RecursiveEvaluationReport(firstBytes)).toEqual(first)
    expect(() =>
      verifyPhase06RecursiveEvaluationReport(
        firstBytes.replace('"status":"passed"', '"status":"failed"'),
      )).toThrow('hash is invalid')
  })

  it('rejects a semantically invalid report even when its hash is recomputed', () => {
    const report = reports[0]!
    const [, ...criteria] = report.criteria

    expect(() =>
      verifyPhase06RecursiveEvaluationReport(
        rehashReport(report, { criteria }),
      )).toThrow('criterion inventory is invalid')
    expect(() =>
      verifyPhase06RecursiveEvaluationReport(
        rehashReport(report, { status: 'failed' }),
      )).toThrow('report status is invalid')
  })
})
