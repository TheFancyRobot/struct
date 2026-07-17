# Validation Plan

## Acceptance Checks

- Confirm this deliverable is present, testable where applicable, and bounded to the step: The reproducible ~25,000 JSON corpus with multiple schema families, controlled trends, contradictions, and prompt-injection strings.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: Deterministic ground-truth answers for exact-computation questions so SQL correctness can be asserted without model judgment.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: Document the corpus layout and generation knobs so later benchmark reports can cite the same fixture assumptions.
- The step leaves the next dependent step with a stable typed boundary, not a placeholder or undocumented assumption.

## Planned Verification

- Plan a generator determinism test that confirms repeated runs with the same seed produce the same corpus metadata and ground-truth outputs.
- Plan sanity checks for record counts, schema-family distribution, trend labels, and injected adversarial cases.
- Planned command once these packages exist: `bun test packages/evaluation` plus the nearest package-level `bun run typecheck`.
- Run the evaluation/benchmark fixture for this slice and store the corpus, seed, or hardware assumptions alongside the result.

## Edge Cases

- The generator must cover deleted/changed records and schema conflicts so refresh and recovery work can be evaluated later.
- Ground truth should distinguish exact numeric answers from semantic expectations instead of collapsing everything into narrative summaries.
- Large generated output should remain partitionable and referenceable so future tests do not require re-materializing everything into prompts.

## Regression Expectations

- This step should remain a clean successor to [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_04_build-deterministic-dataset-query-tools-and-citations|STEP-04-04 Build Deterministic Dataset Query Tools and Citations]] rather than reworking already-planned scope upstream.
- Do not regress document and directory provenance while adding structured-data paths.
- Keep query history, result snapshots, and citations stable enough for later hybrid research and report generation.
- Do not allow convenience features to bypass SQL validation, timeouts, or output bounds.

## Security / Observability / Evaluation Focus

- Explicitly guard against unsafe pragmas, file access, oversized materialization, and schema hallucination.
- Preserve deterministic result hashes, row limits, and stable source-snapshot references.
- Extend evaluation with exact computation and prompt-injection cases tied to structured data.

## Related Notes

- Step: [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_05_generate-reproducible-25000-json-corpus-and-ground-truth|STEP-04-05 Generate Reproducible 25000 JSON Corpus and Ground Truth]]
- Phase: [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Phase|Phase 04 structured datasets and deterministic sql]]
