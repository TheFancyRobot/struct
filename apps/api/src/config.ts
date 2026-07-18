/**
 * Config — Effect Config.* for the API application.
 *
 * Reads environment variables through Effect's Config system, not process.env.
 * This is the boot boundary: Config.* resolves at app startup.
 */

import { Config } from 'effect'

const positive = (name: string) => ({
  message: `${name} must be positive`,
  validation: (value: number) => value > 0,
})

/** API port configuration (default: 3001). */
export const apiPortConfig = Config.number('API_PORT').pipe(
  Config.withDefault(3001),
)

/** Database connection URL (required, no default). */
export const databaseUrlConfig = Config.string('DATABASE_URL')

/** Local filesystem artifact root for upload staging. */
export const artifactStorageRootConfig = Config.string('ARTIFACT_STORAGE_ROOT').pipe(
  Config.withDefault('./.local/artifacts'),
)

/** Maximum bytes accepted for one walking-slice text source. */
export const maxTextSourceBytesConfig = Config.number('MAX_TEXT_SOURCE_BYTES').pipe(
  Config.withDefault(1_048_576),
  Config.validate(positive('MAX_TEXT_SOURCE_BYTES')),
)
