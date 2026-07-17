# Validation Plan

## Acceptance Checks

- Confirm this deliverable is present, testable where applicable, and bounded to the step: The narrowest typed slice for Parquet Materialization and Data Profiling that is callable by the next step without broadening scope.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: The data-engine boundary in `packages/data-engine/src/import-json.ts`, `packages/data-engine/src/import-csv.ts`, `packages/data-engine/src/materialize-parquet.ts` with deterministic execution, explicit limits, and source-linked outputs.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: Worker-side execution in `apps/worker/src/jobs/profile-dataset.ts` to one resumable, observable path for this slice.
- The step leaves the next dependent step with a stable typed boundary, not a placeholder or undocumented assumption.

## Planned Verification

- Planned command once these packages exist: `bun test packages/data-engine` plus the nearest package-level `bun run typecheck`.
- Planned app/integration coverage once the app surfaces exist: `bun test apps/worker` for the API/worker/web path touched here.

## Edge Cases

- Partial progress, retries, or restarts should leave this step in a typed, inspectable state rather than a silent half-success.
- Read-only violations, schema mismatch, oversized result sets, and engine/resource limits should fail before producing misleading results.

## Regression Expectations

- This step should remain a clean successor to [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_01_define-dataset-assets-schemas-and-versioned-catalog|STEP-04-01 Define Dataset Assets Schemas and Versioned Catalog]] rather than reworking already-planned scope upstream.
- Do not regress document and directory provenance while adding structured-data paths.
- Keep query history, result snapshots, and citations stable enough for later hybrid research and report generation.
- Do not allow convenience features to bypass SQL validation, timeouts, or output bounds.

## Security / Observability / Evaluation Focus

- Explicitly guard against unsafe pragmas, file access, oversized materialization, and schema hallucination.
- Preserve deterministic result hashes, row limits, and stable source-snapshot references.
- Extend evaluation with exact computation and prompt-injection cases tied to structured data.

## Related Notes

- Step: [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_02_implement-parquet-materialization-and-data-profiling|STEP-04-02 Implement Parquet Materialization and Data Profiling]]
- Phase: [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Phase|Phase 04 structured datasets and deterministic sql]]
