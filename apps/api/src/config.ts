/**
 * Config — Effect Config.* for the API application.
 *
 * Reads environment variables through Effect's Config system, not process.env.
 * This is the boot boundary: Config.* resolves at app startup.
 */

import { Config, Redacted } from 'effect'
import { WorkspaceId } from '@struct/domain'

const positive = (name: string) => ({
  message: `${name} must be positive`,
  validation: (value: number) => value > 0,
})

/** API port configuration (default: 3001). */
export const apiPortConfig = Config.number('API_PORT').pipe(
  Config.withDefault(3001),
)

/** Database connection URL (required, no default). */
export const databaseUrlConfig = Config.redacted('DATABASE_URL')

/** Single-user API bearer credential used until user/session auth lands. */
export const apiAuthTokenConfig = Config.redacted('API_AUTH_TOKEN').pipe(
  Config.validate({
    message: 'API_AUTH_TOKEN must contain at least 16 characters',
    validation: (value) => Redacted.value(value).length >= 16,
  }),
)

/** Workspace owned by the configured single-user API identity. */
export const apiWorkspaceIdConfig = Config.string('API_WORKSPACE_ID').pipe(
  Config.mapAttempt((value) => WorkspaceId.make(value)),
)

/** Local filesystem artifact root for upload staging. */
export const artifactStorageRootConfig = Config.string('ARTIFACT_STORAGE_ROOT').pipe(
  Config.withDefault('./.local/artifacts'),
)

/** Maximum bytes accepted for one walking-slice text source. */
export const maxTextSourceBytesConfig = Config.number('MAX_TEXT_SOURCE_BYTES').pipe(
  Config.withDefault(1_048_576),
  Config.validate(positive('MAX_TEXT_SOURCE_BYTES')),
)
