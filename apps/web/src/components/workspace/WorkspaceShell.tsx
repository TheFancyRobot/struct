/* eslint-disable no-unused-vars -- Babel does not mark Solid JSX imports as used. */
import { Schema } from 'effect'
import {
  ProjectId,
  ResearchRunId,
  ResearchThreadId,
} from '@struct/domain'
import {
  For,
  Show,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  onCleanup,
  onMount,
  type Component,
  type ParentComponent,
} from 'solid-js'
import type { SourceCatalog as SourceCatalogValue } from '@struct/domain'
import { basePathFromPublicBaseUrl, stripBasePath, withBasePath } from '../../base-path'
import { fetchSourceCatalog } from '../../api/sources'
import { EvidenceInspector as EvidenceDetailInspector } from '../EvidenceInspector'
import { parseEvidenceSelection } from '../evidence-selection'
import { StructIconCssVariables, StructWordmarkCurrentColor } from '../icons'
import { useWorkspaceState } from './workspace-state'

type Theme = 'struct-light' | 'struct-dark'

const appBasePath = basePathFromPublicBaseUrl(import.meta.env.BASE_URL)
const RECENT_PROJECT_IDS_KEY = 'struct:recent-project-ids'

export function searchHasNoResults(
  query: string,
  resultCount: number,
  hasLoaded: boolean,
): boolean {
  return hasLoaded && query.trim().length > 0 && resultCount === 0
}

export function filterProjectsByQuery<T extends { readonly name: string }>(
  projects: ReadonlyArray<T>,
  query: string,
): ReadonlyArray<T> {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  return normalizedQuery.length === 0
    ? projects
    : projects.filter((project) => project.name.toLocaleLowerCase().includes(normalizedQuery))
}

export const SourceCatalogEmptyState: Component<{
  readonly catalog: SourceCatalogValue | null | undefined
  readonly loading: boolean
  readonly query: string
  readonly resultCount: number
}> = (props) => {
  const catalogSettled = () => props.catalog != null && !props.loading
  const hasNoMatches = () => searchHasNoResults(
    props.query,
    props.resultCount,
    catalogSettled(),
  )

  return (
    <Show when={catalogSettled()}>
      <Show
        when={hasNoMatches()}
        fallback={<li class="px-2 text-xs text-base-content/60">No documents loaded.</li>}
      >
        <li class="px-2 text-xs text-base-content/60" role="status">No matching sources.</li>
      </Show>
    </Show>
  )
}

function readRecentProjectIds(): ReadonlyArray<string> {
  if (typeof window === 'undefined') return []
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(RECENT_PROJECT_IDS_KEY) ?? '[]')
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

function focus(element: HTMLElement | undefined): void {
  queueMicrotask(() => element?.focus())
}

function focusSourceImportHeading(): void {
  requestAnimationFrame(() => document.querySelector<HTMLElement>('#source-import-heading')?.focus())
}

function isUnmodifiedPrimaryActivation(event: MouseEvent): boolean {
  return event.button === 0
    && !event.altKey
    && !event.ctrlKey
    && !event.metaKey
    && !event.shiftKey
}

const SHEET_FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

// BUG-0067: keep Tab/Shift+Tab inside an open mobile sheet so focus cannot
// reach the underlying top bar or content. Wraps from the last focusable to
// the first (and vice versa) and handles the initially-focused heading whose
// tabindex="-1" places it outside the tab order.
function trapSheetFocus(event: KeyboardEvent, container: HTMLElement | undefined): void {
  if (event.key !== 'Tab' || container === undefined) return
  const focusable = [...container.querySelectorAll<HTMLElement>(SHEET_FOCUSABLE_SELECTOR)]
    .filter((element) => element.getClientRects().length > 0)
  if (focusable.length === 0) return
  const first = focusable[0]!
  const last = focusable[focusable.length - 1]!
  const active = document.activeElement
  if (event.shiftKey) {
    const atOrBeforeFirst = active === first
      || (active instanceof Element
        && (first.compareDocumentPosition(active) & Node.DOCUMENT_POSITION_PRECEDING) !== 0)
      || !container.contains(active)
    if (atOrBeforeFirst) {
      event.preventDefault()
      last.focus()
    }
  } else {
    const atOrAfterLast = active === last
      || (active instanceof Element
        && (last.compareDocumentPosition(active) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0)
      || !container.contains(active)
    if (atOrAfterLast) {
      event.preventDefault()
      first.focus()
    }
  }
}

export const WorkspaceNavigation: ParentComponent<{
  readonly currentPathname?: string
  readonly headingRef: (element: HTMLHeadingElement) => void
  readonly onCloseSheet: () => void
  readonly onCollapse: () => void
  readonly theme: Theme
  readonly onToggleTheme: () => void
}> = (props) => {
  const state = useWorkspaceState()
  const projects = state.projects
  const [projectSearch, setProjectSearch] = createSignal('')
  const [sourceSearch, setSourceSearch] = createSignal('')
  const [recentProjectIds, setRecentProjectIds] = createSignal(readRecentProjectIds())
  const [sources] = createResource(state.projectId, (projectId) =>
    projectId === null || !Schema.is(ProjectId)(projectId)
      ? null
      : fetchSourceCatalog(projectId))
  const projectPath = () => state.projectId() === null
    ? '/'
    : `/projects/${state.projectId()}`
  const reportPath = () => `${projectPath()}/notebook`
  const isCurrent = (path: string) =>
    props.currentPathname === withBasePath(path, appBasePath)
  const matches = (name: string, query: string) =>
    name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
  const filteredProjects = createMemo(() =>
    filterProjectsByQuery(projects()?.items ?? [], projectSearch()))
  const hasNoMatchingProjects = createMemo(() =>
    searchHasNoResults(
      projectSearch(),
      filteredProjects().length,
      projects() != null && !projects.loading,
    ))
  const recentProjects = createMemo(() => {
    return recentProjectIds().flatMap((id) => {
      const project = (projects()?.items ?? []).find((item) => item.id === id)
      return project === undefined ? [] : [project]
    })
  })
  const filteredRecentProjects = createMemo(() =>
    filterProjectsByQuery(recentProjects(), projectSearch()))
  const recentSources = createMemo(() =>
    (sources()?.items ?? [])
      .filter((source) => source.kind === 'document' && matches(source.name, sourceSearch()))
      .toSorted((left, right) => right.updatedAt - left.updatedAt)
      .slice(0, 5))
  const addSource = (event: MouseEvent) => {
    // Preserve native new-tab/download-style link activations. Only the
    // ordinary in-app navigation should change focus or dismiss the sheet.
    if (!isUnmodifiedPrimaryActivation(event)) return
    if (state.navigationSheetOpen()) props.onCloseSheet()
    focusSourceImportHeading()
  }

  createEffect(() => {
    const projectId = state.projectId()
    if (projectId === null || typeof window === 'undefined') return
    const next = [projectId, ...readRecentProjectIds().filter((id) => id !== projectId)].slice(0, 5)
    window.localStorage.setItem(RECENT_PROJECT_IDS_KEY, JSON.stringify(next))
    setRecentProjectIds(next)
  })

  return (
    <nav
      aria-label="Workspace navigation"
      class="flex h-full min-h-0 flex-col border-r border-base-300 bg-base-100 p-3"
    >
      <div class="flex items-center gap-2 px-1 pb-2 pt-0.5" role="img" aria-label="Struct">
        <StructIconCssVariables class="h-7 w-auto shrink-0" aria-hidden="true" />
        <StructWordmarkCurrentColor class="h-6 w-auto shrink-0" aria-hidden="true" />
      </div>
      <div class="flex min-h-11 items-center justify-between gap-2">
        <h2 ref={props.headingRef} tabindex="-1" class="truncate px-2 text-sm font-semibold">
          Workspace
        </h2>
        <button
          type="button"
          class="btn btn-ghost btn-sm md:hidden"
          aria-label="Close workspace navigation"
          onClick={props.onCloseSheet}
        >
          Close
        </button>
        <button
          type="button"
          class="btn btn-ghost btn-sm hidden md:inline-flex"
          aria-label="Collapse workspace navigation"
          onClick={props.onCollapse}
        >
          Collapse
        </button>
      </div>
      <div class="min-h-0 flex-1 space-y-5 overflow-y-auto px-2 py-3 text-sm">
        <Show when={state.projectId() === null && filteredRecentProjects().length > 0}>
          <section aria-labelledby="recent-projects-heading">
            <h3 id="recent-projects-heading" class="mb-2 text-xs font-semibold uppercase tracking-wide text-base-content/60">
              Recents
            </h3>
            <ul class="menu w-full gap-1 p-0">
              <For each={filteredRecentProjects()}>
                {(project) => (
                  <li><a href={withBasePath(`/projects/${project.id}`, appBasePath)}>{project.name}</a></li>
                )}
              </For>
            </ul>
          </section>
        </Show>
        <section aria-labelledby="projects-heading">
          <div class="mb-2 flex items-center justify-between gap-2">
            <h3 id="projects-heading" class="text-xs font-semibold uppercase tracking-wide text-base-content/60">
              Projects
            </h3>
            <a
              href={withBasePath('/#project-create', appBasePath)}
              class="btn btn-ghost min-h-11 px-3 text-xs"
            >
              Add project
            </a>
          </div>
          <label class="input input-sm mb-2 flex w-full items-center">
            <span class="sr-only">Search projects</span>
            <input
              type="search"
              class="grow"
              aria-label="Search projects"
              placeholder="Search projects"
              value={projectSearch()}
              onInput={(event) => setProjectSearch(event.currentTarget.value)}
            />
          </label>
          <ul class="menu w-full gap-1 p-0">
            <For
              each={filteredProjects()}
              fallback={
                <Show when={hasNoMatchingProjects()}>
                  <li class="px-2 text-xs text-base-content/60" role="status">No matching projects.</li>
                </Show>
              }
            >
              {(project) => (
                <li>
                  <a
                    href={withBasePath(`/projects/${project.id}`, appBasePath)}
                    aria-current={isCurrent(`/projects/${project.id}`) ? 'page' : undefined}
                  >
                    {project.name}
                  </a>
                </li>
              )}
            </For>
          </ul>
        </section>
        <section aria-labelledby="navigation-sources-heading">
          <div class="mb-2 flex items-center justify-between gap-2">
            <h3 id="navigation-sources-heading" class="text-xs font-semibold uppercase tracking-wide text-base-content/60">
              Sources
            </h3>
            <a
              href={withBasePath('/sources#source-import-heading', appBasePath)}
              class="btn btn-ghost min-h-11 px-3 text-xs"
              onClick={addSource}
            >
              Add source
            </a>
          </div>
          <label class="input input-sm mb-2 flex w-full items-center">
            <span class="sr-only">Search sources</span>
            <input
              type="search"
              class="grow"
              aria-label="Search sources"
              placeholder="Search sources"
              value={sourceSearch()}
              onInput={(event) => setSourceSearch(event.currentTarget.value)}
            />
          </label>
          <Show
            when={state.projectId() !== null}
            fallback={
              <a
                class="link inline-flex min-h-11 items-center px-2 text-xs"
                href={withBasePath('/sources', appBasePath)}
                aria-current={isCurrent('/sources') ? 'page' : undefined}
              >
                Manage source library
              </a>
            }
          >
            <ul class="menu w-full gap-1 p-0">
              <For
              each={recentSources()}
              fallback={
                  <SourceCatalogEmptyState
                    catalog={sources()}
                    loading={sources.loading}
                    query={sourceSearch()}
                    resultCount={recentSources().length}
                  />
              }
              >
                {(source) => (
                  <li>
                    <a href={withBasePath(`${projectPath()}/sources`, appBasePath)}>{source.name}</a>
                  </li>
                )}
              </For>
            </ul>
          </Show>
        </section>
        <ul class="menu w-full gap-1 p-0">
        <Show when={state.projectId() !== null}>
          <li class="menu-title mt-3 text-xs">Project</li>
          <li>
            <a href={withBasePath(projectPath(), appBasePath)} aria-current={isCurrent(projectPath()) ? 'page' : undefined}>
              Conversation
            </a>
          </li>
          <li>
            <a href={withBasePath(`${projectPath()}/sources`, appBasePath)} aria-current={isCurrent(`${projectPath()}/sources`) ? 'page' : undefined}>
              Sources
            </a>
          </li>
          <li>
            <a href={withBasePath(`${projectPath()}/notes`, appBasePath)} aria-current={isCurrent(`${projectPath()}/notes`) ? 'page' : undefined}>
              Notes
            </a>
          </li>
          <li>
            <a href={withBasePath(reportPath(), appBasePath)} aria-current={isCurrent(`${projectPath()}/notebook`) ? 'page' : undefined}>
              Reports
            </a>
          </li>
        </Show>
        </ul>
      </div>
      <div class="border-t border-base-300 px-2 py-2">
        <button
          type="button"
          class="btn btn-ghost btn-sm hidden w-full justify-start md:flex"
          aria-label={`Switch to ${props.theme === 'struct-light' ? 'dark' : 'light'} theme`}
          onClick={props.onToggleTheme}
        >
          {props.theme === 'struct-light' ? 'Dark' : 'Light'} theme
        </button>
      </div>
      <p class="px-2 py-3 text-xs leading-relaxed text-base-content/60">
        Source-grounded research with inspectable evidence.
      </p>
    </nav>
  )
}

export const ConversationWorkspace: ParentComponent<{
  readonly onOpenNavigation: (opener: HTMLButtonElement) => void
  readonly onOpenEvidence: (opener: HTMLButtonElement) => void
  readonly navigationToggleRef: (element: HTMLButtonElement) => void
  readonly evidenceToggleRef: (element: HTMLButtonElement) => void
  readonly theme: Theme
  readonly onToggleTheme: () => void
}> = (props) => {
  const state = useWorkspaceState()
  return (
    <main
      id="workspace-main"
      tabindex="-1"
      inert={state.navigationSheetOpen() || state.evidenceSheetOpen()}
      class="relative flex min-h-0 min-w-0 flex-1 flex-col bg-base-100"
    >
      <div class="z-20 flex min-h-11 items-center gap-2 px-1 md:absolute md:inset-x-0 md:top-0 md:pointer-events-none">
        <button
          ref={props.navigationToggleRef}
          type="button"
          class="btn btn-ghost btn-sm md:hidden md:pointer-events-auto"
          aria-label="Open workspace navigation"
          onClick={(event) => props.onOpenNavigation(event.currentTarget)}
        >
          Menu
        </button>
        <Show when={state.navigationCollapsed()}>
          <button
            ref={props.navigationToggleRef}
            type="button"
            class="btn btn-ghost btn-sm hidden md:inline-flex md:pointer-events-auto"
            aria-label="Open workspace navigation"
            onClick={(event) => props.onOpenNavigation(event.currentTarget)}
          >
            Navigation
          </button>
        </Show>
        <span class="flex-1" />
        <Show when={state.navigationCollapsed()}>
          <button
            type="button"
            class="btn btn-ghost btn-sm hidden md:inline-flex md:pointer-events-auto"
            aria-label={`Switch to ${props.theme === 'struct-light' ? 'dark' : 'light'} theme`}
            onClick={props.onToggleTheme}
          >
            {props.theme === 'struct-light' ? 'Dark' : 'Light'} theme
          </button>
        </Show>
        <button
          type="button"
          class="btn btn-ghost btn-sm md:hidden"
          aria-label={`Switch to ${props.theme === 'struct-light' ? 'dark' : 'light'} theme`}
          onClick={props.onToggleTheme}
        >
          {props.theme === 'struct-light' ? 'Dark' : 'Light'}
        </button>
        <button
          ref={props.evidenceToggleRef}
          type="button"
          class="btn btn-ghost btn-sm md:pointer-events-auto lg:hidden"
          aria-label="Open evidence"
          onClick={(event) => props.onOpenEvidence(event.currentTarget)}
        >
          Evidence
        </button>
        <Show when={state.evidenceCollapsed()}>
          <button
            ref={props.evidenceToggleRef}
            type="button"
            class="btn btn-ghost btn-sm hidden md:pointer-events-auto lg:inline-flex"
            aria-label="Open evidence"
            onClick={(event) => props.onOpenEvidence(event.currentTarget)}
          >
            Evidence
          </button>
        </Show>
      </div>
      {/* Preserve the established 16/24px content gutter while navigation is
          expanded. When the desktop pane is collapsed, reserve exactly the
          floating bar's height so its fallback controls cannot cover alerts. */}
      <div
        class="min-h-0 min-w-0 flex-1 overflow-auto"
        classList={{ 'md:pt-11': state.navigationCollapsed() }}
      >
        {props.children}
      </div>
    </main>
  )
}

const EmptyEvidenceInspector: ParentComponent<{
  readonly headingRef: (element: HTMLHeadingElement) => void
  readonly onCloseSheet: () => void
  readonly onCollapse: () => void
}> = (props) => (
  <div class="flex h-full min-h-0 flex-col border-l border-base-300 bg-base-100 p-3">
    <div class="flex min-h-11 items-center justify-between gap-2">
      <h2
        id="evidence-heading"
        ref={props.headingRef}
        tabindex="-1"
        class="truncate px-2 text-sm font-semibold"
      >
        Evidence
      </h2>
      <button
        type="button"
        class="btn btn-ghost btn-sm lg:hidden"
        aria-label="Close evidence"
        onClick={props.onCloseSheet}
      >
        Close
      </button>
      <button
        type="button"
        class="btn btn-ghost btn-sm hidden lg:inline-flex"
        aria-label="Collapse evidence"
        onClick={props.onCollapse}
      >
        Collapse
      </button>
    </div>
    <div class="flex min-h-0 flex-1 items-center justify-center p-4 text-center">
      <p class="text-sm text-base-content/65">
        Select a citation to inspect its exact source context.
      </p>
    </div>
  </div>
)

export const WorkspaceShell: ParentComponent<{
  readonly currentPathname?: string
  readonly evidence?: string
  readonly onClearEvidence?: () => void
  readonly theme: Theme
  readonly onToggleTheme: () => void
}> = (props) => {
  const state = useWorkspaceState()
  const selection = createMemo(() => parseEvidenceSelection(props.evidence))
  const evidenceScope = createMemo(() => {
    const routePath = stripBasePath(props.currentPathname ?? '', appBasePath)
    const route = routePath === null
      ? null
      : /^\/projects\/([^/]+)\/research\/([^/]+)\/runs\/([^/]+)$/.exec(routePath)
    return route !== null
      && Schema.is(ProjectId)(route[1])
      && Schema.is(ResearchThreadId)(route[2])
      && Schema.is(ResearchRunId)(route[3])
      ? {
          projectId: route[1],
          threadId: route[2],
          runId: route[3],
        }
      : null
  })
  let navigationHeading: HTMLHeadingElement | undefined
  let evidenceHeading: HTMLHeadingElement | undefined
  let navigationToggle: HTMLButtonElement | undefined
  let evidenceToggle: HTMLButtonElement | undefined
  let navigationOpener: HTMLButtonElement | undefined
  let evidenceOpener: HTMLButtonElement | undefined
  let navigationSheet: HTMLElement | undefined
  let evidenceSheet: HTMLElement | undefined
  let previousEvidence: string | null = null

  const closeNavigationSheet = () => {
    state.setNavigationSheetOpen(false)
    focus(navigationOpener)
  }
  const closeEvidenceSheet = () => {
    state.setEvidenceSheetOpen(false)
    focus(evidenceOpener)
  }
  const closeEvidence = () => {
    props.onClearEvidence?.()
    state.setSelectedEvidence(null)
    state.setEvidenceSheetOpen(false)
    focus(state.evidenceTrigger() ?? evidenceOpener)
  }
  const openNavigation = (opener: HTMLButtonElement) => {
    navigationOpener = opener
    if (window.matchMedia('(min-width: 768px)').matches) {
      state.setNavigationCollapsed(false)
    } else {
      state.setEvidenceSheetOpen(false)
      state.setNavigationSheetOpen(true)
    }
    focus(navigationHeading)
  }
  const openEvidence = (opener: HTMLButtonElement) => {
    evidenceOpener = opener
    if (window.matchMedia('(min-width: 1024px)').matches) {
      state.setEvidenceCollapsed(false)
    } else {
      state.setNavigationSheetOpen(false)
      state.setEvidenceSheetOpen(true)
    }
    focus(evidenceHeading)
  }

  createEffect(() => {
    const current = selection()
    const serialized = current === null ? null : `${current.kind}:${current.id}`
    state.setSelectedEvidence(serialized)
    if (current !== null && evidenceScope() !== null) {
      state.setEvidenceCollapsed(false)
      if (!window.matchMedia('(min-width: 1024px)').matches) {
        state.setNavigationSheetOpen(false)
        state.setEvidenceSheetOpen(true)
      }
      if (serialized !== previousEvidence) focus(evidenceHeading)
    } else if (previousEvidence !== null) {
      state.setEvidenceSheetOpen(false)
      focus(state.evidenceTrigger() ?? evidenceOpener)
    }
    previousEvidence = serialized
  })

  onMount(() => {
    const navigationDesktop = window.matchMedia('(min-width: 768px)')
    const evidenceDesktop = window.matchMedia('(min-width: 1024px)')
    const syncSheetBreakpoints = () => {
      if (navigationDesktop.matches) state.setNavigationSheetOpen(false)
      if (evidenceDesktop.matches) state.setEvidenceSheetOpen(false)
    }
    navigationDesktop.addEventListener('change', syncSheetBreakpoints)
    evidenceDesktop.addEventListener('change', syncSheetBreakpoints)
    syncSheetBreakpoints()
    onCleanup(() => {
      navigationDesktop.removeEventListener('change', syncSheetBreakpoints)
      evidenceDesktop.removeEventListener('change', syncSheetBreakpoints)
    })

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (selection() !== null) {
        closeEvidence()
      } else if (state.evidenceSheetOpen()) {
        closeEvidenceSheet()
      } else if (state.navigationSheetOpen()) {
        closeNavigationSheet()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    onCleanup(() => document.removeEventListener('keydown', onKeyDown))
  })

  return (
    <div
      class="app-shell flex h-dvh min-h-0 min-w-80 overflow-hidden bg-base-200 text-base-content"
      data-theme={props.theme}
    >
      <a
        href="#workspace-main"
        class="sr-only fixed left-4 top-4 z-50 rounded-md bg-primary px-4 py-2 text-primary-content shadow-md focus:not-sr-only focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        Skip to main content
      </a>
      <Show when={state.navigationSheetOpen()}>
        <button
          type="button"
          tabindex="-1"
          class="fixed inset-0 z-30 bg-neutral/45 md:hidden"
          aria-label="Close workspace navigation"
          onClick={closeNavigationSheet}
        />
      </Show>
      <section
        ref={(element) => { navigationSheet = element }}
        role={state.navigationSheetOpen() ? 'dialog' : undefined}
        aria-modal={state.navigationSheetOpen() ? 'true' : undefined}
        aria-label={state.navigationSheetOpen() ? 'Workspace navigation' : undefined}
        inert={state.evidenceSheetOpen()}
        class="fixed inset-y-0 left-0 z-40 w-72 -translate-x-full invisible transition-transform duration-200 md:static md:z-auto md:w-64 md:translate-x-0 md:visible"
        classList={{
          'translate-x-0 visible': state.navigationSheetOpen(),
          'md:hidden': state.navigationCollapsed(),
        }}
        onKeyDown={(event) => {
          if (state.navigationSheetOpen()) trapSheetFocus(event, navigationSheet)
        }}
      >
      <WorkspaceNavigation
        currentPathname={props.currentPathname}
        theme={props.theme}
        onToggleTheme={props.onToggleTheme}
          headingRef={(element) => { navigationHeading = element }}
          onCloseSheet={closeNavigationSheet}
          onCollapse={() => {
            state.setNavigationCollapsed(true)
            focus(navigationToggle)
          }}
        />
      </section>

      <ConversationWorkspace
        theme={props.theme}
        onToggleTheme={props.onToggleTheme}
        navigationToggleRef={(element) => { navigationToggle = element }}
        evidenceToggleRef={(element) => { evidenceToggle = element }}
        onOpenNavigation={openNavigation}
        onOpenEvidence={openEvidence}
      >
        {props.children}
      </ConversationWorkspace>

      <Show when={state.evidenceSheetOpen()}>
        <button
          type="button"
          tabindex="-1"
          class="fixed inset-0 z-30 bg-neutral/45 lg:hidden"
          aria-label="Close evidence"
          onClick={closeEvidenceSheet}
        />
      </Show>
      <aside
        ref={(element) => { evidenceSheet = element }}
        aria-labelledby="evidence-heading"
        role={state.evidenceSheetOpen() ? 'dialog' : undefined}
        aria-modal={state.evidenceSheetOpen() ? 'true' : undefined}
        inert={state.navigationSheetOpen()}
        class="fixed inset-y-0 right-0 z-40 w-[min(24rem,90vw)] translate-x-full invisible transition-transform duration-200 lg:static lg:z-auto lg:w-80 lg:translate-x-0 lg:visible"
        classList={{
          'translate-x-0 visible': state.evidenceSheetOpen(),
          'lg:hidden': state.evidenceCollapsed(),
        }}
        onKeyDown={(event) => {
          if (state.evidenceSheetOpen()) trapSheetFocus(event, evidenceSheet)
        }}
      >
        <Show
          when={selection() !== null && evidenceScope() !== null}
          fallback={(
            <EmptyEvidenceInspector
              headingRef={(element) => { evidenceHeading = element }}
              onCloseSheet={closeEvidenceSheet}
              onCollapse={() => {
                state.setEvidenceCollapsed(true)
                focus(evidenceToggle)
              }}
            />
          )}
        >
          <EvidenceDetailInspector
            projectId={evidenceScope()!.projectId}
            threadId={evidenceScope()!.threadId}
            runId={evidenceScope()!.runId}
            selection={selection()!}
            headingRef={(element) => { evidenceHeading = element }}
            onClose={closeEvidence}
          />
        </Show>
      </aside>
    </div>
  )
}
