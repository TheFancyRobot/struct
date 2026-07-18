/**
 * apps/worker — Durable ingestion, research execution, and recovery.
 *
 * Responsibilities:
 * - Directory scanning, file extraction, dataset profiling
 * - Embedding jobs, recursive research execution
 * - Incremental refresh, materialized result generation
 * - Retry, cancellation, checkpoint, and resume
 * - DuckDB worker-child supervision
 *
 * Runtime entry point — Effect.runPromise at the application boundary.
 * Config is read via Effect Config.*, not process.env.
 * Invalid config causes the process to exit nonzero.
 */

import { Effect } from 'effect'
import { workerMetricsPortConfig } from './config'

const program = Effect.gen(function* () {
  const metricsPort = yield* workerMetricsPortConfig

  yield* Effect.log(`Worker starting (metrics on port ${metricsPort})`)
  yield* Effect.log('Worker skeleton placeholder — no jobs yet')

  // Keep alive
  yield* Effect.never
})

Effect.runPromise(program).catch((error) => {
  // Config or boot errors propagate here; log and exit nonzero
  console.error('Worker failed to start:', error)
  process.exit(1)
})
