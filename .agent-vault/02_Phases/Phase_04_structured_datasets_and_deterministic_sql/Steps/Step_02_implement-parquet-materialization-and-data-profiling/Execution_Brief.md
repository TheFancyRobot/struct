# Execution Brief

## Exact Outcome

- Produce the concrete contracts, artifacts, and bounded implementation/design surfaces for Parquet Materialization and Data Profiling that this step is responsible for before any broader follow-on work begins.

## Prerequisites

- Re-read [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Phase|Phase 04 structured datasets and deterministic sql]] and confirm the step still matches the current roadmap sequence.
- Confirm the handoff from [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_01_define-dataset-assets-schemas-and-versioned-catalog|STEP-04-01 Define Dataset Assets Schemas and Versioned Catalog]] before widening scope.
- Keep deterministic work in typed Effect services, repositories, and tools; reserve Fred for agentic orchestration only.
- Treat the listed files as planned starting points; create only the smallest set needed to land the slice.

## Planned Starting Files

- These paths may not exist yet; use them as the first bounded implementation or design surface.
- `packages/data-engine/src/import-json.ts`
- `packages/data-engine/src/import-csv.ts`
- `packages/data-engine/src/materialize-parquet.ts`
- `packages/data-engine/src/profile-dataset.ts`
- `apps/worker/src/jobs/profile-dataset.ts`

## Required Reading

- [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Phase|Phase 04 structured datasets and deterministic sql]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
- [[01_Architecture/System_Overview|System Overview]]
- [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_01_define-dataset-assets-schemas-and-versioned-catalog|STEP-04-01 Define Dataset Assets Schemas and Versioned Catalog]]
- `docs/product-brief.md` sections 9-12, 18-25, 26-27, and 29-31.

## Concrete Deliverables

- Implement the narrowest typed slice for Parquet Materialization and Data Profiling that is callable by the next step without broadening scope.
- Land the data-engine boundary in `packages/data-engine/src/import-json.ts`, `packages/data-engine/src/import-csv.ts`, `packages/data-engine/src/materialize-parquet.ts` with deterministic execution, explicit limits, and source-linked outputs.
- Constrain worker-side execution in `apps/worker/src/jobs/profile-dataset.ts` to one resumable, observable path for this slice.

## Smallest Bounded Checklist

- First, implement the narrowest typed slice for Parquet Materialization and Data Profiling that is callable by the next step without broadening scope.
- Then, land the data-engine boundary in `packages/data-engine/src/import-json.ts`, `packages/data-engine/src/import-csv.ts`, `packages/data-engine/src/materialize-parquet.ts` with deterministic execution, explicit limits, and source-linked outputs.
- Next, constrain worker-side execution in `apps/worker/src/jobs/profile-dataset.ts` to one resumable, observable path for this slice.
- Finish by leaving one observable typed path—test, route, worker flow, or UI state—that proves the slice is ready for the next dependent step.

## Constraints and Non-Goals

- All exact answers must come from deterministic dataset tooling rather than model arithmetic or semantic guesswork.
- Schema-family grouping, Parquet materialization, and query provenance must preserve lineage to original files and stable record identity.
- SQL remains allowlisted, read-only, resource-bounded, and fully inspectable.

## Related Notes

- Step: [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_02_implement-parquet-materialization-and-data-profiling|STEP-04-02 Implement Parquet Materialization and Data Profiling]]
- Phase: [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Phase|Phase 04 structured datasets and deterministic sql]]
