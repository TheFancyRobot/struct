# Validation Plan

## Acceptance Checks

- Confirm this deliverable is present, testable where applicable, and bounded to the step: The first persisted `ResearchEvent` variants needed for progress streaming and final answer delivery.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: One SSE route and one citation lookup route that read persisted state rather than ephemeral in-memory workflow output.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: Minimal web components that render progress updates and open one navigable citation against the stored source.
- The step leaves the next dependent step with a stable typed boundary, not a placeholder or undocumented assumption.

## Planned Verification

- Plan an end-to-end check that starts a run, watches ordered SSE events, and opens the emitted citation in the UI.
- Plan a reconnect test where the UI reloads mid-run and still rebuilds progress from persisted events.
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
