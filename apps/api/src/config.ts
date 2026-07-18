/**
 * Config — Effect Config.* for the API application.
 *
 * Reads environment variables through Effect's Config system, not process.env.
 * This is the boot boundary: Config.* resolves at app startup.
 *
 * DATABASE_URL is not part of the walking-skeleton boot path; it will be
 * added in STEP-01-02 when migrations and database connections are implemented.
 */

import { Config } from 'effect'

/** API port configuration (default: 3001). */
export const apiPortConfig = Config.number('API_PORT').pipe(
  Config.withDefault(3001),
)
