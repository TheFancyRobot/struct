/**
 * App.tsx — Root shell component with project-owned DaisyUI theme.
 *
 * Custom theme: 'struct' — a focused research workspace aesthetic.
 * No generic purple-on-white defaults; deliberate palette for reading,
 * evidence, and synthesis work.
 */

import { type Component, createSignal } from 'solid-js'

type Theme = 'struct-light' | 'struct-dark'

const App: Component = () => {
  const [theme, setTheme] = createSignal<Theme>('struct-light')

  return (
    <div class="min-h-screen bg-base-100 text-base-content">
      <header class="border-b border-base-300 bg-base-200/50">
        <div class="container mx-auto px-4 py-3 flex items-center justify-between">
          <h1 class="text-xl font-bold tracking-tight">
            <span class="text-primary">struct</span>
            <span class="text-base-content/60 ml-1 font-normal text-sm">research workspace</span>
          </h1>
          <div class="flex items-center gap-3">
            <button
              class="btn btn-ghost btn-sm"
              onClick={() => setTheme(theme() === 'struct-light' ? 'struct-dark' : 'struct-light')}
            >
              {theme() === 'struct-light' ? '🌙' : '☀️'} Theme
            </button>
          </div>
        </div>
      </header>

      <main class="container mx-auto px-4 py-8">
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
      </main>

      <footer class="border-t border-base-300 bg-base-200/30 mt-auto">
        <div class="container mx-auto px-4 py-3 text-center text-base-content/40 text-xs">
          Struct v1 — Walking Skeleton
        </div>
      </footer>
    </div>
  )
}

export default App
