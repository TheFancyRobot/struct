# Execution Brief

## Exact Outcome

- Produce the concrete contracts, artifacts, and bounded implementation/design surfaces for Allowlisted Read-Only SQL Service that this step is responsible for before any broader follow-on work begins.

## Prerequisites

- Re-read [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Phase|Phase 04 structured datasets and deterministic sql]] and confirm the step still matches the current roadmap sequence.
- Confirm the handoff from [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_02_implement-parquet-materialization-and-data-profiling|STEP-04-02 Implement Parquet Materialization and Data Profiling]] before widening scope.
- Keep deterministic work in typed Effect services, repositories, and tools; reserve Fred for agentic orchestration only.
- Treat the listed files as planned starting points; create only the smallest set needed to land the slice.

## Planned Starting Files

- These paths may not exist yet; use them as the first bounded implementation or design surface.
- `packages/data-engine/src/sql/allowlist.ts`
- `packages/data-engine/src/sql/validate.ts`
- `packages/data-engine/src/sql/execute.ts`
- `packages/data-engine/src/sql/errors.ts`
- `apps/api/src/routes/dataset-sql.ts`

## Required Reading

- [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Phase|Phase 04 structured datasets and deterministic sql]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
- [[01_Architecture/System_Overview|System Overview]]
- [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_02_implement-parquet-materialization-and-data-profiling|STEP-04-02 Implement Parquet Materialization and Data Profiling]]
- `docs/product-brief.md` sections 9-12, 18-25, 26-27, and 29-31.

## Concrete Deliverables

- Implement the SQL allowlist and validator that reject DDL/DML, unsafe pragmas, arbitrary attaches, and unrestricted file access before execution.
- Add a bounded executor that applies timeouts, row/output limits, and typed failure mapping around read-only DuckDB queries.
- Expose the API boundary for submitting a validated dataset query without leaking raw engine errors or widening access scope.

## Smallest Bounded Checklist

- First, implement the SQL allowlist and validator that reject DDL/DML, unsafe pragmas, arbitrary attaches, and unrestricted file access before execution.
- Then, add a bounded executor that applies timeouts, row/output limits, and typed failure mapping around read-only DuckDB queries.
- Next, expose the API boundary for submitting a validated dataset query without leaking raw engine errors or widening access scope.
- Finish by leaving one observable typed path—test, route, worker flow, or UI state—that proves the slice is ready for the next dependent step.

## Constraints and Non-Goals

- All exact answers must come from deterministic dataset tooling rather than model arithmetic or semantic guesswork.
- Schema-family grouping, Parquet materialization, and query provenance must preserve lineage to original files and stable record identity.
- SQL remains allowlisted, read-only, resource-bounded, and fully inspectable.

## Related Notes

- Step: [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_03_implement-allowlisted-read-only-sql-service|STEP-04-03 Implement Allowlisted Read-Only SQL Service]]
- Phase: [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Phase|Phase 04 structured datasets and deterministic sql]]
