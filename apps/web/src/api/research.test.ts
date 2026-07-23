import { afterEach, describe, expect, it } from 'bun:test'
import {
  CitationId,
  DatasetCitationId,
  JobQueueId,
  ProjectId,
  ResearchRunId,
  ResearchThreadId,
  SourceVersionId,
  WorkspaceId,
} from '@struct/domain'
import {
  cancelResearchRun,
  fetchCitation,
  fetchEvidence,
  fetchRecursiveAnalysis,
  fetchResearchThread,
  submitResearch,
} from './research'

const originalFetch = globalThis.fetch
const projectId = ProjectId.make('750e8400-e29b-41d4-a716-446655440001')
const threadId = ResearchThreadId.make('750e8400-e29b-41d4-a716-446655440002')
const citationId = CitationId.make('750e8400-e29b-41d4-a716-446655440003')
const datasetCitationId = DatasetCitationId.make(
  '750e8400-e29b-41d4-a716-446655440008',
)
const runId = ResearchRunId.make('750e8400-e29b-41d4-a716-446655440004')
const workspaceId = WorkspaceId.make('750e8400-e29b-41d4-a716-446655440005')
const sourceVersionId = SourceVersionId.make('750e8400-e29b-41d4-a716-446655440006')
const jobId = JobQueueId.make('750e8400-e29b-41d4-a716-446655440007')

const rejectFetchWith = (error: unknown) => {
  globalThis.fetch = Object.assign(
    async () => {
      throw error
    },
    { preconnect: originalFetch.preconnect },
  )
}

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('fetchCitation', () => {
  it('normalizes timeout failures for the citation viewer', async () => {
    rejectFetchWith(new DOMException('Timed out', 'TimeoutError'))

    await expect(
      fetchCitation(projectId, threadId, citationId),
    ).rejects.toThrow('The citation could not be loaded. Try again.')
  })

  it('normalizes abort failures for the citation viewer', async () => {
    rejectFetchWith(new DOMException('Aborted', 'AbortError'))

    await expect(
      fetchCitation(projectId, threadId, citationId),
    ).rejects.toThrow('The citation could not be loaded. Try again.')
  })

  it('preserves unrelated network failures', async () => {
    const networkFailure = new TypeError('Network unavailable')
    rejectFetchWith(networkFailure)

    await expect(
      fetchCitation(projectId, threadId, citationId),
    ).rejects.toBe(networkFailure)
  })
})

describe('fetchEvidence', () => {
  it('uses the exact run-scoped document and dataset paths', async () => {
    const urls: string[] = []
    globalThis.fetch = Object.assign(
      async (input: RequestInfo | URL) => {
        urls.push(String(input))
        return new Response('', { status: 404 })
      },
      { preconnect: originalFetch.preconnect },
    )

    await expect(
      fetchEvidence(projectId, threadId, runId, 'document', citationId),
    ).rejects.toThrow('no longer available')
    await expect(
      fetchEvidence(projectId, threadId, runId, 'dataset', datasetCitationId),
    ).rejects.toThrow('no longer available')

    expect(urls).toEqual([
      expect.stringContaining(
        `/projects/${projectId}/research/${threadId}/runs/${runId}`
        + `/evidence/document/${citationId}`,
      ),
      expect.stringContaining(
        `/projects/${projectId}/research/${threadId}/runs/${runId}`
        + `/evidence/dataset/${datasetCitationId}`,
      ),
    ])
  })
})

describe('fetchRecursiveAnalysis', () => {
  for (const name of ['AbortError', 'TimeoutError']) {
    it(`normalizes ${name} failures for recursive progress`, async () => {
      rejectFetchWith(new DOMException('Request interrupted', name))

      await expect(
        fetchRecursiveAnalysis(projectId, runId),
      ).rejects.toThrow('Recursive analysis could not be loaded. Try again.')
    })
  }

  it('preserves unrelated network failures', async () => {
    const networkFailure = new TypeError('Network unavailable')
    rejectFetchWith(networkFailure)

    await expect(
      fetchRecursiveAnalysis(projectId, runId),
    ).rejects.toBe(networkFailure)
  })
})

describe('cancelResearchRun', () => {
  for (const name of ['AbortError', 'TimeoutError']) {
    it(`normalizes ${name} failures for cancellation`, async () => {
      rejectFetchWith(new DOMException('Request interrupted', name))

      await expect(
        cancelResearchRun(projectId, runId, workspaceId),
      ).rejects.toThrow('Cancellation could not be requested. Try again.')
    })
  }

  it('preserves unrelated network failures', async () => {
    const networkFailure = new TypeError('Network unavailable')
    rejectFetchWith(networkFailure)

    await expect(
      cancelResearchRun(projectId, runId, workspaceId),
    ).rejects.toBe(networkFailure)
  })
})

describe('conversation requests', () => {
  it('continues the selected thread with the exact ready source scope', async () => {
    let url: string | undefined
    let body: unknown
    globalThis.fetch = Object.assign(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        url = String(input)
        body = JSON.parse(String(init?.body))
        return new Response(JSON.stringify({
          threadId,
          runId,
          jobId,
          status: 'pending',
        }), { headers: { 'Content-Type': 'application/json' } })
      },
      { preconnect: originalFetch.preconnect },
    )

    await submitResearch(projectId, 'Follow up', [sourceVersionId], threadId)

    expect(url).toEndWith(`/projects/${projectId}/research/${threadId}`)
    expect(body).toEqual({
      question: 'Follow up',
      sourceVersionIds: [sourceVersionId],
    })
  })

  it('decodes durable thread history after reload', async () => {
    globalThis.fetch = Object.assign(
      async () => new Response(JSON.stringify({
        thread: {
          id: threadId,
          projectId,
          title: 'First question',
          createdAt: 1,
          updatedAt: 2,
        },
        runs: [{
          id: runId,
          threadId,
          question: 'First question',
          status: 'completed',
          createdAt: 1,
          updatedAt: 2,
        }],
      }), { headers: { 'Content-Type': 'application/json' } }),
      { preconnect: originalFetch.preconnect },
    )

    const history = await fetchResearchThread(projectId, threadId)
    expect(history.runs[0]?.question).toBe('First question')
    expect(history.runs[0]?.createdAt).toBe(1n)
  })
})
