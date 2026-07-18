/**
 * Config — Effect Config.* for the API application.
 *
 * Reads environment variables through Effect's Config system, not process.env.
 * This is the boot boundary: Config.* resolves at app startup.
 */

import { Config } from 'effect'

/** API port configuration (default: 3001). */
export const apiPortConfig = Config.number('API_PORT').pipe(
  Config.withDefault(3001),
)

/** Database connection URL (required, no default). */
export const databaseUrlConfig = Config.string('DATABASE_URL')
