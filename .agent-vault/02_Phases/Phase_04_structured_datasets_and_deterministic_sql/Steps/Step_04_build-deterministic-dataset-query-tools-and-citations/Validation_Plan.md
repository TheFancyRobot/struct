# Validation Plan

## Acceptance Checks

- Confirm this deliverable is present, testable where applicable, and bounded to the step: The narrowest typed slice for Deterministic Dataset Query Tools and Citations that is callable by the next step without broadening scope.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: update typed domain modules for `QueryResultSnapshot` in `packages/domain/src/query-result-snapshot.ts`.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: The data-engine boundary in `packages/data-engine/src/citations.ts` with deterministic execution, explicit limits, and source-linked outputs.
- The step leaves the next dependent step with a stable typed boundary, not a placeholder or undocumented assumption.

## Planned Verification

- Planned command once these packages exist: `bun test packages/data-engine packages/domain packages/fred-workflows packages/research-engine` plus the nearest package-level `bun run typecheck`.
- Planned app/integration coverage once the app surfaces exist: `bun test apps/api` for the API/worker/web path touched here.

## Edge Cases

- Partial progress, retries, or restarts should leave this step in a typed, inspectable state rather than a silent half-success.
- Unsupported formats, stale chunk references, and citation-open failures should surface explicitly instead of degrading to uncited answers.
- Read-only violations, schema mismatch, oversized result sets, and engine/resource limits should fail before producing misleading results.

## Regression Expectations

- This step should remain a clean successor to [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_03_implement-allowlisted-read-only-sql-service|STEP-04-03 Implement Allowlisted Read-Only SQL Service]] rather than reworking already-planned scope upstream.
- Do not regress document and directory provenance while adding structured-data paths.
- Keep query history, result snapshots, and citations stable enough for later hybrid research and report generation.
- Do not allow convenience features to bypass SQL validation, timeouts, or output bounds.

## Security / Observability / Evaluation Focus

- Explicitly guard against unsafe pragmas, file access, oversized materialization, and schema hallucination.
- Preserve deterministic result hashes, row limits, and stable source-snapshot references.
- Extend evaluation with exact computation and prompt-injection cases tied to structured data.
- Keep exact-computation outputs tied to query text, result snapshots, and stable dataset citations so later synthesis cannot blur them.

## Related Notes

- Step: [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_04_build-deterministic-dataset-query-tools-and-citations|STEP-04-04 Build Deterministic Dataset Query Tools and Citations]]
- Phase: [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Phase|Phase 04 structured datasets and deterministic sql]]
