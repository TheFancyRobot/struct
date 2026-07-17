# Execution Brief

## Exact Outcome

- Produce the concrete contracts, artifacts, and bounded implementation/design surfaces for Deterministic Dataset Query Tools and Citations that this step is responsible for before any broader follow-on work begins.

## Prerequisites

- Re-read [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Phase|Phase 04 structured datasets and deterministic sql]] and confirm the step still matches the current roadmap sequence.
- Confirm the handoff from [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_03_implement-allowlisted-read-only-sql-service|STEP-04-03 Implement Allowlisted Read-Only SQL Service]] before widening scope.
- Keep deterministic work in typed Effect services, repositories, and tools; reserve Fred for agentic orchestration only.
- Treat the listed files as planned starting points; create only the smallest set needed to land the slice.

## Planned Starting Files

- These paths may not exist yet; use them as the first bounded implementation or design surface.
- `packages/fred-workflows/src/tools/run-read-only-sql.ts`
- `packages/data-engine/src/citations.ts`
- `packages/research-engine/src/query-explanation.ts`
- `apps/api/src/routes/query-history.ts`
- `packages/domain/src/query-result-snapshot.ts`

## Required Reading

- [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Phase|Phase 04 structured datasets and deterministic sql]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
- [[01_Architecture/System_Overview|System Overview]]
- [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_03_implement-allowlisted-read-only-sql-service|STEP-04-03 Implement Allowlisted Read-Only SQL Service]]
- `docs/product-brief.md` sections 9-12, 18-25, 26-27, and 29-31.

## Concrete Deliverables

- Implement the narrowest typed slice for Deterministic Dataset Query Tools and Citations that is callable by the next step without broadening scope.
- Define or update typed domain modules for `QueryResultSnapshot` in `packages/domain/src/query-result-snapshot.ts`.
- Land the data-engine boundary in `packages/data-engine/src/citations.ts` with deterministic execution, explicit limits, and source-linked outputs.
- Capture the orchestration or synthesis rules in `packages/research-engine/src/query-explanation.ts` without moving deterministic work out of services/tools.

## Smallest Bounded Checklist

- First, implement the narrowest typed slice for Deterministic Dataset Query Tools and Citations that is callable by the next step without broadening scope.
- Then, define or update typed domain modules for `QueryResultSnapshot` in `packages/domain/src/query-result-snapshot.ts`.
- Next, land the data-engine boundary in `packages/data-engine/src/citations.ts` with deterministic execution, explicit limits, and source-linked outputs.
- Finish by leaving one observable typed path—test, route, worker flow, or UI state—that proves the slice is ready for the next dependent step.

## Constraints and Non-Goals

- All exact answers must come from deterministic dataset tooling rather than model arithmetic or semantic guesswork.
- Schema-family grouping, Parquet materialization, and query provenance must preserve lineage to original files and stable record identity.
- SQL remains allowlisted, read-only, resource-bounded, and fully inspectable.

## Related Notes

- Step: [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_04_build-deterministic-dataset-query-tools-and-citations|STEP-04-04 Build Deterministic Dataset Query Tools and Citations]]
- Phase: [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Phase|Phase 04 structured datasets and deterministic sql]]
