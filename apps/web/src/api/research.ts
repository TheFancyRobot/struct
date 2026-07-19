/* eslint-disable no-unused-vars -- Babel's parser does not mark type-only imports as used. */
import { Effect, Schema } from 'effect'
import {
  CitationDetail,
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
