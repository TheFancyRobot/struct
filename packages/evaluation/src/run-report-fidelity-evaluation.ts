import { Effect } from 'effect'
import {
  REPORT_FIDELITY_LIMITS,
  runReportFidelityEvaluationWithinLimits,
  serializeReportFidelityEvaluationReport,
  verifyReportFidelityEvaluationReport,
} from './report-fidelity.js'

const resultPath = new URL(
  '../results/phase-08-report-fidelity-v1.json',
  import.meta.url,
)
const generate = process.argv.includes('--generate')
const check = process.argv.includes('--check')

if (!generate && !check) {
  throw new Error('Use --generate or --check')
}

const measured = await Effect.runPromise(
  runReportFidelityEvaluationWithinLimits(),
)
const report = measured.report
if (
  measured.observedElapsedMilliseconds
  > REPORT_FIDELITY_LIMITS.maximumElapsedMilliseconds
) {
  throw new Error('Report fidelity evaluation exceeded its wall-clock limit')
}
await Bun.write(
  Bun.stderr,
  `report-fidelity wall-clock ${measured.observedElapsedMilliseconds}ms/${REPORT_FIDELITY_LIMITS.maximumElapsedMilliseconds}ms\n`,
)
const serialized = serializeReportFidelityEvaluationReport(report)
await Effect.runPromise(verifyReportFidelityEvaluationReport(serialized))

if (check) {
  const tracked = await Bun.file(resultPath).text()
  await Effect.runPromise(verifyReportFidelityEvaluationReport(tracked))
  if (tracked !== serialized) {
    throw new Error('Tracked report fidelity evaluation is not reproducible')
  }
}

if (generate) await Bun.write(resultPath, serialized)

await Bun.write(Bun.stdout, serialized)
