import { expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { readEvaluationReport } from '../src/phase-04-evaluation.js'

test('evaluation report reader rejects malformed nested evidence', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'struct-phase-04-report-'))
  const path = resolve(root, 'report.json')
  try {
    await Bun.write(path, JSON.stringify({
      schemaVersion: '1.0.0',
      evaluationId: 'phase-04-exact-computation-v1',
      status: 'passed',
      corpus: { profile: 'full', totalFiles: '25000' },
      runtime: {},
      counts: {},
      cases: [],
      reportSha256: 'forged',
    }))
    await expect(readEvaluationReport(path)).rejects.toThrow(
      'Evaluation report shape is invalid',
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
