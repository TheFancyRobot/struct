# Frontend Architecture

This document defines the frontend contract for `apps/web` within the Fred-native research workspace. It is the companion to [`architecture.md`](./architecture.md) and implements the choices recorded in DEC-0014 (SolidJS + Vite 8 + Solid Router) and DEC-0013 (Tailwind CSS + DaisyUI with a custom theme).

## 1. Framework and tooling

- **UI library:** SolidJS 1.9 — fine-grained reactive primitives (signals, stores, resources).
- **Build tool:** Vite 8 with the Solid plugin.
- **Routing:** Solid Router (library mode, programmatic configuration) for client-side SPA routing.
- **Styling:** Tailwind CSS + DaisyUI with a project-owned custom theme (DEC-0013).
- **TypeScript:** TS 7.0.2, strict mode, with `noUnusedLocals` and `noUnusedParameters` enforced — no patches, no disabled checks.
- **Package manager:** Bun (consistent with DEC-0003).

## 2. Boundaries

`apps/web` is a pure single-page application. It must not:

- connect directly to PostgreSQL or DuckDB.
- execute Fred workflows or ingest data.
- import from `packages/fred-workflows`, `packages/research-engine`, `packages/ingestion`, `packages/data-engine`, or `packages/persistence`.
- contain server-side rendering logic, file-based routing, or static generation.

`apps/web` must:

- call `apps/api` over HTTP exclusively for all data and commands.
- consume the product event journal for live progress via SSE.
- render the typed API client generated from API Effect Schema contracts.
- own all presentation logic, user interaction, and client-side state.

## 3. Routing

Solid Router owns all navigation. Route definitions map to research UI panels:

| Route pattern | Panel | Notes |
| --- | --- | --- |
| `/` | Project list / landing | Entry point; prompts project selection or creation. |
| `/projects/:projectId` | Project home | Source catalog, ingestion status, research threads. |
| `/projects/:projectId/sources/:sourceId` | Source details | Directory tree, manifest, version history, ingestion state. |
| `/projects/:projectId/research/:threadId` | Research conversation | Streaming progress, final answer, follow-ups. |
| `/projects/:projectId/research/:threadId/citation/:citationId` | Citation inspector | Evidence preview, document/file/dataset context. |
| `/projects/:projectId/findings` | Saved findings | Curated findings with edit/export controls. |
| `/projects/:projectId/reports/:reportId` | Report editor | Editable Markdown report with citation preservation. |
| `/datasets/:datasetId` | Dataset schema explorer | Schema details, sample records, SQL query panel. |

Nested routes compose the left/center/right panel layout defined in the product brief (§17). Route guards enforce workspace/project authorization by fetching the typed API client and rejecting unauthorized navigation.

## 4. State and SSE

The frontend maintains three layers of client state:

### 4.1 Reactive stores (Solid stores)

- **Project catalog:** current projects, sources, datasets.
- **Research thread state:** active thread, step history, plan, current evidence.
- **Ingestion state:** per-source progress, file-level status, errors.
- **UI state:** active panels, selected items, sort/filter preferences, modal state.

Solid stores hold normalized, typed data. Components subscribe only to the signals they read.

### 4.2 SSE consumption

The product event journal is consumed via SSE streamed from `apps/api`. A dedicated `useSSE` hook:

1. Opens an SSE connection to the API endpoint for the relevant workspace/project/run.
2. Dispatches typed domain events into the appropriate Solid stores reactively.
3. Handles reconnection with exponential backoff and cursor-based replay.
4. Maps event families (`ingestion-*`, `research-*`) to store updates without polling.

The walking-slice implementation reconnects after 1 second with exponential
backoff capped at 30 seconds and stops after 10 retries. It resumes from the
last received monotonic cursor, deduplicates replayed events, closes the
`EventSource` on cleanup, and validates every event against the shared Effect
Schema before updating the Solid store.

Events are not persisted on the client beyond the current session. The canonical record of progress lives in PostgreSQL and is replayed on reconnect.

### 4.3 API client state

The typed API client is a thin fetch wrapper. It:

- generates request/response types from the API's Effect Schema contracts.
- handles auth headers and token refresh transparently.
- exposes typed methods for every API endpoint.
- returns Effect-compatible result types for downstream composition.

Client-side caching is intentionally minimal: research progress is SSE-driven, and CRUD operations are optimistic with SSE confirmation.

## 5. API flow

```text
User action
    ↓
Component handler (Solid event)
    ↓
Typed API client call (fetch + schema validation)
    ↓
apps/api: auth → authorize → validate → execute
    ↓
apps/api: persists command, emits journal event
    ↓
apps/worker: durable execution (if long-running)
    ↓
apps/api: streams SSE event to connected clients
    ↓
apps/web: useSSE hook receives event
    ↓
Solid store update (reactive propagation)
    ↓
Component re-render (fine-grained)
```

All API responses are validated client-side against Effect Schema types before being written to stores. Invalid responses trigger structured error handling (§6).

## 6. Error handling

Errors flow through three layers:

1. **Network errors:** connection failures, timeouts, DNS errors. Handled by the API client with retry logic and user-facing toast notifications.
2. **API errors:** typed domain errors returned by `apps/api`. The client maps HTTP status codes and error bodies to structured error UI (inline form errors, panel-level alerts, or full-screen error states for unrecoverable failures). Infrastructure details are never exposed (DEC-0008).
3. **Validation errors:** client-side Effect Schema decode failures. These are development-time issues caught by `tsc --noEmit` and should not reach production.

Every user-facing error must be actionable: it should tell the user what failed, why (in non-technical terms), and what they can do next.

## 7. Testing

Three test tiers, aligned with the repository testing strategy:

### 7.1 Unit tests

- **Components:** render isolation, event handling, signal/store reactivity. Run with the repository-wide native `bun:test` runner.
- **Stores:** signal updates, computed derivations, SSE event dispatch.
- **API client:** request construction, response decoding, error mapping.

### 7.2 Integration tests

- API client calls against mocked endpoints (MSW or manual mock).
- SSE event flow: dispatch events, verify store updates, verify re-render triggers.
- Route navigation guards: authorized vs. unauthorized access.

### 7.3 End-to-end tests

- Full research flow: create project → add source → ingest → run research → view answer → open citation → export report.
- Run with Playwright or Vite's E2E integration.
- Cover keyboard navigation and screen reader behavior (accessibility).

## 8. Styling and accessibility

### 8.1 Styling system

All styles flow through Tailwind 4 utility classes and DaisyUI component primitives. The custom project theme defines:

- color palette (primary, secondary, accent, neutral, base, info, success, warning, error).
- spacing scale and border radius tokens.
- typography scale.
- component variants (buttons, cards, tables, modals, forms).

No ad hoc CSS. No CSS Modules or CSS-in-JS. Utility classes compose the visual design; DaisyUI provides component structure; the custom theme provides visual identity.

### 8.2 Accessibility

- All interactive elements must support full keyboard navigation (Tab, Enter, Escape, arrow keys where appropriate).
- Color contrast meets WCAG AA minimums across the custom theme.
- Screen reader support: semantic HTML, ARIA labels on icon-only buttons, live regions for streaming progress updates, focus management on route changes.
- DaisyUI components include built-in accessibility; custom components must follow the same patterns.
- E2E tests include accessibility assertions (axe-core or equivalent).

## 9. Non-goals

The following are explicitly out of scope for the frontend:

- **Server-side rendering:** `apps/web` is a pure SPA. SSR, SSG, and hybrid rendering are not implemented.
- **File-based routing:** Solid Router is configured programmatically. No file-system-to-route conventions.
- **Native mobile:** Responsive web only. No React Native, PWA native shell, or mobile app.
- **Real-time collaboration:** WebSocket-based multi-user editing is deferred to post-v1.
- **Offline support:** Service workers and offline caching are deferred; the app requires a live API connection.
- **Analytics tracking:** Not in v1; added post-release if product requirements change.
- **SolidStart:** Explicitly not used. SolidStart is rejected; `apps/web` is a Vite-built SPA with programmatic routing only.
- **Custom CSS:** All styles use the Tailwind/DaisyUI/custom-theme system exclusively.

## 10. Related

- DEC-0014 — frontend framework selection rationale and alternatives.
- DEC-0013 — Tailwind CSS + DaisyUI + custom theme for styling.
- DEC-0003 — TypeScript, Bun, Effect runtime boundaries.
- DEC-0008 — typed API and live event stream model.
- [`architecture.md`](./architecture.md) — system-level architecture.
- [`product-brief.md`](./product-brief.md) — UX layout and research modes.
