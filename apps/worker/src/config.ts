/**
 * Config — Effect Config.* for the worker application.
 *
 * Reads environment variables through Effect's Config system, not process.env.
 */

import { Config } from 'effect'

const positive = (name: string) => ({
  message: `${name} must be positive`,
  validation: (value: number) => value > 0,
})

/** Worker metrics port configuration (default: 3002). */
export const workerMetricsPortConfig = Config.number('WORKER_METRICS_PORT').pipe(
  Config.withDefault(3002),
)

/** Database connection URL (required, no default). */
export const databaseUrlConfig = Config.string('DATABASE_URL')

/** Local filesystem artifact root for finalized source artifacts. */
export const artifactStorageRootConfig = Config.string('ARTIFACT_STORAGE_ROOT').pipe(
  Config.withDefault('./.local/artifacts'),
)

/** Worker polling interval for durable jobs. */
export const workerPollIntervalMsConfig = Config.number('WORKER_POLL_INTERVAL_MS').pipe(
  Config.withDefault(1000),
  Config.validate(positive('WORKER_POLL_INTERVAL_MS')),
)

/** Age after which in-progress jobs are considered stale. */
export const workerJobStaleMsConfig = Config.number('WORKER_JOB_STALE_MS').pipe(
  Config.withDefault(300000),
  Config.validate(positive('WORKER_JOB_STALE_MS')),
)
