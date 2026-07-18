# Validation Plan

## Acceptance Checks

- Confirm this deliverable is present, testable where applicable, and bounded to the step: The first persisted `ResearchEvent` variants needed for progress streaming and final answer delivery.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: All product API routes use the `/api/` prefix consistently (SSE route, citation lookup route, source registration route, research request route).
- Confirm this deliverable is present, testable where applicable, and bounded to the step: One SSE route (`GET /api/projects/:projectId/runs/:runId/events`) and one citation lookup route (`GET /api/projects/:projectId/research/:threadId/citation/:citationId`) that read persisted state rather than ephemeral in-memory workflow output.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: `useSSE` hook implements exponential backoff with initial 1s, max 30s, max 10 retries.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: Minimal web components that render progress updates and open one navigable citation against the stored source.
- The step leaves the next dependent step with a stable typed boundary, not a placeholder or undocumented assumption.

## Planned Verification

- Plan an end-to-end check that starts a run, connects to `GET /api/projects/:projectId/runs/:runId/events`, watches ordered SSE events, and opens the emitted citation in the UI via the citation lookup route.
- Plan a reconnect test: connect to SSE, receive some events, disconnect, reconnect with `cursor=<last-event-id>`, verify no events are missed or duplicated.
- Plan a heartbeat test: SSE connection receives a comment-frame heartbeat every 30s when no events are pending.
- Plan a citation-not-found test: request a citation for a deleted/stale source version, verify a typed `NotFoundError` response (not a blank panel or 500).
- Planned command once these packages exist: `bun test packages/domain` plus the nearest package-level `bun run typecheck`.
- Planned app/integration coverage once the app surfaces exist: `bun test apps/api apps/web` for the API/worker/web path touched here.

## Edge Cases

- Event ordering, duplicate delivery, and client reconnect must not break the visible progress timeline.
- Citation lookup for a missing or stale source version should fail with a user-safe error instead of a blank panel.
- Streaming partial answer text must not be treated as final structured output before citation validation completes.

## Regression Expectations

- This step should remain a clean successor to [[02_Phases/Phase_01_walking_skeleton/Steps/Step_04_implement-deterministic-retrieval-and-fred-research-workflow|STEP-01-04 Implement Deterministic Retrieval and Fred Research Workflow]] rather than reworking already-planned scope upstream.
- Do not break the planned monorepo boundaries between apps and reusable packages.
- Do not bypass deterministic retrieval or provenance rules just to make the first demo easier.
- Keep the walking skeleton small enough that the next phase can iterate on a real slice instead of replacing throwaway code.

## Security / Observability / Evaluation Focus

- Preserve workspace scoping, typed failures, and source-version lineage even in the first runnable slice.
- Make progress streaming and citation rendering observable and restart-aware from day one.
- Do not introduce hidden model loops or ad-hoc filesystem access in the name of speed.
- Evaluation should verify provenance opening paths, contradiction reporting, and prompt-injection resistance for the evidence types touched here.

## Related Notes

- Step: [[02_Phases/Phase_01_walking_skeleton/Steps/Step_05_stream-persisted-progress-and-render-navigable-citation|STEP-01-05 Stream Persisted Progress and Render Navigable Citation]]
- Phase: [[02_Phases/Phase_01_walking_skeleton/Phase|Phase 01 walking skeleton]]
