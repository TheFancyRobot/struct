/** @jsxImportSource solid-js */
/* eslint-disable no-unused-vars -- Babel does not mark Solid JSX imports as used. */
import { afterEach, describe, expect, it } from 'bun:test'
import { renderToString } from 'solid-js/web'
import { CitationId, ProjectId, ResearchThreadId } from '@struct/domain'
import '../test/mock-solid-router'

// CitationViewer imports `A` from @solidjs/router, whose prebuilt entry calls
// solid-js/web's client-only `template` primitive at module load under SSR
// (same harness limitation as BUG-0062). The shared router mock lets this
// render without colliding with other router-using SSR tests.
const { CitationViewer } = await import('./CitationViewer')

const projectId = ProjectId.make('a10e8400-e29b-41d4-a716-446655440001')
const threadId = ResearchThreadId.make('00000000-0000-4000-8000-000000000000')
const citationId = CitationId.make('00000000-0000-4000-8000-000000000000')

/**
 * Every `aria-labelledby` reference in `html` must resolve to an element `id`
 * present in the same render. This is the axe `aria-valid-attr-value` invariant
 * that BUG-0064 violated: the citation section referenced `citation-title`
 * while the heading only exists in the loaded state.
 */
function everyAriaLabelledbyResolves(html: string): boolean {
  const references = [...html.matchAll(/aria-labelledby="([^"]+)"/g)].map((m) => m[1])
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]))
  return references.every((ref) =>
    ref.split(/\s+/).every((id) => ids.has(id)),
  )
}

describe('CitationViewer accessibility', () => {
  const originalFetch = globalThis.fetch
  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('does not emit aria-labelledby referencing a missing heading while loading', () => {
    // Keep the resource pending so the loading branch renders synchronously.
    globalThis.fetch = Object.assign(
      () => new Promise<Response>(() => {}),
      { preconnect: originalFetch.preconnect },
    )

    const html = renderToString(() => (
      <CitationViewer
        projectId={projectId}
        threadId={threadId}
        citationId={citationId}
      />
    ))

    expect(everyAriaLabelledbyResolves(html)).toBe(true)
  })
})
