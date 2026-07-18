/**
 * Config — Effect Config.* for the worker application.
 *
 * Reads environment variables through Effect's Config system, not process.env.
 */

import { Config } from 'effect'

/** Worker metrics port configuration (default: 3002). */
export const workerMetricsPortConfig = Config.number('WORKER_METRICS_PORT').pipe(
  Config.withDefault(3002),
)

/** Database connection URL (required, no default). */
export const databaseUrlConfig = Config.string('DATABASE_URL')
