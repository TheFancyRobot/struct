import { arch, platform } from 'node:os'
import { resolve } from 'node:path'
import { executeLiveGate, liveGates } from './v1-performance-gate.js'

interface CampaignGate {
  readonly id: string
  readonly command: readonly string[]
  readonly maximumMilliseconds: number
  readonly environment?: Readonly<Record<string, string>>
}

interface EvidenceDefinition {
  readonly id: string
  readonly path: string
  readonly expectedOutcome: 'passed'
}

const repositoryRoot = resolve(import.meta.dir, '..')
const resultPath = resolve(
  repositoryRoot,
  'packages/evaluation/results/v1-evaluation-campaign-v1.json',
)
const reportPath = resolve(
  repositoryRoot,
  'docs/benchmarks/v1-evaluation-campaign.md',
)
const remediationPath = 'docs/operations/v1-evaluation-remediation.md'
const databaseUrl = process.env.DATABASE_URL
  ?? 'postgres://struct:struct@127.0.0.1:5432/struct'
const dataEngineToken = process.env.DATA_ENGINE_TOKEN
  ?? 'struct-local-data-engine-token'

const selectedPerformanceGates = [
  'unit-resilience-matrix',
  'real-interruption-restart-replacement',
  'canonical-report',
] as const

function performanceGate(id: typeof selectedPerformanceGates[number]): CampaignGate {
  const gate = liveGates.find((candidate) => candidate.id === id)
  if (gate === undefined) throw new Error(`Missing v1 performance gate: ${id}`)
  return gate
}

export const campaignGates: readonly CampaignGate[] = [
  {
    id: 'environment-storage-readiness',
    command: ['bun', 'scripts/prepare-local-storage.ts'],
    maximumMilliseconds: 10_000,
  },
  {
    id: 'dependency-stack-readiness',
    command: ['bun', 'scripts/production-operations.ts', 'stack:up'],
    maximumMilliseconds: 180_000,
    environment: { DATABASE_URL: databaseUrl, DATA_ENGINE_TOKEN: dataEngineToken },
  },
  {
    id: 'phase-02-document-retrieval-security',
    command: ['bun', 'packages/evaluation/src/phase-02-smoke.ts'],
    maximumMilliseconds: 30_000,
  },
  {
    id: 'phase-03-directory-ingestion-recovery',
    command: ['bun', 'packages/evaluation/src/directory-refresh-smoke.ts'],
    maximumMilliseconds: 30_000,
  },
  {
    id: 'phase-04-structured-data-full-corpus',
    command: ['bun', 'packages/evaluation/src/corpus-eval.ts'],
    maximumMilliseconds: 600_000,
    environment: {
      DATA_ENGINE_INTEGRATION: '1',
      DATABASE_URL: databaseUrl,
      DATA_ENGINE_TOKEN: dataEngineToken,
    },
  },
  {
    id: 'phase-05-bounded-planning-research',
    command: ['bun', 'packages/evaluation/src/run-phase-05-evaluation.ts', '--check-and-generate'],
    maximumMilliseconds: 60_000,
  },
  {
    id: 'phase-06-recursive-analysis',
    command: ['bun', 'packages/evaluation/src/run-phase-06-recursive-evaluation.ts', '--check'],
    maximumMilliseconds: 600_000,
  },
  {
    id: 'phase-07-hybrid-research',
    command: ['bun', 'packages/evaluation/src/run-phase-07-hybrid-evaluation.ts', '--check'],
    maximumMilliseconds: 60_000,
  },
  {
    id: 'phase-08-report-provenance',
    command: ['bun', 'packages/evaluation/src/run-report-fidelity-evaluation.ts', '--check'],
    maximumMilliseconds: 60_000,
  },
  ...selectedPerformanceGates.map(performanceGate),
  {
    id: 'unit-regression-suite',
    command: [
      'bun', 'test', '--timeout', '30000', '--max-concurrency', '1',
      '--path-ignore-patterns', '**/e2e/**',
      '--path-ignore-patterns', [
        'packages/workflows/test/research-run.test.ts',
        'packages/research-engine/test/retry-policy.test.ts',
        'apps/api/src/routes/research-events.test.ts',
        'apps/web/src/hooks/useSSE.test.ts',
      ].join('|'),
      './apps', './packages',
    ],
    maximumMilliseconds: 180_000,
  },
  {
    id: 'postgresql-data-engine-integration',
    command: [
      'bun', 'test', '--timeout', '30000', '--max-concurrency', '1',
      '--path-ignore-patterns', [
        'apps/worker/test/research-replay.integration.test.ts',
        'apps/worker/src/jobs/reindex-source-text.integration.test.ts',
        'packages/data-engine/test/sidecar.integration.test.ts',
      ].join('|'),
      'integration.test.ts',
    ],
    maximumMilliseconds: 300_000,
    environment: {
      DATA_ENGINE_INTEGRATION: '1',
      DATABASE_URL: databaseUrl,
      DATA_ENGINE_TOKEN: dataEngineToken,
    },
  },
  {
    id: 'deployment-recovery-proof',
    command: ['bun', 'scripts/recovery-proof.ts'],
    maximumMilliseconds: 300_000,
    environment: {
      DATABASE_URL: 'postgres://struct:struct@127.0.0.1:5432/struct_recovery_test',
      STRUCT_ALLOW_DESTRUCTIVE_RESET: 'struct_recovery_test',
      ARTIFACT_STORAGE_ROOT: '.local/artifacts_recovery_test',
      RECOVERY_RETURN_ARTIFACT_STORAGE_ROOT: '.local/artifacts',
      DATA_ENGINE_TOKEN: dataEngineToken,
    },
  },
  {
    id: 'production-build',
    command: ['bun', 'run', 'build'],
    maximumMilliseconds: 180_000,
  },
  {
    id: 'playwright-browser-readiness',
    command: ['bunx', 'playwright', 'install', 'chromium'],
    maximumMilliseconds: 180_000,
  },
  {
    id: 'playwright-accessibility-responsive-ui',
    command: [
      'bun', 'test', '--timeout', '60000', '--max-concurrency', '1',
      './apps/web/e2e',
    ],
    maximumMilliseconds: 180_000,
  },
  { id: 'typecheck', command: ['bun', 'run', 'typecheck'], maximumMilliseconds: 180_000 },
  {
    id: 'lint',
    command: ['bun', '--bun', 'eslint', '.', '--max-warnings', '0'],
    maximumMilliseconds: 180_000,
  },
  { id: 'import-boundaries', command: ['bun', 'run', 'lint:imports'], maximumMilliseconds: 120_000 },
  { id: 'documentation', command: ['bun', 'run', 'docs:lint'], maximumMilliseconds: 60_000 },
  { id: 'secret-scan', command: ['bun', 'run', 'secrets:scan'], maximumMilliseconds: 60_000 },
]

const evidenceDefinitions: readonly EvidenceDefinition[] = [
  { id: 'phase-02-document-retrieval', path: 'packages/evaluation/results/phase-02-document-evaluation.json', expectedOutcome: 'passed' },
  { id: 'phase-03-directory-ingestion', path: 'packages/evaluation/results/phase-03-directory-refresh-evaluation.json', expectedOutcome: 'passed' },
  { id: 'phase-04-structured-data', path: 'packages/evaluation/results/phase-04-evaluation-v1.json', expectedOutcome: 'passed' },
  { id: 'phase-05-bounded-research', path: 'packages/evaluation/results/phase-05-evaluation-v1.json', expectedOutcome: 'passed' },
  { id: 'phase-06-recursive-analysis', path: 'packages/evaluation/results/phase-06-recursive-analysis-v1.json', expectedOutcome: 'passed' },
  { id: 'phase-07-hybrid-research', path: 'packages/evaluation/results/phase-07-hybrid-research-v1.json', expectedOutcome: 'passed' },
  { id: 'phase-08-report-fidelity', path: 'packages/evaluation/results/phase-08-report-fidelity-v1.json', expectedOutcome: 'passed' },
  { id: 'v1-performance-resilience', path: 'packages/evaluation/results/v1-performance-resilience-v1.json', expectedOutcome: 'passed' },
]

const sourceEvidencePaths = [
  'scripts/v1-evaluation-campaign.ts',
  'scripts/v1-performance-gate.ts',
  'scripts/production-operations.ts',
  'scripts/recovery-proof.ts',
  'apps/web/e2e/support/theme-readiness.ts',
] as const

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value !== null && typeof value === 'object') {
    return `{${Object.entries(value).sort(([left], [right]) =>
      left.localeCompare(right)).map(([key, entry]) =>
      `${JSON.stringify(key)}:${canonical(entry)}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function sha256(value: string | Uint8Array): string {
  return new Bun.CryptoHasher('sha256').update(value).digest('hex')
}

async function readJson(path: string): Promise<Record<string, unknown>> {
  const parsed: unknown = JSON.parse(await Bun.file(resolve(repositoryRoot, path)).text())
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Expected object evidence at ${path}`)
  }
  return parsed as Record<string, unknown>
}

async function executeGate(gate: CampaignGate): Promise<void> {
  if (selectedPerformanceGates.some((id) => id === gate.id)) {
    await executeLiveGate(gate)
    return
  }
  const child = Bun.spawn([...gate.command], {
    cwd: repositoryRoot,
    env: { ...process.env, ...gate.environment },
    stdout: 'inherit',
    stderr: 'inherit',
  })
  let timeout: ReturnType<typeof setTimeout> | undefined
  const outcome = await Promise.race([
    child.exited.then((exitCode) => ({ exitCode, timedOut: false as const })),
    new Promise<{ readonly exitCode: -1; readonly timedOut: true }>((resolveTimeout) => {
      timeout = setTimeout(
        () => resolveTimeout({ exitCode: -1, timedOut: true }),
        gate.maximumMilliseconds,
      )
    }),
  ]).finally(() => {
    if (timeout !== undefined) clearTimeout(timeout)
  })
  if (outcome.timedOut) {
    child.kill()
    await child.exited
    throw new Error(`${gate.id} timed out after ${gate.maximumMilliseconds}ms`)
  }
  if (outcome.exitCode !== 0) {
    throw new Error(`${gate.id} failed with exit ${outcome.exitCode}`)
  }
}

async function buildResult() {
  const evidence = await Promise.all(evidenceDefinitions.map(async (definition) => {
    const absolute = resolve(repositoryRoot, definition.path)
    const bytes = await Bun.file(absolute).text()
    const value = await readJson(definition.path)
    const observedOutcome = value['status'] ?? (value['passed'] === true ? 'passed' : 'failed')
    if (observedOutcome !== definition.expectedOutcome) {
      throw new Error(`${definition.id} evidence did not pass`)
    }
    return { ...definition, sha256: sha256(bytes) }
  }))
  const packageManifest = await Bun.file(resolve(repositoryRoot, 'package.json')).text()
  const dependencyLock = await Bun.file(resolve(repositoryRoot, 'bun.lock')).arrayBuffer()
  const composeContract = await Bun.file(resolve(repositoryRoot, 'docker-compose.yml')).text()
  const remediation = await Bun.file(resolve(repositoryRoot, remediationPath)).text()
  const sourceEvidence = await Promise.all(sourceEvidencePaths.map(async (path) => ({
    path,
    sha256: sha256(await Bun.file(resolve(repositoryRoot, path)).text()),
  })))
  const body = {
    schemaVersion: '1.0.0',
    campaignId: 'struct-v1-release-evaluation-v1',
    status: 'passed' as const,
    environment: {
      runtime: `bun-${Bun.version}`,
      platform: platform(),
      architecture: arch(),
      packageManifestSha256: sha256(packageManifest),
      dependencyLockSha256: sha256(new Uint8Array(dependencyLock)),
      composeContractSha256: sha256(composeContract),
    },
    gates: campaignGates.map(({ id, command, maximumMilliseconds }) => ({
      id,
      command,
      maximumMilliseconds,
      status: 'passed' as const,
    })),
    evidence,
    sourceEvidence,
    remediation: {
      path: remediationPath,
      sha256: sha256(remediation),
    },
    failedCriteria: 0,
  }
  return { ...body, reportSha256: sha256(canonical(body)) }
}

function renderReport(result: Awaited<ReturnType<typeof buildResult>>): string {
  return [
    '# v1 Evaluation Campaign',
    '',
    `- Status: **${result.status}**`,
    `- Campaign: \`${result.campaignId}\``,
    `- Runtime: \`${result.environment.runtime}\` on \`${result.environment.platform}-${result.environment.architecture}\``,
    `- Gates: ${result.gates.length} passed, ${result.failedCriteria} failed criteria`,
    `- Evidence artifacts: ${result.evidence.length}, all hash-qualified`,
    `- Report SHA-256: \`${result.reportSha256}\``,
    `- Remediation log: [${result.remediation.path}](../operations/v1-evaluation-remediation.md)`,
    '',
    'The bounded `bun run v1:evaluate` command composes the existing phase evaluators and hardening gates. It does not replace their owner thresholds. A timeout, nonzero process exit, stale artifact, failed evidence status, or deterministic report mismatch fails closed.',
    '',
  ].join('\n')
}

export async function runCampaign(mode: 'check' | 'generate'): Promise<void> {
  const ids = campaignGates.map(({ id }) => id)
  if (new Set(ids).size !== ids.length) throw new Error('Campaign contains duplicate gate ids')
  for (const gate of campaignGates) {
    process.stdout.write(`\n[v1 evaluation] ${gate.id}\n`)
    await executeGate(gate)
  }
  const result = await buildResult()
  const expectedResult = `${canonical(result)}\n`
  const expectedReport = renderReport(result)
  if (mode === 'generate') {
    await Bun.write(resultPath, expectedResult)
    await Bun.write(reportPath, expectedReport)
  } else {
    const [actualResult, actualReport] = await Promise.all([
      Bun.file(resultPath).text(),
      Bun.file(reportPath).text(),
    ])
    if (actualResult !== expectedResult) throw new Error('v1 evaluation result is stale or nondeterministic')
    if (actualReport !== expectedReport) throw new Error('v1 evaluation report is stale or nondeterministic')
  }
  process.stdout.write(`${JSON.stringify({
    status: result.status,
    gates: result.gates.length,
    failedCriteria: result.failedCriteria,
    reportSha256: result.reportSha256,
  }, null, 2)}\n`)
}

if (import.meta.main) {
  runCampaign(process.argv.includes('--generate') ? 'generate' : 'check').catch(
    (cause: unknown) => {
      process.stderr.write(`v1 evaluation campaign failed: ${cause instanceof Error ? cause.message : String(cause)}\n`)
      process.exitCode = 1
    },
  )
}
