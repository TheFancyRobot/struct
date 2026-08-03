import { Schema } from 'effect'
import { WorkspaceId } from '@struct/domain'

/**
 * The browser is configured for one authenticated API workspace. This is a
 * public routing scope, not a credential; the proxy keeps the bearer token on
 * the server side.
 */
export function configuredWorkspaceId(
  value: unknown = import.meta.env.VITE_API_WORKSPACE_ID,
): typeof WorkspaceId.Type {
  return Schema.decodeUnknownSync(WorkspaceId)(value)
}
