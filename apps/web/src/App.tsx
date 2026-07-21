import {
  type ParentComponent,
  createEffect,
  createSignal,
  onMount,
} from 'solid-js'
import { basePathFromPublicBaseUrl, withBasePath } from './base-path'

type Theme = 'struct-light' | 'struct-dark'

const appBasePath = basePathFromPublicBaseUrl(import.meta.env.BASE_URL)

const App: ParentComponent = (props) => {
  const [theme, setTheme] = createSignal<Theme>('struct-light')
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
    <div
      class="app-shell drawer min-h-screen bg-base-200 text-base-content lg:drawer-open"
      data-theme={theme()}
    >
      <input id="workspace-navigation" type="checkbox" class="drawer-toggle" />
      <div class="drawer-content min-w-0">
        <header class="navbar sticky top-0 z-30 min-h-16 border-b border-base-300 bg-base-100/95 px-3 backdrop-blur lg:px-6">
          <div class="navbar-start">
            <label
              for="workspace-navigation"
              class="btn btn-square btn-ghost lg:hidden"
              aria-label="Open workspace navigation"
            >
              <span aria-hidden="true">☰</span>
            </label>
            <div class="breadcrumbs hidden text-sm sm:block">
              <ul>
                <li><a href={withBasePath('/', appBasePath)}>Workspace</a></li>
                <li>Research</li>
              </ul>
            </div>
          </div>
          <div class="navbar-end">
            <button
              type="button"
              class="theme-toggle btn btn-ghost btn-sm gap-2"
              aria-label={`Switch to ${theme() === 'struct-light' ? 'dark' : 'light'} theme`}
              onClick={toggleTheme}
            >
              <span aria-hidden="true">{theme() === 'struct-light' ? '◐' : '◑'}</span>
              <span class="hidden sm:inline">{theme() === 'struct-light' ? 'Dark' : 'Light'}</span>
            </button>
          </div>
        </header>
        <main class="site-main mx-auto w-full max-w-[96rem] p-3 sm:p-5 lg:p-6">
          {props.children}
        </main>
      </div>

      <aside class="drawer-side z-40">
        <label
          for="workspace-navigation"
          aria-label="Close workspace navigation"
          class="drawer-overlay"
        />
        <nav class="flex min-h-full w-64 flex-col border-r border-base-300 bg-base-100 p-3">
          <a
            href={withBasePath('/', appBasePath)}
            class="brand flex min-h-14 items-center gap-3 px-2 text-base-content no-underline"
            aria-label="Struct research workspace home"
          >
            <span class="brand-mark grid size-9 place-items-center rounded-field bg-primary text-lg font-bold text-primary-content" aria-hidden="true">S</span>
            <span class="leading-tight">
              <strong class="block text-lg tracking-tight">Struct</strong>
              <small class="block text-xs text-base-content/60">research workspace</small>
            </span>
          </a>
          <div class="divider my-2" />
          <ul class="menu w-full gap-1 p-0 text-sm">
            <li class="menu-title text-xs">Workspace</li>
            <li>
              <a class="active" href={withBasePath('/', appBasePath)} aria-current="page">
                <span aria-hidden="true">⌂</span>
                Research workbench
              </a>
            </li>
            <li>
              <button type="button" disabled title="Open a project to view its notebook">
                <span aria-hidden="true">□</span>
                Project notebook
              </button>
            </li>
          </ul>
          <div class="mt-auto px-2 py-3 text-xs leading-relaxed text-base-content/55">
            Source-grounded answers with inspectable evidence.
          </div>
        </nav>
      </aside>
    </div>
  )
}

export default App
