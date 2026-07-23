/** @jsxImportSource solid-js */
/* eslint-disable no-unused-vars -- Babel does not mark Solid JSX imports as used. */
import { describe, expect, it } from 'bun:test'
import { renderToString } from 'solid-js/web'
import { WorkspaceShell } from './WorkspaceShell'
import { WorkspaceStateProvider } from './workspace-state'

describe('workspace shell', () => {
  it('renders one ordered navigation, main, and evidence surface without the legacy shell', () => {
    const html = renderToString(() => (
      <WorkspaceStateProvider projectId="project-a">
        <WorkspaceShell
          theme="struct-light"
          onToggleTheme={() => undefined}
          currentPathname="/projects/project-a/sources"
        >
          <p>Conversation</p>
        </WorkspaceShell>
      </WorkspaceStateProvider>
    ))

    expect(html.indexOf('<nav')).toBeLessThan(html.indexOf('<main'))
    expect(html.indexOf('<main')).toBeLessThan(html.indexOf('<aside'))
    expect(html).toContain('aria-label="Workspace navigation"')
    expect(html).toContain('aria-labelledby="evidence-heading"')
    expect(html).not.toContain('breadcrumbs')
    expect(html).not.toContain('Grounded analysis')
    expect(html).not.toContain('max-w-')
    expect(html).toContain('href="/projects/project-a/sources" aria-current="page"')
    expect((html.match(/aria-current="page"/g) ?? [])).toHaveLength(1)
  })
})
