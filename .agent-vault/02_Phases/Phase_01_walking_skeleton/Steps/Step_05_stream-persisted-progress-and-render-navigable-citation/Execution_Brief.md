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
- `docs/product-brief.md` sections 6-8, 10, 13, 17-19, 23, 26-27, and 29-31.

## Concrete Deliverables

- Define the first persisted `ResearchEvent` variants needed for progress streaming and final answer delivery.
- Expose one SSE route and one citation lookup route that read persisted state rather than ephemeral in-memory workflow output.
- Add minimal web components that render progress updates and open one navigable citation against the stored source.

## Smallest Bounded Checklist

- First, define the first persisted `ResearchEvent` variants needed for progress streaming and final answer delivery.
- Then, expose one SSE route and one citation lookup route that read persisted state rather than ephemeral in-memory workflow output.
- Next, add minimal web components that render progress updates and open one navigable citation against the stored source.
- Finish by leaving one observable typed path—test, route, worker flow, or UI state—that proves the slice is ready for the next dependent step.

## Constraints and Non-Goals

- Optimize for a thin, end-to-end slice rather than broad but unexecutable scaffolding.
- Keep domain and infrastructure seams typed at the boundary and avoid leaking product behavior into Fred core.
- Each change should leave one user path closer to runnable with persistence, streaming, and citations all visible.

## Related Notes

- Step: [[02_Phases/Phase_01_walking_skeleton/Steps/Step_05_stream-persisted-progress-and-render-navigable-citation|STEP-01-05 Stream Persisted Progress and Render Navigable Citation]]
- Phase: [[02_Phases/Phase_01_walking_skeleton/Phase|Phase 01 walking skeleton]]
