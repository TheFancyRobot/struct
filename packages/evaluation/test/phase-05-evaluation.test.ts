import { describe, expect, it } from 'bun:test'
import { Effect } from 'effect'
import {
  phase05CriterionIds,
  type Phase05LiveIntegrationEvidence,
  readPhase05LiveIntegrationEvidence,
  runPhase05Evaluation,
  serializePhase05EvaluationReport,
  verifyPhase05TrackedReportIntegrity,
} from '../src/phase-05-evaluation.js'
import { resolve } from 'node:path'
import { canonicalJson } from '../src/corpus.js'

const liveEvidencePath = resolve(
  import.meta.dir,
  '../results/phase-05-live-evidence-v1.json',
)

describe('Phase 05 deterministic release evaluation', () => {
  it('passes all observed direct criteria with byte-identical repeated reports', async () => {
    const contractEvidence = await readPhase05LiveIntegrationEvidence(
      liveEvidencePath,
    )
    const first = await Effect.runPromise(runPhase05Evaluation(contractEvidence))
    const second = await Effect.runPromise(runPhase05Evaluation(contractEvidence))
    const firstBytes = serializePhase05EvaluationReport(first)
    const secondBytes = serializePhase05EvaluationReport(second)

    expect(first.status).toBe('passed')
    expect(first.counts).toEqual({
      criteria: phase05CriterionIds.length,
      passed: phase05CriterionIds.length,
      failed: 0,
    })
    expect(first.criteria.map((item) => item.id).toSorted()).toEqual(
      [...phase05CriterionIds].toSorted(),
    )
    expect(first.criteria.every((item) => item.status === 'passed')).toBe(true)
    expect(first.reportSha256).toBe(second.reportSha256)
    expect(firstBytes).toBe(secondBytes)
  })

  it('accepts the tracked canonical report when it matches fresh output', async () => {
    const evidence = await readPhase05LiveIntegrationEvidence(liveEvidencePath)
    const freshBytes = serializePhase05EvaluationReport(
      await Effect.runPromise(runPhase05Evaluation(evidence)),
    )
    const trackedBytes = await Bun.file(resolve(
      import.meta.dir,
      '../results/phase-05-evaluation-v1.json',
    )).text()

    expect(() =>
      verifyPhase05TrackedReportIntegrity(trackedBytes, freshBytes)
    ).not.toThrow()
  })

  it('rejects manual or stale tracked report changes', async () => {
    const evidence = await readPhase05LiveIntegrationEvidence(liveEvidencePath)
    const freshBytes = serializePhase05EvaluationReport(
      await Effect.runPromise(runPhase05Evaluation(evidence)),
    )
    const parsed: unknown = JSON.parse(freshBytes)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error('fresh report must be an object')
    }
    const manualBytes = JSON.stringify({
      ...Object.fromEntries(Object.entries(parsed)),
      status: 'failed',
    })
    expect(() =>
      verifyPhase05TrackedReportIntegrity(manualBytes, freshBytes)
    ).toThrow('tracked Phase 05 report hash does not match its body')

    const staleBody: Record<string, unknown> = {
      ...Object.fromEntries(Object.entries(parsed)),
      status: 'failed',
    }
    delete staleBody['reportSha256']
    const staleBytes = canonicalJson({
      ...staleBody,
      reportSha256: new Bun.CryptoHasher('sha256')
        .update(canonicalJson(staleBody))
        .digest('hex'),
    })
    expect(() =>
      verifyPhase05TrackedReportIntegrity(staleBytes, freshBytes)
    ).toThrow('tracked Phase 05 report differs from fresh evaluation output')
  })

  for (const criterionId of phase05CriterionIds) {
    it(`records direct fixture, result, and pass evidence for ${criterionId}`, async () => {
      const contractEvidence = await readPhase05LiveIntegrationEvidence(
        liveEvidencePath,
      )
      const report = await Effect.runPromise(
        runPhase05Evaluation(contractEvidence),
      )
      const criterion = report.criteria.find((item) => item.id === criterionId)
      expect(criterion).toBeDefined()
      expect(criterion?.status).toBe('passed')
      expect(Object.keys(criterion?.fixture ?? {}).length).toBeGreaterThan(0)
      expect(Object.keys(criterion?.result ?? {}).length).toBeGreaterThan(0)
      expect(criterion?.evidenceSha256).toMatch(/^[0-9a-f]{64}$/)
    })
  }

  it.each([
    {
      name: 'non-increasing committed cursors',
      mutate: (evidence: Phase05LiveIntegrationEvidence) => ({
        ...evidence,
        recovery: {
          ...evidence.recovery,
          committedEventSequences: [10, 10],
          reconnectCursor: 9,
          reconnectEventSequences: [10, 10],
        },
      }),
    },
    {
      name: 'a reconnect sequence outside the exact suffix',
      mutate: (evidence: Phase05LiveIntegrationEvidence) => ({
        ...evidence,
        recovery: {
          ...evidence.recovery,
          committedEventSequences: [10, 11, 12],
          reconnectCursor: 10,
          reconnectEventSequences: [12],
        },
      }),
    },
    {
      name: 'an evidence run ID outside the evaluated run',
      mutate: (evidence: Phase05LiveIntegrationEvidence) => ({
        ...evidence,
        runId: '950e8400-e29b-41d4-a716-446655440099',
      }),
      decodeOnly: true,
    },
    {
      name: 'a replacement process that replays the dataset provider',
      mutate: (evidence: Phase05LiveIntegrationEvidence) => ({
        ...evidence,
        recovery: {
          ...evidence.recovery,
          datasetProviderCallsAfterReplacement: 1,
        },
      }),
      decodeOnly: false,
    },
  ])('rejects $name', async ({ mutate, decodeOnly = true }) => {
    const evidence = await readPhase05LiveIntegrationEvidence(liveEvidencePath)
    const candidate = mutate(evidence)
    const candidatePath = resolve(
      import.meta.dir,
      `../results/.phase-05-invalid-${crypto.randomUUID()}.json`,
    )
    await Bun.write(candidatePath, JSON.stringify(candidate))
    try {
      if (decodeOnly) {
        await expect(
          readPhase05LiveIntegrationEvidence(candidatePath),
        ).rejects.toThrow()
      } else {
        const decoded = await readPhase05LiveIntegrationEvidence(candidatePath)
        const report = await Effect.runPromise(runPhase05Evaluation(decoded))
        expect(
          report.criteria.find(({ id }) => id === 'committed-event-recovery')
            ?.status,
        ).toBe('failed')
        expect(report.status).toBe('failed')
        expect(report.counts.failed).toBeGreaterThan(0)
      }
    } finally {
      await Bun.file(candidatePath).delete()
    }
  })
})
