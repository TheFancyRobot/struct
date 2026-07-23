/* eslint-disable no-unused-vars -- Babel does not mark Solid JSX imports as used. */
import { Schema } from 'effect'
import {
  ProjectId,
  ResearchRunId,
  ResearchThreadId,
} from '@struct/domain'
import {
  Show,
  createEffect,
  createMemo,
  onCleanup,
  onMount,
  type ParentComponent,
} from 'solid-js'
import { basePathFromPublicBaseUrl, withBasePath } from '../../base-path'
import { EvidenceInspector as EvidenceDetailInspector } from '../EvidenceInspector'
import { parseEvidenceSelection } from '../evidence-selection'
import { useWorkspaceState } from './workspace-state'

type Theme = 'struct-light' | 'struct-dark'

const appBasePath = basePathFromPublicBaseUrl(import.meta.env.BASE_URL)

function focus(element: HTMLElement | undefined): void {
  queueMicrotask(() => element?.focus())
}

export const WorkspaceNavigation: ParentComponent<{
  readonly currentPathname?: string
  readonly headingRef: (element: HTMLHeadingElement) => void
  readonly onCloseSheet: () => void
  readonly onCollapse: () => void
}> = (props) => {
  const state = useWorkspaceState()
  const projectPath = () => state.projectId() === null
    ? '/'
    : `/projects/${state.projectId()}`
  const isCurrent = (path: string) =>
    props.currentPathname === withBasePath(path, appBasePath)

  return (
    <nav
      aria-label="Workspace navigation"
      class="flex h-full min-h-0 flex-col border-r border-base-300 bg-base-100 p-3"
    >
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
      <ul class="menu min-h-0 w-full flex-1 gap-1 overflow-y-auto p-0 text-sm">
        <li>
          <a href={withBasePath('/', appBasePath)}>
            Projects
          </a>
        </li>
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
          <li><button type="button" disabled>Reports</button></li>
        </Show>
      </ul>
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
    <main class="flex min-h-0 min-w-0 flex-1 flex-col bg-base-200">
      <header class="flex min-h-14 items-center gap-2 border-b border-base-300 bg-base-100 px-3">
        <button
          ref={props.navigationToggleRef}
          type="button"
          class="btn btn-ghost btn-sm md:hidden"
          aria-label="Open workspace navigation"
          onClick={(event) => props.onOpenNavigation(event.currentTarget)}
        >
          Menu
        </button>
        <Show when={state.navigationCollapsed()}>
          <button
            ref={props.navigationToggleRef}
            type="button"
            class="btn btn-ghost btn-sm hidden md:inline-flex"
            aria-label="Open workspace navigation"
            onClick={(event) => props.onOpenNavigation(event.currentTarget)}
          >
            Navigation
          </button>
        </Show>
        <span class="min-w-0 flex-1 truncate text-sm font-semibold">Research workspace</span>
        <button
          type="button"
          class="btn btn-ghost btn-sm"
          aria-label={`Switch to ${props.theme === 'struct-light' ? 'dark' : 'light'} theme`}
          onClick={props.onToggleTheme}
        >
          {props.theme === 'struct-light' ? 'Dark' : 'Light'}
        </button>
        <button
          ref={props.evidenceToggleRef}
          type="button"
          class="btn btn-ghost btn-sm lg:hidden"
          aria-label="Open evidence"
          onClick={(event) => props.onOpenEvidence(event.currentTarget)}
        >
          Evidence
        </button>
        <Show when={state.evidenceCollapsed()}>
          <button
            ref={props.evidenceToggleRef}
            type="button"
            class="btn btn-ghost btn-sm hidden lg:inline-flex"
            aria-label="Open evidence"
            onClick={(event) => props.onOpenEvidence(event.currentTarget)}
          >
            Evidence
          </button>
        </Show>
      </header>
      <div class="min-h-0 min-w-0 flex-1 overflow-auto p-3 sm:p-4">
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
  <aside
    aria-labelledby="evidence-heading"
    class="flex h-full min-h-0 flex-col border-l border-base-300 bg-base-100 p-3"
  >
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
  </aside>
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
    const route = /^\/projects\/([^/]+)\/research\/([^/]+)\/runs\/([^/]+)$/.exec(
      props.currentPathname ?? '',
    )
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
      <Show when={state.navigationSheetOpen()}>
        <button
          type="button"
          class="fixed inset-0 z-30 bg-neutral/45 md:hidden"
          aria-label="Close workspace navigation"
          onClick={closeNavigationSheet}
        />
      </Show>
      <section
        class="fixed inset-y-0 left-0 z-40 w-72 -translate-x-full invisible transition-transform duration-200 md:static md:z-auto md:w-64 md:translate-x-0 md:visible"
        classList={{
          'translate-x-0 visible': state.navigationSheetOpen(),
          'md:hidden': state.navigationCollapsed(),
        }}
      >
      <WorkspaceNavigation
        currentPathname={props.currentPathname}
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
          class="fixed inset-0 z-30 bg-neutral/45 lg:hidden"
          aria-label="Close evidence"
          onClick={closeEvidenceSheet}
        />
      </Show>
      <section
        class="fixed inset-y-0 right-0 z-40 w-[min(24rem,90vw)] translate-x-full invisible transition-transform duration-200 lg:static lg:z-auto lg:w-80 lg:translate-x-0 lg:visible"
        classList={{
          'translate-x-0 visible': state.evidenceSheetOpen(),
          'lg:hidden': state.evidenceCollapsed(),
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
      </section>
    </div>
  )
}
