# Execution Brief

## Exact Outcome

- Produce the concrete contracts, artifacts, and bounded implementation/design surfaces for Core Domain Schemas and Persistence Migrations that this step is responsible for before any broader follow-on work begins.

## Prerequisites

- Re-read [[02_Phases/Phase_01_walking_skeleton/Phase|Phase 01 walking skeleton]] and confirm the step still matches the current roadmap sequence.
- Confirm the handoff from [[02_Phases/Phase_01_walking_skeleton/Steps/Step_01_scaffold-monorepo-and-runtime-applications|STEP-01-01 Scaffold Monorepo and Runtime Applications]] before widening scope.
- Keep deterministic work in typed Effect services, repositories, and tools; reserve Fred for agentic orchestration only.
- Treat the listed files as planned starting points; create only the smallest set needed to land the slice.

## Planned Starting Files

- These paths may not exist yet; use them as the first bounded implementation or design surface.
- `packages/domain/src/workspace.ts`
- `packages/domain/src/source.ts`
- `packages/domain/src/research-run.ts`
- `packages/domain/src/citation.ts`
- `packages/persistence/src/migrations/0001_init.sql`
- `packages/persistence/src/repositories/index.ts`

## Required Reading

- [[02_Phases/Phase_01_walking_skeleton/Phase|Phase 01 walking skeleton]]
- [[01_Architecture/System_Overview|System Overview]]
- [[01_Architecture/Code_Map|Code Map]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
- [[02_Phases/Phase_01_walking_skeleton/Steps/Step_01_scaffold-monorepo-and-runtime-applications|STEP-01-01 Scaffold Monorepo and Runtime Applications]]
- `docs/product-brief.md` sections 6-8, 10, 13, 17-19, 23, 26-27, and 29-31.

## Concrete Deliverables

- Define branded IDs and Effect Schemas for the first walking-slice entities: `Workspace`, `Source`, `ResearchRun`, and `Citation`.
- Write `packages/persistence/src/migrations/0001_init.sql` with workspace-scoped tables, immutable version references, and foreign keys that match the domain model.
- Expose repository interfaces that decode database rows back into typed domain records without leaking SQL details into app code.

## Smallest Bounded Checklist

- First, define branded IDs and Effect Schemas for the first walking-slice entities: `Workspace`, `Source`, `ResearchRun`, and `Citation`.
- Then, write `packages/persistence/src/migrations/0001_init.sql` with workspace-scoped tables, immutable version references, and foreign keys that match the domain model.
- Next, expose repository interfaces that decode database rows back into typed domain records without leaking SQL details into app code.
- Finish by leaving one observable typed path—test, route, worker flow, or UI state—that proves the slice is ready for the next dependent step.

## Constraints and Non-Goals

- Optimize for a thin, end-to-end slice rather than broad but unexecutable scaffolding.
- Keep domain and infrastructure seams typed at the boundary and avoid leaking product behavior into Fred core.
- Each change should leave one user path closer to runnable with persistence, streaming, and citations all visible.

## Related Notes

- Step: [[02_Phases/Phase_01_walking_skeleton/Steps/Step_02_define-core-domain-schemas-and-persistence-migrations|STEP-01-02 Define Core Domain Schemas and Persistence Migrations]]
- Phase: [[02_Phases/Phase_01_walking_skeleton/Phase|Phase 01 walking skeleton]]
