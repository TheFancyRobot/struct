# Validation Plan

## Acceptance Checks

- Confirm this deliverable is present, testable where applicable, and bounded to the step: The SQL allowlist and validator that reject DDL/DML, unsafe pragmas, arbitrary attaches, and unrestricted file access before execution.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: A bounded executor that applies timeouts, row/output limits, and typed failure mapping around read-only DuckDB queries.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: The API boundary for submitting a validated dataset query without leaking raw engine errors or widening access scope.
- The step leaves the next dependent step with a stable typed boundary, not a placeholder or undocumented assumption.

## Planned Verification

- Plan validator tests for allowed selects/aggregates/joins plus explicit reject cases for mutation, attach, pragma, and over-broad output.
- Plan an integration test that runs one successful query and one timeout or invalid-SQL case through the API surface.
- Planned command once these packages exist: `bun test packages/data-engine` plus the nearest package-level `bun run typecheck`.
- Planned app/integration coverage once the app surfaces exist: `bun test apps/api` for the API/worker/web path touched here.

## Edge Cases

- Queries that are syntactically valid but reference unknown tables/fields must fail before hitting the engine.
- Timeouts, memory pressure, and cancellation must surface as typed failures that later recovery logic can reason about.
- Error messages must preserve enough debugging detail for operators without leaking file paths or internals to end users.

## Regression Expectations

- This step should remain a clean successor to [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_02_implement-parquet-materialization-and-data-profiling|STEP-04-02 Implement Parquet Materialization and Data Profiling]] rather than reworking already-planned scope upstream.
- Do not regress document and directory provenance while adding structured-data paths.
- Keep query history, result snapshots, and citations stable enough for later hybrid research and report generation.
- Do not allow convenience features to bypass SQL validation, timeouts, or output bounds.

## Security / Observability / Evaluation Focus

- Explicitly guard against unsafe pragmas, file access, oversized materialization, and schema hallucination.
- Preserve deterministic result hashes, row limits, and stable source-snapshot references.
- Extend evaluation with exact computation and prompt-injection cases tied to structured data.
- Keep exact-computation outputs tied to query text, result snapshots, and stable dataset citations so later synthesis cannot blur them.

## Related Notes

- Step: [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_03_implement-allowlisted-read-only-sql-service|STEP-04-03 Implement Allowlisted Read-Only SQL Service]]
- Phase: [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Phase|Phase 04 structured datasets and deterministic sql]]
