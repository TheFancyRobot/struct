/* eslint-disable no-unused-vars -- Babel's parser does not mark type-only imports as used. */
import { Effect, Schema } from 'effect'
import {
  CitationDetail,
  JobQueueId,
  ResearchRunId,
  ResearchStatus,
  ResearchThreadId,
  ResearchRun,
  ResearchThread,
  RecursiveRunProgress,
} from '@struct/domain'
import type * as typeDomain from '@struct/domain'
import { apiPath, basePathFromPublicBaseUrl } from '../base-path'

const appBasePath = basePathFromPublicBaseUrl(import.meta.env.BASE_URL)

const ResearchThreadList = Schema.Struct({ items: Schema.Array(ResearchThread) })
const ResearchThreadHistory = Schema.Struct({
  thread: ResearchThread,
  runs: Schema.Array(ResearchRun),
})
const StartedResearch = Schema.Struct({
  threadId: ResearchThreadId,
  runId: ResearchRunId,
  jobId: JobQueueId,
  status: ResearchStatus,
})

async function researchJson(response: Response): Promise<unknown> {
  const body = await response.json()
  if (!response.ok) {
    throw new Error(response.status === 404
      ? 'This conversation is no longer available.'
      : 'Research could not be loaded. Try again.')
  }
  return body
}

export async function fetchResearchThreads(projectId: typeDomain.ProjectId) {
  const response = await fetch(
    apiPath(`/projects/${projectId}/research`, appBasePath),
    { signal: AbortSignal.timeout(10_000) },
  )
  return Schema.decodeUnknownPromise(ResearchThreadList)(await researchJson(response))
}

export async function fetchResearchThread(
  projectId: typeDomain.ProjectId,
  threadId: typeDomain.ResearchThreadId,
) {
  const response = await fetch(
    apiPath(`/projects/${projectId}/research/${threadId}`, appBasePath),
    { signal: AbortSignal.timeout(10_000) },
  )
  return Schema.decodeUnknownPromise(ResearchThreadHistory)(await researchJson(response))
}

export async function submitResearch(
  projectId: typeDomain.ProjectId,
  question: string,
  sourceVersionIds: ReadonlyArray<typeDomain.SourceVersionId>,
  threadId?: typeDomain.ResearchThreadId,
) {
  const response = await fetch(
    apiPath(
      threadId === undefined
        ? `/projects/${projectId}/research`
        : `/projects/${projectId}/research/${threadId}`,
      appBasePath,
    ),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, sourceVersionIds }),
      signal: AbortSignal.timeout(10_000),
    },
  )
  return Schema.decodeUnknownPromise(StartedResearch)(await researchJson(response))
}

export async function fetchCitation(
  projectId: typeDomain.ProjectId,
  threadId: typeDomain.ResearchThreadId,
  citationId: typeDomain.CitationId,
): Promise<CitationDetail> {
  let response: Response
  try {
    response = await fetch(
      apiPath(`/projects/${projectId}/research/${threadId}/citation/${citationId}`, appBasePath),
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
      apiPath(`/projects/${projectId}/runs/${runId}/recursive-analysis`, appBasePath),
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
      `${apiPath(`/projects/${projectId}/runs/${runId}/cancel`, appBasePath)}?workspaceId=${workspaceId}`,
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
