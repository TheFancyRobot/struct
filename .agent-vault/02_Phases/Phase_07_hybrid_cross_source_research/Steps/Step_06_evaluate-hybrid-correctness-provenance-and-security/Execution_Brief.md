# Execution Brief

## Exact Outcome

- Produce the concrete contracts, artifacts, and bounded implementation/design surfaces for Hybrid Correctness Provenance and Security that this step is responsible for before any broader follow-on work begins.

## Prerequisites

- Re-read [[02_Phases/Phase_07_hybrid_cross_source_research/Phase|Phase 07 hybrid cross source research]] and confirm the step still matches the current roadmap sequence.
- Confirm the handoff from [[02_Phases/Phase_07_hybrid_cross_source_research/Steps/Step_05_deliver-mixed-source-demo-and-explorable-report|STEP-07-05 Deliver Mixed-Source Demo and Explorable Report]] before widening scope.
- Keep deterministic work in typed Effect services, repositories, and tools; reserve Fred for agentic orchestration only.
- Treat the listed files as planned starting points; create only the smallest set needed to land the slice.

## Planned Starting Files

- These paths may not exist yet; use them as the first bounded implementation or design surface.
- `packages/evaluation/src/hybrid-research.ts`
- `packages/evaluation/src/prompt-injection-hybrid.ts`
- `apps/api/test/hybrid-research.integration.test.ts`
- `docs/benchmarks/hybrid-research.md`

## Required Reading

- [[02_Phases/Phase_07_hybrid_cross_source_research/Phase|Phase 07 hybrid cross source research]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[01_Architecture/System_Overview|System Overview]]
- [[02_Phases/Phase_07_hybrid_cross_source_research/Steps/Step_05_deliver-mixed-source-demo-and-explorable-report|STEP-07-05 Deliver Mixed-Source Demo and Explorable Report]]
- `docs/product-brief.md` sections 9, 11-18, 22-24, 26-27, and 29-31.

## Concrete Deliverables

- Evaluate mixed document+dataset research for quantitative correctness, citation provenance, contradiction handling, and prompt-injection resistance.
- Prove that hybrid answers keep exact SQL-derived facts separate from qualitative synthesis and document evidence.
- Record the failure taxonomy for hybrid runs: wrong routing, stale citations, unsupported reconciliation, and security boundary violations.

## Smallest Bounded Checklist

- First, evaluate mixed document+dataset research for quantitative correctness, citation provenance, contradiction handling, and prompt-injection resistance.
- Then, prove that hybrid answers keep exact SQL-derived facts separate from qualitative synthesis and document evidence.
- Next, record the failure taxonomy for hybrid runs: wrong routing, stale citations, unsupported reconciliation, and security boundary violations.
- Finish by capturing the deterministic fixture, benchmark, or gate evidence that will let the validation plan judge the slice without guesswork.

## Constraints and Non-Goals

- Hybrid research must route exact questions to deterministic tools and use semantic analysis only where judgment is actually needed.
- Cross-source synthesis should preserve the distinction between computed facts, retrieved claims, inferences, contradictions, and limitations.
- Representative records, document evidence, and final citations must stay explorable in the UI and report layers.

## Related Notes

- Step: [[02_Phases/Phase_07_hybrid_cross_source_research/Steps/Step_06_evaluate-hybrid-correctness-provenance-and-security|STEP-07-06 Evaluate Hybrid Correctness Provenance and Security]]
- Phase: [[02_Phases/Phase_07_hybrid_cross_source_research/Phase|Phase 07 hybrid cross source research]]

## Refined Implementation Boundary — 2026-07-20

This supersedes the earlier generic wording.

- Build a deterministic checked-in fixture and machine-readable report derived from execution, not hard-coded counts. Include document-only, dataset-only, recursive-only, mixed exact-computation-plus-document, and contradiction/version-mismatch cases.
- Evaluate DAG validity, exact quantitative claims, semantic retrieval, dual provenance, mismatch handling, contradiction/insufficiency, budgets/cost/concurrency, cancellation/restart/replay, and model routing.
- Include document/dataset-string prompt injections attempting to alter permissions, instructions, budgets, or citation requirements; content remains untrusted data.
- Verify criterion IDs/counts/status/evidence/hashes semantically and cryptographically so recomputed-hash tampering cannot manufacture a pass.
- Record every failure as a confirmed bug and block completion until fixed; never waive defects or lower thresholds.
