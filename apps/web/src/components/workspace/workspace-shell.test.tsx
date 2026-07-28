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
    expect(html).toContain('Search projects')
    expect(html).toContain('Search sources')
    expect(html).toContain('href="/#project-create"')
    expect(html).toContain('href="/sources#source-import-heading"')
    expect(html).toContain('Add project')
    expect(html).toContain('Add source')
    expect((html.match(/aria-current="page"/g) ?? [])).toHaveLength(1)
  })

  // BUG-0056: the desktop theme toggle lives in the sidebar (out of the
  // floating top bar) so content-level error alerts can never cover it; the
  // mobile toggle stays in the in-flow top bar (which is never absolute on
  // mobile, so no overlap is possible). Each breakpoint shows exactly one
  // toggle via the md:hidden / hidden md:flex classes.
  it('renders exactly one theme toggle per breakpoint: sidebar on desktop, top bar on mobile', () => {
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

    const toggleLabel = 'aria-label="Switch to dark theme"'
    const mainStart = html.indexOf('<main')
    expect(mainStart).toBeGreaterThan(-1)

    // Desktop toggle: in the sidebar (before <main>), shown only at md+ via
    // hidden ... md:flex, so it never competes with the floating top-bar nav.
    const sidebarToggle = html.indexOf(toggleLabel)
    expect(sidebarToggle).toBeGreaterThan(-1)
    expect(sidebarToggle).toBeLessThan(mainStart)
    expect(html).toContain('btn btn-ghost btn-sm hidden w-full justify-start md:flex" ' + toggleLabel)
    expect(html).toContain('Dark theme')

    // Mobile toggle: in the top bar (inside <main>), hidden at md+ (md:hidden)
    // so the floating absolute top bar never carries the toggle on desktop.
    const topBarToggle = html.indexOf(toggleLabel, mainStart)
    expect(topBarToggle).toBeGreaterThan(mainStart)
    expect(html).toContain('btn btn-ghost btn-sm md:hidden" ' + toggleLabel)
  })

  // BUG-0056: the floating top bar is transparent (no background,
  // pointer-events-none except its buttons) and the desktop theme toggle lives
  // in the sidebar, so top-of-content alerts are never obscured and never cover
  // the toggle. The scrollable content therefore keeps its responsive gutter
  // (16/24px from the scroll container top): NO compensating top padding is
  // added to the scroll container — that would inflate the content's top inset
  // (see source-import e2e) without preventing any real overlap.
  it('keeps the content gutter intact and prevents top-bar/alert overlap without compensating padding', () => {
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

    // The floating top bar is transparent and click-through except its buttons,
    // so it cannot visually obscure or block top-of-content alerts.
    expect(html).toContain('md:absolute md:inset-x-0 md:top-0 md:pointer-events-none')
    // The scrollable content keeps its responsive gutter contract (16/24px from
    // the scroll container top): no compensating top padding is added here.
    expect(html).toContain('class="min-h-0 min-w-0 flex-1 overflow-auto"')
    expect(html).not.toContain('overflow-auto md:pt-11')
  })
})
