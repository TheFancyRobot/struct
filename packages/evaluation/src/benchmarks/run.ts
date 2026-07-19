import { cpus, freemem, platform, release, totalmem } from 'node:os'
import { resolve } from 'node:path'
import { Config, Effect, Redacted } from 'effect'
import { runPhase04Evaluation } from '../phase-04-evaluation.js'

const repositoryRoot = resolve(import.meta.dir, '../../../..')
const profile = Bun.argv.includes('--smoke') ? 'smoke' : 'full'
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
    outputRoot: resolve(
      repositoryRoot,
      `.local/evaluation/phase-04-benchmark-${profile}`,
    ),
    artifactRoot: resolve(repositoryRoot, artifactRoot),
    databaseUrl: Redacted.value(databaseUrl),
    dataEngineUrl,
    dataEngineToken: Redacted.value(dataEngineToken),
  })
}).pipe(Effect.scoped))

await Bun.write(Bun.stdout, `${JSON.stringify({
  schemaVersion: '1.0.0',
  status: result.report.status,
  profile,
  reportSha256: result.report.reportSha256,
  environment: {
    bun: Bun.version,
    platform: platform(),
    release: release(),
    cpuModel: cpus()[0]?.model ?? 'unknown',
    logicalCpuCount: cpus().length,
    totalMemoryBytes: totalmem(),
    freeMemoryBytesAtCompletion: freemem(),
  },
  timingsMs: result.timings,
}, null, 2)}\n`)
