# Execution Brief

## Exact Outcome

- Produce the bounded deterministic contracts for normalizing and reconciling cross-source evidence.

## Prerequisites

- Re-read [[02_Phases/Phase_07_hybrid_cross_source_research/Phase|Phase 07 hybrid cross source research]] and confirm the step still matches the current roadmap sequence.
- Confirm the handoff from [[02_Phases/Phase_07_hybrid_cross_source_research/Steps/Step_02_implement-parallel-document-and-dataset-research-branches|STEP-07-02 Implement Parallel Document and Dataset Research Branches]] before widening scope.
- Keep deterministic work in typed Effect services, repositories, and tools; reserve Fred for agentic orchestration only.
- Treat the listed files as planned starting points; create only the smallest set needed to land the slice.

## Planned Starting Files

- These paths may not exist yet; use them as the first bounded implementation or design surface.
- `packages/research-engine/src/normalize-evidence.ts`
- `packages/research-engine/src/reconcile-findings.ts`
- `packages/domain/src/evidence.ts`
- `packages/domain/src/reconciliation-result.ts`

## Required Reading

- [[02_Phases/Phase_07_hybrid_cross_source_research/Phase|Phase 07 hybrid cross source research]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[01_Architecture/System_Overview|System Overview]]
- [[02_Phases/Phase_07_hybrid_cross_source_research/Steps/Step_02_implement-parallel-document-and-dataset-research-branches|STEP-07-02 Implement Parallel Document and Dataset Research Branches]]
- `docs/product-brief.md` sections 9, 11-18, 22-24, 26-27, and 29-31.

## Concrete Deliverables

- Implement the narrowest typed slice for normalizing and reconciling cross-source evidence that the next step can call.
- Extend existing evidence, dataset-citation, research-finding, and contradiction contracts with one cross-source envelope and reconciliation result.
- Capture the orchestration or synthesis rules in `packages/research-engine/src/normalize-evidence.ts`, `packages/research-engine/src/reconcile-findings.ts` without moving deterministic work out of services/tools.

## Smallest Bounded Checklist

- First, implement the narrowest typed slice for normalizing and reconciling cross-source evidence that the next step can call.
- Then, extend existing evidence and contradiction contracts with one cross-source envelope and reconciliation result.
- Next, capture the orchestration or synthesis rules in `packages/research-engine/src/normalize-evidence.ts`, `packages/research-engine/src/reconcile-findings.ts` without moving deterministic work out of services/tools.
- Finish by leaving one observable typed path—test, route, worker flow, or UI state—that proves the slice is ready for the next dependent step.

## Constraints and Non-Goals

- Hybrid research must route exact questions to deterministic tools and use semantic analysis only where judgment is actually needed.
- Cross-source synthesis should preserve the distinction between computed facts, retrieved claims, inferences, contradictions, and limitations.
- Representative records, document evidence, and final citations must stay explorable in the UI and report layers.

## Related Notes

- Step: [[02_Phases/Phase_07_hybrid_cross_source_research/Steps/Step_03_normalize-and-reconcile-cross-source-evidence|STEP-07-03 Normalize and Reconcile Cross-Source Evidence]]
- Phase: [[02_Phases/Phase_07_hybrid_cross_source_research/Phase|Phase 07 hybrid cross source research]]

## Refined Implementation Boundary — 2026-07-20

- Build one narrow envelope over existing document citations, dataset/query snapshots, recursive evidence, coverage, and contradictions while retaining original payloads and immutable identities.
- Deterministically reconcile units, date windows, versions, filters, cohorts, and claim signatures. Outcomes are aligned, disclosed mismatch, contradictory, insufficient, or rejected; never guess conversions, joins, denominators, or time alignment.
- Reuse Phase 06 contradiction materialization/merge invariants rather than adding a second subsystem.
- Apply project Effect conventions plus `effect-ts`/`effect-best-practices` for tagged errors, named effects, exhaustive handling, and cancellation-safe bounded work.
- Model calls are out of scope; this is deterministic domain/research-engine work.
