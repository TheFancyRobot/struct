/* eslint-disable no-unused-vars -- Babel's parser does not mark type-only imports as used. */
import { Effect, Schema } from 'effect'
import {
  CitationDetail,
  RecursiveRunProgress,
} from '@struct/domain'
import type * as typeDomain from '@struct/domain'

export async function fetchCitation(
  projectId: typeDomain.ProjectId,
  threadId: typeDomain.ResearchThreadId,
  citationId: typeDomain.CitationId,
): Promise<CitationDetail> {
  let response: Response
  try {
    response = await fetch(
      `/api/projects/${projectId}/research/${threadId}/citation/${citationId}`,
      { signal: AbortSignal.timeout(10_000) },
    )
  } catch (error) {
    if (
      error instanceof DOMException
      && (error.name === 'AbortError' || error.name === 'TimeoutError')
    ) {
      throw new Error('The citation could not be loaded. Try again.')
    }
    throw error
  }
  if (!response.ok) {
    throw new Error(
      response.status === 404
        ? 'This citation is no longer available.'
        : 'The citation could not be loaded. Try again.',
    )
  }
  const body: unknown = await response.json()
  return Effect.runPromise(Schema.decodeUnknown(CitationDetail)(body))
}

export async function fetchRecursiveAnalysis(
  projectId: typeDomain.ProjectId,
  runId: typeDomain.ResearchRunId,
): Promise<typeDomain.RecursiveRunProgress | null> {
  let response: Response
  try {
    response = await fetch(
      `/api/projects/${projectId}/runs/${runId}/recursive-analysis`,
      { signal: AbortSignal.timeout(10_000) },
    )
  } catch (error) {
    if (
      error instanceof DOMException
      && (error.name === 'AbortError' || error.name === 'TimeoutError')
    ) {
      throw new Error('Recursive analysis could not be loaded. Try again.')
    }
    throw error
  }
  if (response.status === 404) return null
  if (!response.ok) {
    throw new Error('Recursive analysis could not be loaded. Try again.')
  }
  if (!response.headers.get('Content-Type')?.includes('application/json')) {
    return null
  }
  return Effect.runPromise(
    Schema.decodeUnknown(RecursiveRunProgress)(await response.json()),
  )
}

export async function cancelResearchRun(
  projectId: typeDomain.ProjectId,
  runId: typeDomain.ResearchRunId,
  workspaceId: typeDomain.WorkspaceId,
): Promise<void> {
  let response: Response
  try {
    response = await fetch(
      `/api/projects/${projectId}/runs/${runId}/cancel?workspaceId=${workspaceId}`,
      {
        method: 'POST',
        headers: { 'Idempotency-Key': `web-cancel-${runId}` },
        signal: AbortSignal.timeout(10_000),
      },
    )
  } catch (error) {
    if (
      error instanceof DOMException
      && (error.name === 'AbortError' || error.name === 'TimeoutError')
    ) {
      throw new Error('Cancellation could not be requested. Try again.')
    }
    throw error
  }
  if (!response.ok) {
    throw new Error('Cancellation could not be requested. Try again.')
  }
}
