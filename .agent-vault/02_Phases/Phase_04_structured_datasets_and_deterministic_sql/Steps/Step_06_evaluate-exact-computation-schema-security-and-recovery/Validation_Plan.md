# Validation Plan

## Acceptance Checks

- Confirm this deliverable is present, testable where applicable, and bounded to the step: The exact-computation evaluation against schema drift, SQL safety, timeout, and recovery scenarios that matter for v1 dataset trustworthiness.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: Which failures are correctness bugs, which are guardrail bugs, and which require operational recovery behavior.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: Benchmark/report artifacts that prove exact answers and citation lineage survive interruption and restart.
- The output includes a clear pass/fail signal, recorded defects or blockers, and the next action for anything intentionally left unresolved.

## Planned Verification

- Plan the exact-computation suite, API guardrail tests, and worker recovery scenarios as separate categories with explicit pass/fail gates.
- Plan at least one restart test where a dataset query or materialization is interrupted and retried without corrupting snapshot lineage.
- Planned command once these packages exist: `bun test packages/evaluation` plus the nearest package-level `bun run typecheck`.
- Planned app/integration coverage once the app surfaces exist: `bun test apps/api apps/worker` for the API/worker/web path touched here.

## Edge Cases

- A query that returns a plausible but wrong exact answer is more severe than a visible failure; treat it as a release blocker in the plan.
- Schema evolution between dataset snapshots must not let old citations silently point at new rows/fields.
- Recovery tests should include partially written Parquet/output artifacts and ensure cleanup or safe reuse is defined.

## Regression Expectations

- This step should remain a clean successor to [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_05_generate-reproducible-25000-json-corpus-and-ground-truth|STEP-04-05 Generate Reproducible 25000 JSON Corpus and Ground Truth]] rather than reworking already-planned scope upstream.
- Do not regress document and directory provenance while adding structured-data paths.
- Keep query history, result snapshots, and citations stable enough for later hybrid research and report generation.
- Do not allow convenience features to bypass SQL validation, timeouts, or output bounds.

## Security / Observability / Evaluation Focus

- Explicitly guard against unsafe pragmas, file access, oversized materialization, and schema hallucination.
- Preserve deterministic result hashes, row limits, and stable source-snapshot references.
- Extend evaluation with exact computation and prompt-injection cases tied to structured data.
- Trace every restart, cancel, and replay decision with run/step identifiers so operators can reconstruct the timeline after failure.

## Related Notes

- Step: [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_06_evaluate-exact-computation-schema-security-and-recovery|STEP-04-06 Evaluate Exact Computation Schema Security and Recovery]]
- Phase: [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Phase|Phase 04 structured datasets and deterministic sql]]
