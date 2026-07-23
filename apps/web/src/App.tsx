/* eslint-disable no-unused-vars -- Babel does not mark Solid JSX imports as used. */
import { useLocation, useSearchParams } from '@solidjs/router'
import {
  type ParentComponent,
  createEffect,
  createMemo,
  createSignal,
  onMount,
} from 'solid-js'
import { basePathFromPublicBaseUrl } from './base-path'
import { WorkspaceShell } from './components/workspace/WorkspaceShell'
import {
  WorkspaceStateProvider,
  workspaceProjectId,
} from './components/workspace/workspace-state'

type Theme = 'struct-light' | 'struct-dark'

const appBasePath = basePathFromPublicBaseUrl(import.meta.env.BASE_URL)

const App: ParentComponent = (props) => {
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [theme, setTheme] = createSignal<Theme>('struct-light')
  const projectId = createMemo(() => workspaceProjectId(location.pathname, appBasePath))

  onMount(() => {
    const saved = window.localStorage.getItem('struct-theme')
    if (saved === 'struct-light' || saved === 'struct-dark') {
      setTheme(saved)
      return
    }
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setTheme('struct-dark')
    }
  })

  createEffect(() => {
    if (typeof window !== 'undefined') {
      document.documentElement.dataset.theme = theme()
    }
  })

  const toggleTheme = () => {
    const nextTheme = theme() === 'struct-light' ? 'struct-dark' : 'struct-light'
    window.localStorage.setItem('struct-theme', nextTheme)
    setTheme(nextTheme)
  }

  return (
    <WorkspaceStateProvider projectId={projectId()}>
      <WorkspaceShell
        theme={theme()}
        onToggleTheme={toggleTheme}
        currentPathname={location.pathname}
        evidence={typeof searchParams.evidence === 'string' ? searchParams.evidence : undefined}
        onClearEvidence={() => setSearchParams({ evidence: undefined })}
      >
        {props.children}
      </WorkspaceShell>
    </WorkspaceStateProvider>
  )
}

export default App
