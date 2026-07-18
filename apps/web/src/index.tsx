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

render(
  () => (
    <Router root={App}>
      {/* Walking skeleton: landing route only. Later phases add project/source routes. */}
      <Route path="/" component={App} />
    </Router>
  ),
  document.getElementById('app')!,
)
