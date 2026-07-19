import { Effect } from 'effect'
import { evaluateDirectoryRefreshRecovery } from './directory-refresh.js'

const report = await Effect.runPromise(evaluateDirectoryRefreshRecovery())
const outputPath = process.argv[2]

if (outputPath === undefined) {
  await Bun.write(Bun.stdout, `${JSON.stringify(report, null, 2)}\n`)
} else {
  await Bun.write(outputPath, `${JSON.stringify(report, null, 2)}\n`)
}

if (!report.passed) {
  process.exitCode = 1
}
