# Execution Brief

## Exact Outcome

- Produce the concrete contracts, artifacts, and bounded implementation/design surfaces for Single Text Source Ingestion and Artifact Storage that this step is responsible for before any broader follow-on work begins.

## Prerequisites

- Re-read [[02_Phases/Phase_01_walking_skeleton/Phase|Phase 01 walking skeleton]] and confirm the step still matches the current roadmap sequence.
- Confirm the handoff from [[02_Phases/Phase_01_walking_skeleton/Steps/Step_02_define-core-domain-schemas-and-persistence-migrations|STEP-01-02 Define Core Domain Schemas and Persistence Migrations]] before widening scope.
- Keep deterministic work in typed Effect services, repositories, and tools; reserve Fred for agentic orchestration only.
- Treat the listed files as planned starting points; create only the smallest set needed to land the slice.

## Planned Starting Files

- These paths may not exist yet; use them as the first bounded implementation or design surface.
- `apps/api/src/routes/sources.ts`
- `apps/worker/src/jobs/ingest-source.ts`
- `packages/source-storage/src/object-store.ts`
- `packages/ingestion/src/ingest-text-source.ts`
- `packages/ingestion/src/file-classifier.ts`

## Required Reading

- [[02_Phases/Phase_01_walking_skeleton/Phase|Phase 01 walking skeleton]]
- [[01_Architecture/System_Overview|System Overview]]
- [[01_Architecture/Code_Map|Code Map]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
- [[02_Phases/Phase_01_walking_skeleton/Steps/Step_02_define-core-domain-schemas-and-persistence-migrations|STEP-01-02 Define Core Domain Schemas and Persistence Migrations]]
- `docs/product-brief.md` sections 6-8, 10, 13, 17-19, 23, 26-27, and 29-31.

## Concrete Deliverables

- Add one API path that registers a single text source and hands off a typed ingestion request to the worker side.
- Define an object-storage adapter and text-ingestion service that persist the raw artifact plus normalized text for later retrieval.
- Keep the file classifier and ingestion job narrow: one supported text format, one happy path, and explicit failure states.

## Smallest Bounded Checklist

- First, add one API path that registers a single text source and hands off a typed ingestion request to the worker side.
- Then, define an object-storage adapter and text-ingestion service that persist the raw artifact plus normalized text for later retrieval.
- Next, keep the file classifier and ingestion job narrow: one supported text format, one happy path, and explicit failure states.
- Finish by leaving one observable typed path—test, route, worker flow, or UI state—that proves the slice is ready for the next dependent step.

## Constraints and Non-Goals

- Optimize for a thin, end-to-end slice rather than broad but unexecutable scaffolding.
- Keep domain and infrastructure seams typed at the boundary and avoid leaking product behavior into Fred core.
- Each change should leave one user path closer to runnable with persistence, streaming, and citations all visible.

## Related Notes

- Step: [[02_Phases/Phase_01_walking_skeleton/Steps/Step_03_implement-single-text-source-ingestion-and-artifact-storage|STEP-01-03 Implement Single Text Source Ingestion and Artifact Storage]]
- Phase: [[02_Phases/Phase_01_walking_skeleton/Phase|Phase 01 walking skeleton]]
