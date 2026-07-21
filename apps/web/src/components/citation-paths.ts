import { publicBasePathFromEnv, withBasePath } from '../base-path'

export function researchCitationPath(
  projectId: string,
  threadId: string,
  citationId: string,
): string {
  return withBasePath(
    `/projects/${projectId}/research/${threadId}/citation/${citationId}`,
    publicBasePathFromEnv(import.meta.env),
  )
}

export function reportCitationPath(
  projectId: string,
  threadId: string,
  citationId: string,
  returnTo: string,
): string {
  return `${researchCitationPath(projectId, threadId, citationId)}?returnTo=${encodeURIComponent(returnTo)}`
}
