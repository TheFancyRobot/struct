/** @jsxImportSource solid-js */
// eslint-disable-next-line no-unused-vars -- Babel does not mark Solid JSX imports as used.
import { describe, expect, it } from 'bun:test'
import { renderToString } from 'solid-js/web'
import { NotFoundPage } from './NotFoundPage'

describe('NotFoundPage', () => {
  it('renders an accessible 404 heading and recovery navigation', () => {
    const html = renderToString(() => <NotFoundPage />)

    expect(html).toContain('aria-labelledby="not-found-heading"')
    expect(html).toContain('<h1 id="not-found-heading"')
    expect(html).toContain('>Page not found</h1>')
    expect(html).toContain('aria-label="Not found recovery"')
    expect(html).toContain('href="/">Back to projects</a>')
    expect(html).toContain('href="/sources">Browse sources</a>')
  })
})
