# Execution Brief

## Exact Outcome

- Produce the concrete contracts, artifacts, and bounded implementation/design surfaces for Reproducible 25000 JSON Corpus and Ground Truth that this step is responsible for before any broader follow-on work begins.

## Prerequisites

- Re-read [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Phase|Phase 04 structured datasets and deterministic sql]] and confirm the step still matches the current roadmap sequence.
- Confirm the handoff from [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_04_build-deterministic-dataset-query-tools-and-citations|STEP-04-04 Build Deterministic Dataset Query Tools and Citations]] before widening scope.
- Keep deterministic work in typed Effect services, repositories, and tools; reserve Fred for agentic orchestration only.
- Treat the listed files as planned starting points; create only the smallest set needed to land the slice.

## Planned Starting Files

- These paths may not exist yet; use them as the first bounded implementation or design surface.
- `packages/evaluation/src/corpus/generate.ts`
- `packages/evaluation/src/ground-truth/exact-computation.ts`
- `packages/evaluation/src/fixtures/datasets/README.md`
- `docs/evaluation-corpus.md`

## Required Reading

- [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Phase|Phase 04 structured datasets and deterministic sql]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
- [[01_Architecture/System_Overview|System Overview]]
- [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_04_build-deterministic-dataset-query-tools-and-citations|STEP-04-04 Build Deterministic Dataset Query Tools and Citations]]
- `docs/product-brief.md` sections 9-12, 18-25, 26-27, and 29-31.

## Concrete Deliverables

- Generate the reproducible ~25,000 JSON corpus with multiple schema families, controlled trends, contradictions, and prompt-injection strings.
- Publish deterministic ground-truth answers for exact-computation questions so SQL correctness can be asserted without model judgment.
- Document the corpus layout and generation knobs so later benchmark reports can cite the same fixture assumptions.

## Smallest Bounded Checklist

- First, generate the reproducible ~25,000 JSON corpus with multiple schema families, controlled trends, contradictions, and prompt-injection strings.
- Then, publish deterministic ground-truth answers for exact-computation questions so SQL correctness can be asserted without model judgment.
- Next, document the corpus layout and generation knobs so later benchmark reports can cite the same fixture assumptions.
- Finish by capturing the deterministic fixture, benchmark, or gate evidence that will let the validation plan judge the slice without guesswork.

## Constraints and Non-Goals

- All exact answers must come from deterministic dataset tooling rather than model arithmetic or semantic guesswork.
- Schema-family grouping, Parquet materialization, and query provenance must preserve lineage to original files and stable record identity.
- SQL remains allowlisted, read-only, resource-bounded, and fully inspectable.

## Related Notes

- Step: [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_05_generate-reproducible-25000-json-corpus-and-ground-truth|STEP-04-05 Generate Reproducible 25000 JSON Corpus and Ground Truth]]
- Phase: [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Phase|Phase 04 structured datasets and deterministic sql]]
