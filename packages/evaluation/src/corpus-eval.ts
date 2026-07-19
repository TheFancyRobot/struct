import { resolve } from 'node:path'
import { Config, Effect, Redacted } from 'effect'
import { runPhase04Evaluation } from './phase-04-evaluation.js'

const repositoryRoot = resolve(import.meta.dir, '../../..')

function argument(name: string): string | undefined {
  const index = Bun.argv.indexOf(name)
  return index === -1 ? undefined : Bun.argv[index + 1]
}

const profile = argument('--profile') === 'smoke' ? 'smoke' : 'full'
const outputRoot = resolve(
  repositoryRoot,
  argument('--out') ?? `.local/evaluation/phase-04-${profile}`,
)
const reportPath = resolve(
  repositoryRoot,
  argument('--report')
    ?? (profile === 'full'
      ? 'packages/evaluation/results/phase-04-evaluation-v1.json'
      : `${outputRoot}/evaluation-report.json`),
)

const result = await Effect.runPromise(Effect.gen(function* () {
  const artifactRoot = yield* Config.string('ARTIFACT_STORAGE_ROOT').pipe(
    Config.withDefault('.local/artifacts'),
  )
  const databaseUrl = yield* Config.redacted('DATABASE_URL').pipe(
    Config.withDefault(
      Redacted.make('postgres://struct:struct@127.0.0.1:5432/struct'),
    ),
  )
  const dataEngineUrl = yield* Config.string('DATA_ENGINE_URL').pipe(
    Config.withDefault('http://127.0.0.1:4300'),
  )
  const dataEngineToken = yield* Config.redacted('DATA_ENGINE_TOKEN').pipe(
    Config.withDefault(Redacted.make('struct-local-data-engine-token')),
  )
  return yield* runPhase04Evaluation({
    profile,
    outputRoot,
    artifactRoot: resolve(repositoryRoot, artifactRoot),
    databaseUrl: Redacted.value(databaseUrl),
    dataEngineUrl,
    dataEngineToken: Redacted.value(dataEngineToken),
    reportPath,
  })
}).pipe(Effect.scoped))

await Bun.write(Bun.stdout, canonicalOutput({
  status: result.report.status,
  profile,
  totalFiles: result.report.corpus.totalFiles,
  reportSha256: result.report.reportSha256,
  reportPath,
  counts: result.report.counts,
  timings: result.timings,
}))

function canonicalOutput(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`
}
