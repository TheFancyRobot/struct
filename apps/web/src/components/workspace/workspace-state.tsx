import {
  type Accessor,
  type ParentComponent,
  type Setter,
  createContext,
  createEffect,
  createSignal,
  useContext,
} from 'solid-js'
import { stripBasePath } from '../../base-path'

export interface WorkspaceState {
  readonly projectId: Accessor<string | null>
  readonly draft: Accessor<string>
  readonly setDraft: Setter<string>
  readonly selectedEvidence: Accessor<string | null>
  readonly setSelectedEvidence: Setter<string | null>
  readonly evidenceTrigger: Accessor<HTMLElement | null>
  readonly setEvidenceTrigger: Setter<HTMLElement | null>
  readonly navigationCollapsed: Accessor<boolean>
  readonly setNavigationCollapsed: Setter<boolean>
  readonly navigationSheetOpen: Accessor<boolean>
  readonly setNavigationSheetOpen: Setter<boolean>
  readonly evidenceCollapsed: Accessor<boolean>
  readonly setEvidenceCollapsed: Setter<boolean>
  readonly evidenceSheetOpen: Accessor<boolean>
  readonly setEvidenceSheetOpen: Setter<boolean>
  readonly setProjectScope: (projectId: string | null) => void
}

export function createWorkspaceState(initialProjectId: string | null): WorkspaceState {
  const [projectId, setProjectId] = createSignal(initialProjectId)
  const [draft, setDraft] = createSignal('')
  const [selectedEvidence, setSelectedEvidence] = createSignal<string | null>(null)
  const [evidenceTrigger, setEvidenceTrigger] = createSignal<HTMLElement | null>(null)
  const [navigationCollapsed, setNavigationCollapsed] = createSignal(false)
  const [navigationSheetOpen, setNavigationSheetOpen] = createSignal(false)
  const [evidenceCollapsed, setEvidenceCollapsed] = createSignal(false)
  const [evidenceSheetOpen, setEvidenceSheetOpen] = createSignal(false)

  return {
    projectId,
    draft,
    setDraft,
    selectedEvidence,
    setSelectedEvidence,
    evidenceTrigger,
    setEvidenceTrigger,
    navigationCollapsed,
    setNavigationCollapsed,
    navigationSheetOpen,
    setNavigationSheetOpen,
    evidenceCollapsed,
    setEvidenceCollapsed,
    evidenceSheetOpen,
    setEvidenceSheetOpen,
    setProjectScope(nextProjectId) {
      if (nextProjectId === projectId()) return
      setProjectId(nextProjectId)
      setDraft('')
      setSelectedEvidence(null)
      setEvidenceTrigger(null)
      setNavigationSheetOpen(false)
      setEvidenceSheetOpen(false)
    },
  }
}

const WorkspaceStateContext = createContext<WorkspaceState>()

export const WorkspaceStateProvider: ParentComponent<{
  readonly projectId: string | null
}> = (props) => {
  const state = createWorkspaceState(props.projectId)
  createEffect(() => state.setProjectScope(props.projectId))
  return (
    <WorkspaceStateContext.Provider value={state}>
      {props.children}
    </WorkspaceStateContext.Provider>
  )
}

export function useWorkspaceState(): WorkspaceState {
  const state = useContext(WorkspaceStateContext)
  if (state === undefined) {
    throw new Error('WorkspaceStateProvider is required')
  }
  return state
}

export function workspaceProjectId(pathname: string, basePath = ''): string | null {
  const routePath = stripBasePath(pathname, basePath)
  return routePath === null ? null : /^\/projects\/([^/]+)/.exec(routePath)?.[1] ?? null
}
