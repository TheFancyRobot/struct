# Execution Brief

## Exact Outcome

- Produce the concrete contracts, artifacts, and bounded implementation/design surfaces for Vertical Slice Tests Documentation and Observability that this step is responsible for before any broader follow-on work begins.

## Prerequisites

- Re-read [[02_Phases/Phase_01_walking_skeleton/Phase|Phase 01 walking skeleton]] and confirm the step still matches the current roadmap sequence.
- Confirm the handoff from [[02_Phases/Phase_01_walking_skeleton/Steps/Step_05_stream-persisted-progress-and-render-navigable-citation|STEP-01-05 Stream Persisted Progress and Render Navigable Citation]] before widening scope.
- Keep deterministic work in typed Effect services, repositories, and tools; reserve Fred for agentic orchestration only.
- Treat the listed files as planned starting points; create only the smallest set needed to land the slice.

## Planned Starting Files

- These paths may not exist yet; use them as the first bounded implementation or design surface.
- `apps/api/test/walking-skeleton.integration.test.ts`
- `apps/web/e2e/walking-skeleton.spec.ts`
- `packages/observability/src/tracing.ts`
- `packages/evaluation/src/walking-skeleton.ts`
- `docs/setup.md`

## Required Reading

- [[02_Phases/Phase_01_walking_skeleton/Phase|Phase 01 walking skeleton]]
- [[01_Architecture/System_Overview|System Overview]]
- [[01_Architecture/Code_Map|Code Map]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
- [[02_Phases/Phase_01_walking_skeleton/Steps/Step_05_stream-persisted-progress-and-render-navigable-citation|STEP-01-05 Stream Persisted Progress and Render Navigable Citation]]
- `docs/product-brief.md` sections 6-8, 10, 13, 17-19, 23, 26-27, and 29-31.

## Concrete Deliverables

- Add the first vertical-slice integration/e2e tests, basic tracing/logging hooks, and setup documentation that explain how to run the skeleton.
- Make the walking slice observable enough to diagnose ingest, retrieval, and citation failures without debugger-only access.
- Capture the exact demo path, prerequisites, and known gaps so Phase 02 builds on evidence rather than tribal knowledge.

## Smallest Bounded Checklist

- First, add the first vertical-slice integration/e2e tests, basic tracing/logging hooks, and setup documentation that explain how to run the skeleton.
- Then, make the walking slice observable enough to diagnose ingest, retrieval, and citation failures without debugger-only access.
- Next, capture the exact demo path, prerequisites, and known gaps so Phase 02 builds on evidence rather than tribal knowledge.
- Finish by capturing the deterministic fixture, benchmark, or gate evidence that will let the validation plan judge the slice without guesswork.

## Constraints and Non-Goals

- Optimize for a thin, end-to-end slice rather than broad but unexecutable scaffolding.
- Keep domain and infrastructure seams typed at the boundary and avoid leaking product behavior into Fred core.
- Each change should leave one user path closer to runnable with persistence, streaming, and citations all visible.

## Related Notes

- Step: [[02_Phases/Phase_01_walking_skeleton/Steps/Step_06_automate-vertical-slice-tests-documentation-and-observability|STEP-01-06 Automate Vertical Slice Tests Documentation and Observability]]
- Phase: [[02_Phases/Phase_01_walking_skeleton/Phase|Phase 01 walking skeleton]]
