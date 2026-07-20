/**
 * App.tsx — Root shell component with project-owned DaisyUI theme.
 *
 * Custom theme: 'struct' — a focused research workspace aesthetic.
 * No generic purple-on-white defaults; deliberate palette for reading,
 * evidence, and synthesis work.
 */

import {
  type ParentComponent,
  createEffect,
  createSignal,
  onMount,
} from 'solid-js'

type Theme = 'struct-light' | 'struct-dark'

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
      window.localStorage.setItem('struct-theme', theme())
    }
  })

  return (
    <div
      class="app-shell min-h-screen bg-base-100 text-base-content"
      data-theme={theme()}
    >
      <header class="site-header">
        <div class="site-header-inner">
          <a href="/" class="brand" aria-label="Struct research workspace home">
            <span class="brand-mark" aria-hidden="true">S</span>
            <span>
              <strong>Struct</strong>
              <small>research workspace</small>
            </span>
          </a>
          <div class="flex items-center gap-3">
            <button
              type="button"
              class="theme-toggle"
              aria-label={`Switch to ${theme() === 'struct-light' ? 'dark' : 'light'} theme`}
              onClick={() => setTheme(theme() === 'struct-light' ? 'struct-dark' : 'struct-light')}
            >
              <span aria-hidden="true">{theme() === 'struct-light' ? '◐' : '◑'}</span>
              <span>{theme() === 'struct-light' ? 'Dark' : 'Light'}</span>
            </button>
          </div>
        </div>
      </header>

      <main class="site-main">
        {props.children ?? (
          <div class="max-w-3xl mx-auto">
          <div class="hero min-h-[40vh] bg-base-200/30 rounded-2xl border border-base-300">
            <div class="hero-content text-center">
              <h2 class="text-3xl font-bold mb-2">
                Welcome to Struct
              </h2>
              <p class="text-base-content/70 text-lg">
                A source-grounded research workspace.
              </p>
              <p class="text-base-content/50 mt-4 text-sm">
                Documents are retrieved. Datasets are queried. Directories are navigated.
              </p>
            </div>
          </div>

          <div class="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="card bg-base-200 border border-base-300">
              <div class="card-body p-5">
                <h3 class="card-title text-sm font-semibold uppercase tracking-wider text-primary">
                  Projects
                </h3>
                <p class="text-base-content/60 text-sm">
                  Create research projects with sources, threads, and findings.
                </p>
              </div>
            </div>
            <div class="card bg-base-200 border border-base-300">
              <div class="card-body p-5">
                <h3 class="card-title text-sm font-semibold uppercase tracking-wider text-secondary">
                  Sources
                </h3>
                <p class="text-base-content/60 text-sm">
                  Ingest documents, datasets, and directories.
                </p>
              </div>
            </div>
            <div class="card bg-base-200 border border-base-300">
              <div class="card-body p-5">
                <h3 class="card-title text-sm font-semibold uppercase tracking-wider text-accent">
                  Research
                </h3>
                <p class="text-base-content/60 text-sm">
                  Ask questions. Get evidence-backed answers with navigable citations.
                </p>
              </div>
            </div>
          </div>
          </div>
        )}
      </main>

      <footer class="site-footer">
        <div>
          Struct · Source-grounded research
        </div>
      </footer>
    </div>
  )
}

export default App
