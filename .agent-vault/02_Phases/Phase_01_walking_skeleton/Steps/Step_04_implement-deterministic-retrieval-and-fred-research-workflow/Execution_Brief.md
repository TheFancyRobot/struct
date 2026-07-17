# Execution Brief

## Exact Outcome

- Produce the concrete contracts, artifacts, and bounded implementation/design surfaces for Deterministic Retrieval and Fred Research Workflow that this step is responsible for before any broader follow-on work begins.

## Prerequisites

- Re-read [[02_Phases/Phase_01_walking_skeleton/Phase|Phase 01 walking skeleton]] and confirm the step still matches the current roadmap sequence.
- Confirm the handoff from [[02_Phases/Phase_01_walking_skeleton/Steps/Step_03_implement-single-text-source-ingestion-and-artifact-storage|STEP-01-03 Implement Single Text Source Ingestion and Artifact Storage]] before widening scope.
- Keep deterministic work in typed Effect services, repositories, and tools; reserve Fred for agentic orchestration only.
- Treat the listed files as planned starting points; create only the smallest set needed to land the slice.

## Planned Starting Files

- These paths may not exist yet; use them as the first bounded implementation or design surface.
- `packages/retrieval/src/search-text.ts`
- `packages/research-engine/src/run-walking-skeleton.ts`
- `packages/fred-workflows/src/graphs/walking-skeleton.ts`
- `apps/api/src/routes/research.ts`
- `apps/worker/src/jobs/run-research.ts`

## Required Reading

- [[02_Phases/Phase_01_walking_skeleton/Phase|Phase 01 walking skeleton]]
- [[01_Architecture/System_Overview|System Overview]]
- [[01_Architecture/Code_Map|Code Map]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
- [[02_Phases/Phase_01_walking_skeleton/Steps/Step_03_implement-single-text-source-ingestion-and-artifact-storage|STEP-01-03 Implement Single Text Source Ingestion and Artifact Storage]]
- `docs/product-brief.md` sections 6-8, 10, 13, 17-19, 23, 26-27, and 29-31.

## Concrete Deliverables

- Implement the smallest retrieval service that can search the stored text source deterministically and hand evidence into one Fred workflow.
- Define a typed research graph for the walking slice with explicit plan/result schemas and no hidden tool contracts.
- Wire one API route and one worker job so a research request becomes a persisted run with bounded retrieval and synthesis.

## Smallest Bounded Checklist

- First, implement the smallest retrieval service that can search the stored text source deterministically and hand evidence into one Fred workflow.
- Then, define a typed research graph for the walking slice with explicit plan/result schemas and no hidden tool contracts.
- Next, wire one API route and one worker job so a research request becomes a persisted run with bounded retrieval and synthesis.
- Finish by leaving one observable typed path—test, route, worker flow, or UI state—that proves the slice is ready for the next dependent step.

## Constraints and Non-Goals

- Optimize for a thin, end-to-end slice rather than broad but unexecutable scaffolding.
- Keep domain and infrastructure seams typed at the boundary and avoid leaking product behavior into Fred core.
- Each change should leave one user path closer to runnable with persistence, streaming, and citations all visible.

## Related Notes

- Step: [[02_Phases/Phase_01_walking_skeleton/Steps/Step_04_implement-deterministic-retrieval-and-fred-research-workflow|STEP-01-04 Implement Deterministic Retrieval and Fred Research Workflow]]
- Phase: [[02_Phases/Phase_01_walking_skeleton/Phase|Phase 01 walking skeleton]]
