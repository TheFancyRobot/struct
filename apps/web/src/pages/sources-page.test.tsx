/** @jsxImportSource solid-js */
/* eslint-disable no-unused-vars -- Babel does not mark Solid JSX imports as used. */
import { afterEach, describe, expect, it } from 'bun:test'
import { renderToString } from 'solid-js/web'
import { ProjectId } from '@struct/domain'
import { setRouterParams } from '../test/mock-solid-router'

// BUG-0062: SourcesPage relies on @solidjs/router's useParams. The router's
// prebuilt entry calls the client-only `template` primitive at module load,
// which throws under solid-js/web's server build used by renderToString. The
// shared router mock (mock-solid-router) lets the page render in the SSR test
// harness with controlled route params; drive it via `setRouterParams`.

const {
  ProjectAttachmentRequirement,
  SourcesPage,
  projectAttachmentIsUnavailable,
} = await import('./SourcesPage')

const originalFetch = globalThis.fetch
const projectId = ProjectId.make('b50e8400-e29b-41d4-a716-446655440001')

function mockSourceApiFetch() {
  globalThis.fetch = Object.assign(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString()
    if (url.endsWith('/api/projects')) {
      return new Response(JSON.stringify({ items: [], nextCursor: null }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }
    if (url.includes('/api/projects/') && url.endsWith('/sources')) {
      return new Response(JSON.stringify({ items: [], cursor: '0' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }
    if (url.endsWith('/api/sources')) {
      return new Response(JSON.stringify({ items: [], cursor: '0' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }
    return new Response('not found', { status: 404 })
  }, { preconnect: originalFetch.preconnect })
}

afterEach(() => {
  globalThis.fetch = originalFetch
  setRouterParams({})
})

describe('SourcesPage route-level heading (BUG-0062)', () => {
  it('renders a single route-level h1 in the workspace source library', () => {
    mockSourceApiFetch()
    setRouterParams({})
    const html = renderToString(() => <SourcesPage />)

    expect(html).toContain('<h1')
    expect(html).toContain('Source library')
    expect((html.match(/<h1\b/g) ?? [])).toHaveLength(1)
    expect(html.indexOf('<h1')).toBeLessThan(html.indexOf('<h2'))
  })

  it('renders a single route-level h1 in the project sources view', () => {
    mockSourceApiFetch()
    setRouterParams({ projectId })
    const html = renderToString(() => <SourcesPage />)

    expect(html).toContain('<h1')
    expect(html).toContain('>Sources<')
    expect((html.match(/<h1\b/g) ?? [])).toHaveLength(1)
    expect(html.indexOf('<h1')).toBeLessThan(html.indexOf('<h2'))
  })

  it('renders a route-level h1 for an invalid project route', () => {
    setRouterParams({ projectId: 'not-a-project-id' })
    const html = renderToString(() => <SourcesPage />)

    expect(html).toContain('<h1')
    expect(html).toContain('>Sources<')
    expect(html).toContain('This project is no longer available.')
    expect((html.match(/<h1\b/g) ?? [])).toHaveLength(1)
  })
})

describe('unavailable project attachment recovery (BUG-0082)', () => {
  it('explains why project attachment is unavailable and routes to project creation', () => {
    const html = renderToString(() => <ProjectAttachmentRequirement />)

    expect(projectAttachmentIsUnavailable(undefined)).toBeFalse()
    expect(projectAttachmentIsUnavailable({ items: [] })).toBeTrue()
    expect(projectAttachmentIsUnavailable({ items: [projectId] })).toBeFalse()
    expect(html).toContain('id="source-attachment-project-required"')
    expect(html).toContain('Create a project before attaching new sources.')
    expect(html).toContain('role="status"')
    expect(html).toContain('href="/#project-create"')
    expect(html).toContain('>Add a project<')
  })
})
