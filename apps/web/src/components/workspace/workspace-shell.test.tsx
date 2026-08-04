/** @jsxImportSource solid-js */
/* eslint-disable no-unused-vars -- Babel does not mark Solid JSX imports as used. */
import { describe, expect, it } from 'bun:test'
import { renderToString } from 'solid-js/web'
import { searchHasNoResults, WorkspaceShell } from './WorkspaceShell'
import { useWorkspaceState, WorkspaceStateProvider } from './workspace-state'

describe('workspace shell', () => {
  it('identifies a completed search with no matches without treating loading as empty', () => {
    expect(searchHasNoResults('zzzz-no-project', 0, true)).toBe(true)
    expect(searchHasNoResults('zzzz-no-source', 0, true)).toBe(true)
    expect(searchHasNoResults('', 0, true)).toBe(false)
    expect(searchHasNoResults('zzzz-no-project', 0, false)).toBe(false)
    expect(searchHasNoResults('project', 1, true)).toBe(false)
  })

  // BUG-0070: the project list must be a single shared resource on the
  // workspace state so one refetch after project creation updates both the
  // persistent sidebar navigation and the project switcher list without a
  // manual reload.
  it('exposes a shared project list resource and refetch entry point on the workspace state', () => {
    const html = renderToString(() => (
      <WorkspaceStateProvider projectId="project-a">
        <span data-projects={typeof useWorkspaceState().projects} data-refetch={typeof useWorkspaceState().refetchProjects} />
      </WorkspaceStateProvider>
    ))

    expect(html).toContain('data-projects="function"')
    expect(html).toContain('data-refetch="function"')
  })

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
    expect(html).toContain('href="/projects/project-a/notebook"')
    expect(html).toContain('>Reports</a>')
    expect(html).not.toMatch(/<button[^>]*disabled[^>]*>Reports<\/button>/)
    expect(html).toContain('Search projects')
    expect(html).toContain('Search sources')
    expect(html).toContain('href="/#project-create"')
    expect(html).toContain('href="/sources#source-import-heading"')
    expect(html).toContain('Add project')
    expect(html).toContain('Add source')
    expect((html.match(/aria-current="page"/g) ?? [])).toHaveLength(1)
  })

  it('marks the source library, not its import anchor, as current on the global sources route', () => {
    const html = renderToString(() => (
      <WorkspaceStateProvider projectId={null}>
        <WorkspaceShell
          theme="struct-light"
          onToggleTheme={() => undefined}
          currentPathname="/sources"
        >
          <p>Sources</p>
        </WorkspaceShell>
      </WorkspaceStateProvider>
    ))

    expect(html).toContain('href="/sources#source-import-heading"')
    expect(html).toContain('href="/sources" aria-current="page">Manage source library</a>')
    expect(html).not.toContain('href="/sources#source-import-heading" aria-current="page"')
    expect((html.match(/aria-current="page"/g) ?? [])).toHaveLength(1)
  })

  it('provides a focus-visible skip link to the focusable main content region', () => {
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

    const skipLink = '<a href="#workspace-main"'
    expect(html.indexOf(skipLink)).toBeGreaterThan(-1)
    expect(html.indexOf(skipLink)).toBeLessThan(html.indexOf('<nav'))
    expect(html).toContain('Skip to main content</a>')
    expect(html).toContain('focus-visible:ring-2')
    expect(html).toContain('<main id="workspace-main" tabindex="-1"')
  })

  // BUG-0056: with navigation expanded, the desktop theme toggle lives in the
  // sidebar (out of the floating top bar); the mobile toggle stays in the
  // in-flow top bar. Each breakpoint shows exactly one toggle via md:hidden /
  // hidden md:flex. Browser coverage exercises the collapsed desktop fallback.
  it('renders one expanded-state theme toggle per breakpoint: sidebar on desktop, top bar on mobile', () => {
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
    expect((html.match(/aria-label="Switch to dark theme"/g) ?? [])).toHaveLength(2)
    expect((html.slice(0, mainStart).match(/aria-label="Switch to dark theme"/g) ?? []))
      .toHaveLength(1)
    expect((html.slice(mainStart).match(/aria-label="Switch to dark theme"/g) ?? []))
      .toHaveLength(1)

    // Desktop toggle: in the sidebar (before <main>), shown only at md+ via
    // hidden ... md:flex, so it never competes with the floating top-bar nav.
    const sidebarToggle = html.indexOf(toggleLabel)
    expect(sidebarToggle).toBeGreaterThan(-1)
    expect(sidebarToggle).toBeLessThan(mainStart)
    expect(html).toContain('btn btn-ghost btn-sm hidden w-full justify-start md:flex" ' + toggleLabel)
    expect(html).toContain('Dark theme')

    // Mobile toggle: in the top bar (inside <main>), hidden at md+ (md:hidden).
    // The conditional collapsed-navigation fallback is absent in this state.
    const topBarToggle = html.indexOf(toggleLabel, mainStart)
    expect(topBarToggle).toBeGreaterThan(mainStart)
    expect(html).toContain('btn btn-ghost btn-sm md:hidden" ' + toggleLabel)
  })

  // BUG-0056: with desktop navigation expanded, the primary theme toggle lives
  // in the sidebar and the scrollable content keeps its responsive 16/24px
  // gutter. Browser coverage verifies that the collapsed fallback conditionally
  // reserves the floating bar's height so it cannot overlap alerts.
  it('keeps the expanded-state content gutter intact', () => {
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

    // Preserve the existing transparent, click-through floating-bar contract.
    expect(html).toContain('md:absolute md:inset-x-0 md:top-0 md:pointer-events-none')
    // Expanded navigation keeps the responsive gutter contract with no padding.
    expect(html).toMatch(/class="min-h-0 min-w-0 flex-1 overflow-auto\s*"/)
    expect(html).not.toContain('overflow-auto md:pt-11')
  })
})
