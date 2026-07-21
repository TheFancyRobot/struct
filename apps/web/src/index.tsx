/**
 * apps/web — SolidJS 1.9 + Vite 8 + Solid Router SPA entry point.
 *
 * No SSR. No SolidStart. Pure client-side routing.
 * Communicates with apps/api over HTTP and SSE only.
 * Styling: Tailwind 4 + DaisyUI with project-owned custom theme.
 */

import './index.css'
import { render } from 'solid-js/web'
import { Router, Route } from '@solidjs/router'
import App from './App'
import { CitationPage } from './pages/CitationPage'
import { HomePage } from './pages/HomePage'
import { ResearchPage } from './pages/ResearchPage'
import { NotebookPage } from './pages/NotebookPage'
import { basePathFromPublicBaseUrl } from './base-path'

const routerBase = basePathFromPublicBaseUrl(import.meta.env.BASE_URL)

render(
  () => (
    <Router root={App} base={routerBase}>
      <Route path="/" component={HomePage} />
      <Route path="/projects/:projectId/research/:threadId/runs/:runId" component={ResearchPage} />
      <Route path="/projects/:projectId/research/:threadId/citation/:citationId" component={CitationPage} />
      <Route path="/projects/:projectId/notebook" component={NotebookPage} />
    </Router>
  ),
  document.getElementById('app')!,
)
