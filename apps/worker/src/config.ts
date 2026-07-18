/**
 * Config — Effect Config.* for the worker application.
 *
 * Reads environment variables through Effect's Config system, not process.env.
 *
 * DATABASE_URL is not part of the walking-skeleton boot path; it will be
 * added in STEP-01-02 when migrations and database connections are implemented.
 */

import { Config } from 'effect'

/** Worker metrics port configuration (default: 3002). */
export const workerMetricsPortConfig = Config.number('WORKER_METRICS_PORT').pipe(
  Config.withDefault(3002),
)
