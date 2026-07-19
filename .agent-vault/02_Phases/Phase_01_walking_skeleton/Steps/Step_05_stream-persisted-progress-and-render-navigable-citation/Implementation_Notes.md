# Implementation Notes

- Capture durable findings learned during execution. Prefer short bullets with file paths, commands, and observed behavior.
- Added shared Effect Schema contracts in `packages/domain/src/research-events.ts` for the five persisted walking-slice research events and immutable citation detail projections.
- Added `ResearchProjectionRepo` for project/run-scoped cursor replay, persisted terminal answers/citations, and project/thread-scoped stored-source citation lookup.
- Added canonical `/api/projects/:projectId/...` source, research, SSE, and citation routes. SSE reads the append-only journal after an exclusive cursor, emits typed named events, sends 30-second comment heartbeats, and sanitizes failures.
- Added SolidJS `useSSE`, `ResearchStream`, and `CitationViewer` surfaces with bounded reconnect, cursor replay/deduplication, schema validation, cleanup, and Solid Router citation links.
- Citation navigation supports current retrieval locators (`lines:N-M` and `line:N,chars:A-B`, including multi-range locators) and renders exact highlighted stored-source spans.
- Self-review corrected named SSE event delivery, a nonexistent citation back route, missing Vite `/api` proxying, and character-locator navigation before publication.

## Related Notes

- Step: [[02_Phases/Phase_01_walking_skeleton/Steps/Step_05_stream-persisted-progress-and-render-navigable-citation|STEP-01-05 Stream Persisted Progress and Render Navigable Citation]]
- Phase: [[02_Phases/Phase_01_walking_skeleton/Phase|Phase 01 walking skeleton]]
