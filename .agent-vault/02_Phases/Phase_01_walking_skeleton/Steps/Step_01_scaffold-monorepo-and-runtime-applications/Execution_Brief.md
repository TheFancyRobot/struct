# Execution Brief

## Exact Outcome

- Produce the concrete contracts, artifacts, and bounded implementation/design surfaces for Monorepo and Runtime Applications that this step is responsible for before any broader follow-on work begins.

## Prerequisites

- Re-read [[02_Phases/Phase_01_walking_skeleton/Phase|Phase 01 walking skeleton]] and confirm the step still matches the current roadmap sequence.
- Confirm the handoff from [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Steps/Step_06_establish-evaluation-corpus-specification-and-quality-gates|STEP-00-06 Establish Evaluation Corpus Specification and Quality Gates]] before widening scope.
- Keep deterministic work in typed Effect services, repositories, and tools; reserve Fred for agentic orchestration only.
- Treat the listed files as planned starting points; create only the smallest set needed to land the slice.

## Planned Starting Files

- These paths may not exist yet; use them as the first bounded implementation or design surface.
- `package.json`
- `bunfig.toml`
- `tsconfig.base.json`
- `docker-compose.yml`
- `apps/web/src/app/page.tsx`
- `apps/api/src/main.ts`
- `apps/worker/src/main.ts`
- `packages/domain/src/index.ts`

## Required Reading

- [[02_Phases/Phase_01_walking_skeleton/Phase|Phase 01 walking skeleton]]
- [[01_Architecture/System_Overview|System Overview]]
- [[01_Architecture/Code_Map|Code Map]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
- [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Steps/Step_06_establish-evaluation-corpus-specification-and-quality-gates|STEP-00-06 Establish Evaluation Corpus Specification and Quality Gates]]
- `docs/product-brief.md` sections 6-8, 10, 13, 17-19, 23, 26-27, and 29-31.

## Concrete Deliverables

- Create the root monorepo manifests (`package.json`, `bunfig.toml`, `tsconfig.base.json`, `docker-compose.yml`) plus the first `apps/web`, `apps/api`, and `apps/worker` entrypoints.
- Wire the minimal package graph so the apps can import a shared `packages/domain` module without circular bootstrap hacks.
- Make the skeleton bootable enough to host one project-create, ingest, and research path later in the phase.

## Smallest Bounded Checklist

- First, create the root monorepo manifests (`package.json`, `bunfig.toml`, `tsconfig.base.json`, `docker-compose.yml`) plus the first `apps/web`, `apps/api`, and `apps/worker` entrypoints.
- Then, wire the minimal package graph so the apps can import a shared `packages/domain` module without circular bootstrap hacks.
- Next, make the skeleton bootable enough to host one project-create, ingest, and research path later in the phase.
- Finish by leaving one observable typed path—test, route, worker flow, or UI state—that proves the slice is ready for the next dependent step.

## Constraints and Non-Goals

- Optimize for a thin, end-to-end slice rather than broad but unexecutable scaffolding.
- Keep domain and infrastructure seams typed at the boundary and avoid leaking product behavior into Fred core.
- Each change should leave one user path closer to runnable with persistence, streaming, and citations all visible.

## Related Notes

- Step: [[02_Phases/Phase_01_walking_skeleton/Steps/Step_01_scaffold-monorepo-and-runtime-applications|STEP-01-01 Scaffold Monorepo and Runtime Applications]]
- Phase: [[02_Phases/Phase_01_walking_skeleton/Phase|Phase 01 walking skeleton]]
