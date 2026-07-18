# Execution Brief

## Exact Outcome

- Produce the concrete contracts, artifacts, and bounded implementation/design surfaces for Persisted Progress and Render Navigable Citation that this step is responsible for before any broader follow-on work begins.

## Prerequisites

- Re-read [[02_Phases/Phase_01_walking_skeleton/Phase|Phase 01 walking skeleton]] and confirm the step still matches the current roadmap sequence.
- Confirm the handoff from [[02_Phases/Phase_01_walking_skeleton/Steps/Step_04_implement-deterministic-retrieval-and-fred-research-workflow|STEP-01-04 Implement Deterministic Retrieval and Fred Research Workflow]] before widening scope.
- Keep deterministic work in typed Effect services, repositories, and tools; reserve Fred for agentic orchestration only.
- Treat the listed files as planned starting points; create only the smallest set needed to land the slice.

## Planned Starting Files

- These paths may not exist yet; use them as the first bounded implementation or design surface.
- `packages/domain/src/research-events.ts`
- `apps/api/src/routes/research-events.ts`
- `apps/api/src/routes/citations.ts`
- `apps/web/src/components/ResearchStream.tsx`
- `apps/web/src/components/CitationViewer.tsx`

## Required Reading

- [[02_Phases/Phase_01_walking_skeleton/Phase|Phase 01 walking skeleton]]
- [[01_Architecture/System_Overview|System Overview]]
- [[01_Architecture/Code_Map|Code Map]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
- [[02_Phases/Phase_01_walking_skeleton/Steps/Step_04_implement-deterministic-retrieval-and-fred-research-workflow|STEP-01-04 Implement Deterministic Retrieval and Fred Research Workflow]]
- `docs/architecture.md` §7 (product event journal and SSE model)
- `docs/frontend-architecture.md` §4 (state and SSE), §6 (error handling), §8 (accessibility)
- DEC-0008: Own the typed API and live research event stream; SSE from product event journal
- `docs/product-brief.md` sections 6-8, 10, 13, 17-19, 23, 26-27, and 29-31.

## Concrete Deliverables

- Define the first persisted `ResearchEvent` variants needed for progress streaming and final answer delivery.
- Expose one SSE route and one citation lookup route that read persisted state rather than ephemeral in-memory workflow output.
- Add minimal web components that render progress updates and open one navigable citation against the stored source.

## Concrete Context from Architecture and Decisions

### Event journal and SSE (architecture.md §7, DEC-0008)

- The event journal is an append-only PostgreSQL table (created in STEP-01-02)
- SSE streams are filtered projections over the journal plus current run state
- Clients reconnect using a monotonic cursor; missed events are replayed
- Event delivery is at-least-once; clients deduplicate by cursor/identity
- SSE error responses are sanitized (no infrastructure details, stack traces, or internal IDs)

### ResearchEvent variants (architecture.md §7.2, narrowed for walking slice)

- `research-started` — run identity, question, source scope
- `retrieval-completed` — evidence count, source-version references
- `answer-streaming` — partial answer text chunks (if streaming)
- `citations-validated` — citation IDs with status
- `research-completed` — final answer summary, run status
- `research-failed` — typed error, safe for client display

### SSE route design (DEC-0008, frontend-architecture.md §4.2)

- `GET /api/projects/:projectId/runs/:runId/events?cursor=<n>` — SSE stream for a specific research run
- Query params: `cursor` (optional, monotonic BIGINT from last received event; omit to start from beginning)
- Returns `text/event-stream` with typed JSON events; each event includes `id` (cursor), `type`, `data`
- Heartbeat every 30s to keep connection alive (comment-only SSE frame)
- Reconnect with `cursor` query param set to last received event `id` for replay
- Bounded buffer: if the requested cursor is behind the oldest available event, send a typed `cursor-behind` error event and close the stream
- SSE error responses are sanitized (no infrastructure details, stack traces, or internal IDs per DEC-0008)

### Citation lookup route (frontend-architecture.md §3)

- `GET /api/projects/:projectId/research/:threadId/citation/:citationId`
- Returns the citation with: source version reference, locator, surrounding text context
- The locator must point to the exact source span (char offset or line range in the stored text)
- Missing/stale citations return a typed `NotFoundError` (not a blank panel)

**Route prefix standardization**: All product API routes use the `/api/` prefix consistently:
- `GET /api/projects/:projectId/runs/:runId/events` (SSE)
- `GET /api/projects/:projectId/research/:threadId/citation/:citationId`
- `POST /api/projects/:projectId/sources` (source registration)
- `POST /api/projects/:projectId/research` (research request)

This ensures clear separation between API routes and static assets (if any are served from the same host in the future).

### Web components (frontend-architecture.md §4, DEC-0014)

- **`apps/web/src/hooks/useSSE.ts`** — reusable SolidJS hook that:
  - Opens an SSE connection to a given URL
  - Dispatches typed events via a callback
  - Handles reconnection with exponential backoff: **initial 1s, max 30s, max 10 retries**
  - Uses `onCleanup` to close the connection on component unmount
  - Exposes connection state (`connected`, `reconnecting`, `error`) as a signal

  **SSE backoff configuration**:
  ```typescript
  const SSE_BACKOFF = {
    initialMs: 1000,
    maxMs: 30000,
    maxRetries: 10,
  }
  ```
  After 10 retries, the hook sets `error` state and stops attempting reconnection. The user must manually refresh or the component must remount to retry.
- **ResearchStream.tsx** (`apps/web/src/components/ResearchStream.tsx`): SolidJS component that:
  - Uses `useSSE` to connect to the run's event endpoint
  - Dispatches typed events into a Solid store reactively
  - Renders a live timeline of research progress
  - Uses `<For>` for keyed event list rendering
  - Uses `<Show>` for loading/error/empty states
  - Uses `<ErrorBoundary>` for SSE failure recovery
- **CitationViewer.tsx** (`apps/web/src/components/CitationViewer.tsx`): SolidJS component that:
  - Fetches citation details via the typed API client
  - Renders the source text span with the citation highlighted
  - Shows source-version lineage (immutable version reference)
  - Handles missing/stale citation with an actionable error state

### SolidJS patterns (solidjs skill, frontend-architecture.md)

- Use `createSignal` for SSE connection state
- Use `createStore` for the event timeline (normalized, typed)
- Use `<For>` for keyed event list rendering
- Use `<Show>` for loading/error/empty states
- Use `<ErrorBoundary>` for SSE failure recovery
- Use `onCleanup` to close SSE connections on component unmount
- Don't destructure props; use `props.name`
- Call signal getters: `events()` not `events`

## Constraints and Non-Goals

- Optimize for a thin, end-to-end slice rather than broad but unexecutable scaffolding.
- Keep domain and infrastructure seams typed at the boundary and avoid leaking product behavior into Fred core.
- Each change should leave one user path closer to runnable with persistence, streaming, and citations all visible.

## Related Notes

- Step: [[02_Phases/Phase_01_walking_skeleton/Steps/Step_05_stream-persisted-progress-and-render-navigable-citation|STEP-01-05 Stream Persisted Progress and Render Navigable Citation]]
- Phase: [[02_Phases/Phase_01_walking_skeleton/Phase|Phase 01 walking skeleton]]
