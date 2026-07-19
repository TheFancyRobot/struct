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
import { ResearchPage } from './pages/ResearchPage'

render(
  () => (
    <Router root={App}>
      <Route path="/projects/:projectId/research/:threadId/runs/:runId" component={ResearchPage} />
      <Route path="/projects/:projectId/research/:threadId/citation/:citationId" component={CitationPage} />
    </Router>
  ),
  document.getElementById('app')!,
)
