import { mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { Config, Effect } from 'effect'
import {
  readPhase05LiveIntegrationEvidence,
  runPhase05Evaluation,
  serializePhase05EvaluationReport,
  verifyPhase05TrackedReportIntegrity,
} from './phase-05-evaluation.js'

const root = resolve(import.meta.dir, '../../..')
const evidencePath = resolve(
  root,
  'packages/evaluation/results/phase-05-live-evidence-v1.json',
)
const reportPath = resolve(
  root,
  'packages/evaluation/results/phase-05-evaluation-v1.json',
)
const mode = process.argv[2] ?? '--check-and-generate'
const [first, second, evidence] = await Effect.runPromise(
  Effect.gen(function* () {
    const configuredSourcePath = yield* Config.string(
      'PHASE_05_LIVE_EVIDENCE',
    ).pipe(
      Config.withDefault(
        mode === '--generate'
          ? '.local/evaluation/phase-05-live-evidence.json'
          : 'packages/evaluation/results/phase-05-live-evidence-v1.json',
      ),
    )
    const evidence = yield* Effect.promise(() =>
      readPhase05LiveIntegrationEvidence(resolve(root, configuredSourcePath)))
    const first = yield* runPhase05Evaluation(evidence)
    const second = yield* runPhase05Evaluation(evidence)
    return [first, second, evidence] as const
  }),
)
const firstBytes = serializePhase05EvaluationReport(first)
const secondBytes = serializePhase05EvaluationReport(second)
if (
  first.reportSha256 !== second.reportSha256
  || firstBytes !== secondBytes
) {
  throw new Error('Phase 05 repeated report sections or hashes differ')
}
if (mode !== '--generate') {
  const trackedBytes = await Bun.file(reportPath).text()
  verifyPhase05TrackedReportIntegrity(trackedBytes, firstBytes)
}
if (mode === '--check-artifact-integrity') {
  await Bun.write(Bun.stdout, `${JSON.stringify({
    status: first.status,
    reportSha256: first.reportSha256,
    artifactIntegrity: 'passed',
  }, null, 2)}\n`)
} else if (mode !== '--generate' && mode !== '--check-and-generate') {
  throw new Error(`Unsupported Phase 05 evaluation mode: ${mode}`)
} else {
  await mkdir(dirname(reportPath), { recursive: true })
  await Bun.write(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`)
  await Bun.write(reportPath, firstBytes)
  await Bun.write(Bun.stdout, `${JSON.stringify({
    status: first.status,
    criteria: first.counts.criteria,
    reportSha256: first.reportSha256,
    byteIdenticalRepeatedReport: true,
  }, null, 2)}\n`)
}
