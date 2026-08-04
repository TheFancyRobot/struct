import { stripBasePath } from './base-path'

/** Returns the descriptive browser title for a workspace route. */
export function pageTitle(pathname: string, basePath: string): string {
  const path = stripBasePath(pathname, basePath)

  if (path === null) return 'Struct — Research Workspace'

  if (path === '/') return 'Projects — Struct'
  if (/^\/projects\/[^/]+$/.test(path)) return 'Conversation — Struct'
  if (/^(?:\/sources|\/projects\/[^/]+\/sources)$/.test(path)) return 'Sources — Struct'
  if (/^\/projects\/[^/]+\/notes(?:\/[^/]+)?$/.test(path)) return 'Notes — Struct'
  if (/^\/projects\/[^/]+\/research\/[^/]+\/citation\/[^/]+$/.test(path)) return 'Citation — Struct'
  if (/^\/projects\/[^/]+\/research\/[^/]+(?:\/runs\/[^/]+)?$/.test(path)) return 'Research — Struct'
  if (/^\/projects\/[^/]+\/notebook$/.test(path)) return 'Notebook — Struct'
  return 'Page Not Found — Struct'
}
