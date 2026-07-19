import { afterEach, describe, expect, it } from 'bun:test'
import { CitationId, ProjectId, ResearchThreadId } from '@struct/domain'
import { fetchCitation } from './research'

const originalFetch = globalThis.fetch
const projectId = ProjectId.make('750e8400-e29b-41d4-a716-446655440001')
const threadId = ResearchThreadId.make('750e8400-e29b-41d4-a716-446655440002')
const citationId = CitationId.make('750e8400-e29b-41d4-a716-446655440003')

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('fetchCitation', () => {
  it('normalizes timeout failures for the citation viewer', async () => {
    globalThis.fetch = Object.assign(
      async () => {
        throw new DOMException('Timed out', 'TimeoutError')
      },
      { preconnect: originalFetch.preconnect },
    )

    await expect(
      fetchCitation(projectId, threadId, citationId),
    ).rejects.toThrow('The citation could not be loaded. Try again.')
  })

  it('normalizes abort failures for the citation viewer', async () => {
    globalThis.fetch = Object.assign(
      async () => {
        throw new DOMException('Aborted', 'AbortError')
      },
      { preconnect: originalFetch.preconnect },
    )

    await expect(
      fetchCitation(projectId, threadId, citationId),
    ).rejects.toThrow('The citation could not be loaded. Try again.')
  })

  it('preserves unrelated network failures', async () => {
    const networkFailure = new TypeError('Network unavailable')
    globalThis.fetch = Object.assign(
      async () => {
        throw networkFailure
      },
      { preconnect: originalFetch.preconnect },
    )

    await expect(
      fetchCitation(projectId, threadId, citationId),
    ).rejects.toBe(networkFailure)
  })
})
