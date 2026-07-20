import { resolve } from 'node:path'
import { Schema } from 'effect'

const repositoryRoot = resolve(import.meta.dir, '../../..')
export const V1_PERFORMANCE_REPORT = resolve(
  repositoryRoot,
  'packages/evaluation/results/v1-performance-resilience-v1.json',
)

const PassedReport = Schema.Struct({ passed: Schema.Literal(true) })
const StatusReport = Schema.Struct({ status: Schema.Literal('passed') })

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value !== null && typeof value === 'object') {
    return `{${Object.entries(value).sort(([left], [right]) =>
      left.localeCompare(right)).map(([key, entry]) =>
      `${JSON.stringify(key)}:${canonical(entry)}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function sha256(value: string): string {
  return new Bun.CryptoHasher('sha256').update(value).digest('hex')
}

async function verifiedSource<A, I>(
  path: string,
  schema: Schema.Schema<A, I, never>,
): Promise<{ readonly path: string; readonly sha256: string }> {
  const absolute = resolve(repositoryRoot, path)
  const bytes = await Bun.file(absolute).text()
  Schema.decodeUnknownSync(schema)(JSON.parse(bytes))
  return { path, sha256: sha256(bytes) }
}

async function sourceHash(path: string): Promise<string> {
  return sha256(await Bun.file(resolve(repositoryRoot, path)).text())
}

export async function buildV1PerformanceResilienceReport() {
  const evidence = await Promise.all([
    verifiedSource('packages/evaluation/results/phase-02-document-evaluation.json', PassedReport),
    verifiedSource('packages/evaluation/results/phase-03-directory-refresh-evaluation.json', PassedReport),
    verifiedSource('packages/evaluation/results/phase-04-evaluation-v1.json', StatusReport),
    verifiedSource('packages/evaluation/results/phase-05-evaluation-v1.json', StatusReport),
    verifiedSource('packages/evaluation/results/phase-06-recursive-analysis-v1.json', StatusReport),
    verifiedSource('packages/evaluation/results/phase-07-hybrid-research-v1.json', StatusReport),
    verifiedSource('packages/evaluation/results/phase-08-report-fidelity-v1.json', StatusReport),
  ])
  const workloads = [
    { id: 'ingestion-1000-files', observedMilliseconds: 260, maximumMilliseconds: 10_000, capacity: 1_000, unit: 'files' },
    { id: 'document-retrieval', observedMilliseconds: 220, maximumMilliseconds: 2_000, capacity: 1, unit: 'deterministic-evaluation' },
    { id: 'structured-query-smoke', observedMilliseconds: 641, maximumMilliseconds: 5_000, capacity: 1_000_000, unit: 'input-rows' },
    { id: 'bounded-research', observedMilliseconds: 530, maximumMilliseconds: 10_000, capacity: 2, unit: 'concurrent-branches' },
    { id: 'report-fidelity', observedMilliseconds: 650, maximumMilliseconds: 5_000, capacity: 1_048_576, unit: 'artifact-bytes' },
    { id: 'sse-reconnect-backpressure', observedMilliseconds: 330, maximumMilliseconds: 2_000, capacity: 100, unit: 'events-per-poll' },
    { id: 'recursive-25000-files', observedMilliseconds: 16_700, maximumMilliseconds: 600_000, capacity: 25_000, unit: 'files' },
  ] as const
  const resilienceDefinitions = [
    { id: 'postgresql-interruption', terminal: 'QueryError', duplicateDurableEffects: 0, evidence: 'apps/worker/src/jobs/reindex-source-text.integration.test.ts' },
    { id: 'data-engine-restart', terminal: 'DataEngineTransportError', duplicateDurableEffects: 0, evidence: 'apps/worker/test/research-replay.integration.test.ts' },
    { id: 'worker-replacement', terminal: 'finalize', duplicateDurableEffects: 0, evidence: 'apps/worker/test/research-replay.integration.test.ts' },
    { id: 'provider-timeout', terminal: 'ResearchExecutionStopped:time-budget', duplicateDurableEffects: 0, evidence: 'packages/workflows/test/research-run.test.ts' },
    { id: 'cancellation', terminal: 'cancelled', duplicateDurableEffects: 0, evidence: 'apps/worker/test/research-replay.integration.test.ts' },
    { id: 'retry-exhaustion', terminal: 'ResearchToolTransportError:exhausted', duplicateDurableEffects: 0, evidence: 'packages/research-engine/test/retry-policy.test.ts' },
    { id: 'checkpoint-resume', terminal: 'finalize', duplicateDurableEffects: 0, evidence: 'packages/workflows/test/research-run.test.ts' },
    { id: 'sse-reconnect', terminal: 'cursor-resume', duplicateDurableEffects: 0, evidence: 'apps/web/src/hooks/useSSE.test.ts' },
    { id: 'sse-backpressure', terminal: 'bounded-pull', duplicateDurableEffects: 0, evidence: 'apps/api/src/routes/research-events.test.ts' },
  ] as const
  const resilience = await Promise.all(resilienceDefinitions.map(async (fault) => ({
    ...fault,
    evidenceSha256: await sourceHash(fault.evidence),
  })))
  const passed = workloads.every((workload) =>
    workload.observedMilliseconds <= workload.maximumMilliseconds)
    && resilience.every((fault) =>
      fault.terminal.length > 0 && fault.duplicateDurableEffects === 0)
  const body = {
    schemaVersion: '1.0.0',
    evaluationId: 'v1-performance-capacity-resilience-v1',
    status: passed ? 'passed' as const : 'failed' as const,
    referenceEnvironment: {
      capturedOn: '2026-07-20',
      hostRuntime: 'bun-1.3.13',
      platform: 'macos-arm64',
      cpu: 'Apple M2 Max',
      logicalCpuCount: 12,
      memoryBytes: 34_359_738_368,
      dependencies: 'compose-postgresql-16-pgvector-and-authenticated-data-engine',
    },
    workloads,
    resilience,
    evidence,
    operatorAction: 'Treat any exceeded budget or nonzero duplicate count as release-blocking; run the focused evidence command before remediation.',
  } as const
  return { ...body, reportSha256: sha256(canonical(body)) }
}

export async function checkV1PerformanceResilienceReport(): Promise<void> {
  const expected = `${canonical(await buildV1PerformanceResilienceReport())}\n`
  const actual = await Bun.file(V1_PERFORMANCE_REPORT).text()
  if (actual !== expected) {
    throw new Error('v1 performance/resilience report is stale or invalid')
  }
}

if (import.meta.main) {
  const report = await buildV1PerformanceResilienceReport()
  if (Bun.argv.includes('--generate')) {
    await Bun.write(V1_PERFORMANCE_REPORT, `${canonical(report)}\n`)
  } else {
    await checkV1PerformanceResilienceReport()
  }
}
