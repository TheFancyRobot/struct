import { mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { CorpusPartitioning } from '@struct/research-engine'
import { Effect } from 'effect'
import {
  runPhase06RecursiveEvaluation,
  serializePhase06RecursiveEvaluationReport,
  verifyPhase06RecursiveEvaluationReport,
} from './recursive-analysis.js'

const root = resolve(import.meta.dir, '../../..')
const reportPath = resolve(
  root,
  'packages/evaluation/results/phase-06-recursive-analysis-v1.json',
)
const mode = process.argv[2] ?? '--check'
const started = performance.now()
const [first, second] = await Effect.runPromise(
  Effect.all([
    runPhase06RecursiveEvaluation(),
    runPhase06RecursiveEvaluation(),
  ], { concurrency: 1 }).pipe(
    Effect.provide(CorpusPartitioning.Default),
  ),
)
const firstBytes = serializePhase06RecursiveEvaluationReport(first)
const secondBytes = serializePhase06RecursiveEvaluationReport(second)
if (
  first.reportSha256 !== second.reportSha256
  || firstBytes !== secondBytes
) {
  throw new Error('Phase 06 repeated reports are not byte-identical')
}
if (mode === '--generate') {
  await mkdir(dirname(reportPath), { recursive: true })
  await Bun.write(reportPath, firstBytes)
} else if (mode === '--check') {
  const tracked = await Bun.file(reportPath).text()
  const parsed = verifyPhase06RecursiveEvaluationReport(tracked)
  if (serializePhase06RecursiveEvaluationReport(parsed) !== firstBytes) {
    throw new Error('Tracked Phase 06 report differs from current evaluation')
  }
} else {
  throw new Error(`Unsupported Phase 06 evaluation mode: ${mode}`)
}
await Bun.write(Bun.stdout, `${JSON.stringify({
  status: first.status,
  files: first.corpus.files,
  partitions: first.corpus.partitions,
  reportSha256: first.reportSha256,
  byteIdenticalRepeatedReport: true,
  measuredMilliseconds: Math.round(performance.now() - started),
  timingGate: null,
}, null, 2)}\n`)
