import {
  DATA_ENGINE_ADAPTER_VERSION,
  DATA_ENGINE_EXECUTION_POLICY_VERSION,
  DATA_ENGINE_PROTOCOL_VERSION,
  DATA_ENGINE_VERSION,
} from '@struct/data-engine'
import { expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { canonicalJson } from '../src/corpus.js'
import { readEvaluationReport } from '../src/phase-04-evaluation.js'

const fixturePath = resolve(
  import.meta.dir,
  '../results/phase-04-evaluation-v1.json',
)

function sha256(value: string): string {
  return new Bun.CryptoHasher('sha256').update(value).digest('hex')
}

async function fixtureReport(): Promise<Record<string, unknown>> {
  const report = await Bun.file(fixturePath).json() as Record<string, unknown>
  const runtime = report['runtime']
  if (typeof runtime !== 'object' || runtime === null || Array.isArray(runtime)) {
    throw new Error('fixture runtime must be an object')
  }
  return {
    ...report,
    runtime: {
      ...runtime,
      protocolVersion: DATA_ENGINE_PROTOCOL_VERSION,
      engineVersion: DATA_ENGINE_VERSION,
      engineAdapterVersion: DATA_ENGINE_ADAPTER_VERSION,
      executionPolicyVersion: DATA_ENGINE_EXECUTION_POLICY_VERSION,
    },
  }
}

function serializeReport(
  report: Record<string, unknown>,
  runtime: Record<string, unknown>,
): string {
  const { reportSha256: _, ...body } = report
  const nextBody = { ...body, runtime }
  return canonicalJson({
    ...nextBody,
    reportSha256: sha256(canonicalJson(nextBody)),
  })
}

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

test('evaluation report reader rejects forged engine identity even when hash is recomputed', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'struct-phase-04-report-'))
  const path = resolve(root, 'report.json')
  try {
    const report = await fixtureReport()
    const runtime = report['runtime'] as Record<string, unknown>
    await Bun.write(path, serializeReport(report, {
      ...runtime,
      engineVersion: 'duckdb-fake',
    }))

    await expect(readEvaluationReport(path)).rejects.toThrow(
      'Evaluation report shape is invalid',
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('evaluation report reader rejects reports missing adapter and execution policy versions', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'struct-phase-04-report-'))
  const path = resolve(root, 'report.json')
  try {
    const report = await fixtureReport()
    const runtime = { ...(report['runtime'] as Record<string, unknown>) }
    delete runtime['engineAdapterVersion']
    delete runtime['executionPolicyVersion']
    await Bun.write(path, serializeReport(report, runtime))

    await expect(readEvaluationReport(path)).rejects.toThrow(
      'Evaluation report shape is invalid',
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
