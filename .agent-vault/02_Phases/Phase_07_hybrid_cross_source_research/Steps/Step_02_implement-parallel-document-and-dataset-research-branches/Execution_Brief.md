# Execution Brief

## Exact Outcome

- Produce the concrete contracts, artifacts, and bounded implementation/design surfaces for Parallel Document and Dataset Research Branches that this step is responsible for before any broader follow-on work begins.

## Prerequisites

- Re-read [[02_Phases/Phase_07_hybrid_cross_source_research/Phase|Phase 07 hybrid cross source research]] and confirm the step still matches the current roadmap sequence.
- Confirm the handoff from [[02_Phases/Phase_07_hybrid_cross_source_research/Steps/Step_01_define-hybrid-question-decomposition-and-source-routing|STEP-07-01 Define Hybrid Question Decomposition and Source Routing]] before widening scope.
- Keep deterministic work in typed Effect services, repositories, and tools; reserve Fred for agentic orchestration only.
- Treat the listed files as planned starting points; create only the smallest set needed to land the slice.

## Planned Starting Files

- These paths may not exist yet; use them as the first bounded implementation or design surface.
- `packages/fred-workflows/src/graphs/hybrid-research.ts`
- `packages/research-engine/src/run-hybrid-branches.ts`
- `apps/worker/src/jobs/hybrid-research.ts`
- `packages/domain/src/branch-execution.ts`

## Required Reading

- [[02_Phases/Phase_07_hybrid_cross_source_research/Phase|Phase 07 hybrid cross source research]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[01_Architecture/System_Overview|System Overview]]
- [[02_Phases/Phase_07_hybrid_cross_source_research/Steps/Step_01_define-hybrid-question-decomposition-and-source-routing|STEP-07-01 Define Hybrid Question Decomposition and Source Routing]]
- `docs/product-brief.md` sections 9, 11-18, 22-24, 26-27, and 29-31.

## Concrete Deliverables

- Implement the narrowest typed slice for Parallel Document and Dataset Research Branches that is callable by the next step without broadening scope.
- Define or update typed domain modules for `Branch Execution` in `packages/domain/src/branch-execution.ts`.
- Capture the orchestration or synthesis rules in `packages/research-engine/src/run-hybrid-branches.ts` without moving deterministic work out of services/tools.
- Keep Fred-specific graph/agent wiring isolated to `packages/fred-workflows/src/graphs/hybrid-research.ts` and typed at every boundary.

## Smallest Bounded Checklist

- First, implement the narrowest typed slice for Parallel Document and Dataset Research Branches that is callable by the next step without broadening scope.
- Then, define or update typed domain modules for `Branch Execution` in `packages/domain/src/branch-execution.ts`.
- Next, capture the orchestration or synthesis rules in `packages/research-engine/src/run-hybrid-branches.ts` without moving deterministic work out of services/tools.
- Finish by leaving one observable typed path—test, route, worker flow, or UI state—that proves the slice is ready for the next dependent step.

## Constraints and Non-Goals

- Hybrid research must route exact questions to deterministic tools and use semantic analysis only where judgment is actually needed.
- Cross-source synthesis should preserve the distinction between computed facts, retrieved claims, inferences, contradictions, and limitations.
- Representative records, document evidence, and final citations must stay explorable in the UI and report layers.

## Related Notes

- Step: [[02_Phases/Phase_07_hybrid_cross_source_research/Steps/Step_02_implement-parallel-document-and-dataset-research-branches|STEP-07-02 Implement Parallel Document and Dataset Research Branches]]
- Phase: [[02_Phases/Phase_07_hybrid_cross_source_research/Phase|Phase 07 hybrid cross source research]]
