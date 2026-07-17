# Execution Brief

## Exact Outcome

- Produce the concrete contracts, artifacts, and bounded implementation/design surfaces for Exact Computation Schema Security and Recovery that this step is responsible for before any broader follow-on work begins.

## Prerequisites

- Re-read [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Phase|Phase 04 structured datasets and deterministic sql]] and confirm the step still matches the current roadmap sequence.
- Confirm the handoff from [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_05_generate-reproducible-25000-json-corpus-and-ground-truth|STEP-04-05 Generate Reproducible 25000 JSON Corpus and Ground Truth]] before widening scope.
- Keep deterministic work in typed Effect services, repositories, and tools; reserve Fred for agentic orchestration only.
- Treat the listed files as planned starting points; create only the smallest set needed to land the slice.

## Planned Starting Files

- These paths may not exist yet; use them as the first bounded implementation or design surface.
- `packages/evaluation/src/exact-computation.ts`
- `apps/api/test/sql-guardrails.integration.test.ts`
- `apps/worker/test/dataset-recovery.integration.test.ts`
- `docs/benchmarks/structured-data.md`

## Required Reading

- [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Phase|Phase 04 structured datasets and deterministic sql]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
- [[01_Architecture/System_Overview|System Overview]]
- [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_05_generate-reproducible-25000-json-corpus-and-ground-truth|STEP-04-05 Generate Reproducible 25000 JSON Corpus and Ground Truth]]
- `docs/product-brief.md` sections 9-12, 18-25, 26-27, and 29-31.

## Concrete Deliverables

- Run the exact-computation evaluation against schema drift, SQL safety, timeout, and recovery scenarios that matter for v1 dataset trustworthiness.
- Record which failures are correctness bugs, which are guardrail bugs, and which require operational recovery behavior.
- Capture benchmark/report artifacts that prove exact answers and citation lineage survive interruption and restart.

## Smallest Bounded Checklist

- First, run the exact-computation evaluation against schema drift, SQL safety, timeout, and recovery scenarios that matter for v1 dataset trustworthiness.
- Then, record which failures are correctness bugs, which are guardrail bugs, and which require operational recovery behavior.
- Next, capture benchmark/report artifacts that prove exact answers and citation lineage survive interruption and restart.
- Finish by capturing the deterministic fixture, benchmark, or gate evidence that will let the validation plan judge the slice without guesswork.

## Constraints and Non-Goals

- All exact answers must come from deterministic dataset tooling rather than model arithmetic or semantic guesswork.
- Schema-family grouping, Parquet materialization, and query provenance must preserve lineage to original files and stable record identity.
- SQL remains allowlisted, read-only, resource-bounded, and fully inspectable.

## Related Notes

- Step: [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_06_evaluate-exact-computation-schema-security-and-recovery|STEP-04-06 Evaluate Exact Computation Schema Security and Recovery]]
- Phase: [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Phase|Phase 04 structured datasets and deterministic sql]]
