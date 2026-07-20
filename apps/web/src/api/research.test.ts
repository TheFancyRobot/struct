import { afterEach, describe, expect, it } from 'bun:test'
import {
  CitationId,
  ProjectId,
  ResearchRunId,
  ResearchThreadId,
  WorkspaceId,
} from '@struct/domain'
import {
  cancelResearchRun,
  fetchCitation,
  fetchRecursiveAnalysis,
} from './research'

const originalFetch = globalThis.fetch
const projectId = ProjectId.make('750e8400-e29b-41d4-a716-446655440001')
const threadId = ResearchThreadId.make('750e8400-e29b-41d4-a716-446655440002')
const citationId = CitationId.make('750e8400-e29b-41d4-a716-446655440003')
const runId = ResearchRunId.make('750e8400-e29b-41d4-a716-446655440004')
const workspaceId = WorkspaceId.make('750e8400-e29b-41d4-a716-446655440005')

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
