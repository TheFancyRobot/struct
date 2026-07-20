import { mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import {
  runHybridResearchEvaluation,
  serializeHybridResearchEvaluationReport,
  verifyHybridResearchEvaluationReport,
} from './hybrid-research.js'
import { Effect } from 'effect'

const root = resolve(import.meta.dir, '../../..')
const reportPath = resolve(
  root,
  'packages/evaluation/results/phase-07-hybrid-research-v1.json',
)
const mode = process.argv[2] ?? '--check'
const report = await Effect.runPromise(runHybridResearchEvaluation())
const serialized = serializeHybridResearchEvaluationReport(report)

if (mode === '--generate') {
  await mkdir(dirname(reportPath), { recursive: true })
  await Bun.write(reportPath, serialized)
} else if (mode === '--check') {
  const tracked = await Bun.file(reportPath).text()
  await Effect.runPromise(verifyHybridResearchEvaluationReport(tracked))
  if (tracked !== serialized) {
    throw new Error('Tracked Phase 07 report differs from current evaluation')
  }
} else {
  throw new Error(`Unsupported Phase 07 evaluation mode: ${mode}`)
}
