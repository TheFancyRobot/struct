import { resolve } from 'node:path'

interface LiveGate {
  readonly id: string
  readonly command: readonly string[]
  readonly maximumMilliseconds: number
  readonly environment?: Readonly<Record<string, string>>
}

const repositoryRoot = resolve(import.meta.dir, '..')
const databaseUrl = process.env.DATABASE_URL
  ?? 'postgres://struct:struct@127.0.0.1:5432/struct'

export const liveGates: readonly LiveGate[] = [
  { id: 'phase-02-document-retrieval', command: ['bun', 'packages/evaluation/src/phase-02-smoke.ts'], maximumMilliseconds: 30_000 },
  { id: 'phase-03-directory-ingestion', command: ['bun', 'packages/evaluation/src/directory-refresh-smoke.ts'], maximumMilliseconds: 10_000 },
  { id: 'phase-04-structured-query', command: ['bun', 'packages/evaluation/src/benchmarks/run.ts', '--smoke'], maximumMilliseconds: 30_000 },
  { id: 'phase-05-dataset-research', command: ['bun', 'packages/evaluation/src/run-phase-05-evaluation.ts', '--check-and-generate'], maximumMilliseconds: 30_000 },
  { id: 'phase-06-recursive-25000', command: ['bun', 'packages/evaluation/src/run-phase-06-recursive-evaluation.ts', '--check'], maximumMilliseconds: 600_000 },
  { id: 'phase-07-hybrid-research', command: ['bun', 'packages/evaluation/src/run-phase-07-hybrid-evaluation.ts', '--check'], maximumMilliseconds: 30_000 },
  { id: 'phase-08-report-fidelity', command: ['bun', 'packages/evaluation/src/run-report-fidelity-evaluation.ts', '--check'], maximumMilliseconds: 30_000 },
  {
    id: 'unit-resilience-matrix',
    command: [
      'bun', 'test', '--timeout', '30000', '--max-concurrency', '1',
      'packages/workflows/test/research-run.test.ts',
      'packages/research-engine/test/retry-policy.test.ts',
      'apps/api/src/routes/research-events.test.ts',
      'apps/web/src/hooks/useSSE.test.ts',
    ],
    maximumMilliseconds: 30_000,
  },
  {
    id: 'real-interruption-restart-replacement',
    command: [
      'bun', 'test', '--timeout', '30000', '--max-concurrency', '1',
      'apps/worker/test/research-replay.integration.test.ts',
      'apps/worker/src/jobs/reindex-source-text.integration.test.ts',
      'packages/data-engine/test/sidecar.integration.test.ts',
    ],
    maximumMilliseconds: 60_000,
    environment: { DATA_ENGINE_INTEGRATION: '1', DATABASE_URL: databaseUrl },
  },
  { id: 'canonical-report', command: ['bun', 'packages/evaluation/src/v1-performance-resilience.ts', '--check'], maximumMilliseconds: 10_000 },
]

export async function executeLiveGate(gate: LiveGate): Promise<number> {
  const started = performance.now()
  const child = Bun.spawn([...gate.command], {
    cwd: repositoryRoot,
    env: { ...process.env, ...gate.environment },
    stdout: 'inherit',
    stderr: 'inherit',
  })
  let timeout: ReturnType<typeof setTimeout> | undefined
  const timeoutOutcome = new Promise<{ readonly exitCode: -1; readonly timedOut: true }>(
    (resolveTimeout) => {
      timeout = setTimeout(
        () => resolveTimeout({ exitCode: -1, timedOut: true }),
        gate.maximumMilliseconds,
      )
    },
  )
  const outcome = await Promise.race([
    child.exited.then((exitCode) => ({ exitCode, timedOut: false })),
    timeoutOutcome,
  ]).finally(() => {
    if (timeout !== undefined) clearTimeout(timeout)
  })
  if (outcome.timedOut) {
    child.kill()
    await child.exited
    throw new Error(`${gate.id} exceeded ${gate.maximumMilliseconds}ms`)
  }
  if (outcome.exitCode !== 0) {
    throw new Error(`${gate.id} failed with exit ${outcome.exitCode}`)
  }
  return Math.round(performance.now() - started)
}

export async function runV1PerformanceGate(): Promise<void> {
  const results: Array<{ readonly id: string; readonly elapsedMilliseconds: number }> = []
  for (const gate of liveGates) {
    results.push({ id: gate.id, elapsedMilliseconds: await executeLiveGate(gate) })
  }
  process.stdout.write(`${JSON.stringify({ status: 'passed', gates: results }, null, 2)}\n`)
}

if (import.meta.main) {
  const program = process.argv.includes('--deadline-cleanup-probe')
    ? executeLiveGate({
        id: 'deadline-cleanup-probe',
        command: ['bun', '-e', 'process.exit(0)'],
        maximumMilliseconds: 10_000,
      }).then(() => undefined)
    : runV1PerformanceGate()
  program.catch((cause: unknown) => {
    process.stderr.write(`v1 performance/resilience gate failed: ${cause instanceof Error ? cause.message : String(cause)}\n`)
    process.exitCode = 1
  })
}
