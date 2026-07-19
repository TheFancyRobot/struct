import { Effect } from 'effect'
import { runPhase02Evaluation } from './run-phase-02-evaluation.js'

const report = await Effect.runPromise(runPhase02Evaluation())
await Bun.write(Bun.stdout, `${JSON.stringify(report, null, 2)}\n`)

if (!report.passed) {
  process.exitCode = 1
}
