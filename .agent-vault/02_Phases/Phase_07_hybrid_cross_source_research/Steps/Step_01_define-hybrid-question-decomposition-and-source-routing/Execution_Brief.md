# Execution Brief

## Exact Outcome

- Produce the concrete contracts, artifacts, and bounded implementation/design surfaces for Hybrid Question Decomposition and Source Routing that this step is responsible for before any broader follow-on work begins.

## Prerequisites

- Re-read [[02_Phases/Phase_07_hybrid_cross_source_research/Phase|Phase 07 hybrid cross source research]] and confirm the step still matches the current roadmap sequence.
- Confirm the handoff from [[02_Phases/Phase_06_recursive_corpus_analysis/Steps/Step_06_evaluate-25000-file-recursive-analysis-and-recovery|STEP-06-06 Evaluate 25000-File Recursive Analysis and Recovery]] before widening scope.
- Keep deterministic work in typed Effect services, repositories, and tools; reserve Fred for agentic orchestration only.
- Treat the listed files as planned starting points; create only the smallest set needed to land the slice.

## Planned Starting Files

- Start from these existing production surfaces and add files only when a cohesive boundary requires one.
- `packages/domain/src/research-plan.ts`
- `packages/research-engine/src/validate-plan.ts`
- `packages/research-engine/src/normalize-plan.ts`
- `packages/workflows/src/agents/question-classifier.ts`
- `packages/workflows/src/agents/research-planner.ts`
- `packages/workflows/src/graphs/research-run.ts`
- `apps/worker/src/jobs/research-planning.ts`
- `docs/hybrid-research.md`

## Required Reading

- [[02_Phases/Phase_07_hybrid_cross_source_research/Phase|Phase 07 hybrid cross source research]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[01_Architecture/System_Overview|System Overview]]
- [[02_Phases/Phase_06_recursive_corpus_analysis/Steps/Step_06_evaluate-25000-file-recursive-analysis-and-recovery|STEP-06-06 Evaluate 25000-File Recursive Analysis and Recovery]]
- `docs/product-brief.md` sections 9, 11-18, 22-24, 26-27, and 29-31.

## Concrete Deliverables

- Define the concrete contract for Hybrid Question Decomposition and Source Routing in the first planned domain, persistence, or documentation files so downstream implementation does not need to rediscover the boundary.
- Extend the existing typed `ResearchPlan` and routing contracts in `packages/domain/src/research-plan.ts`.
- Capture the orchestration or synthesis rules in `packages/research-engine/src/route-sources.ts`, `packages/research-engine/src/question-decomposition.ts` without moving deterministic work out of services/tools.
- Capture the durable contract or operator guidance in `docs/hybrid-research.md` rather than burying it in session-only notes.

## Smallest Bounded Checklist

- First, define the concrete contract for Hybrid Question Decomposition and Source Routing in the first planned domain, persistence, or documentation files so downstream implementation does not need to rediscover the boundary.
- Then, extend the existing typed `ResearchPlan` and routing contracts in `packages/domain/src/research-plan.ts`.
- Next, capture the orchestration or synthesis rules in `packages/research-engine/src/route-sources.ts`, `packages/research-engine/src/question-decomposition.ts` without moving deterministic work out of services/tools.
- Finish by recording the chosen contract, recommendation, or runbook in the planned docs/ADR artifacts before expanding scope.

## Constraints and Non-Goals

- Hybrid research must route exact questions to deterministic tools and use semantic analysis only where judgment is actually needed.
- Cross-source synthesis should preserve the distinction between computed facts, retrieved claims, inferences, contradictions, and limitations.
- Representative records, document evidence, and final citations must stay explorable in the UI and report layers.

## Related Notes

- Step: [[02_Phases/Phase_07_hybrid_cross_source_research/Steps/Step_01_define-hybrid-question-decomposition-and-source-routing|STEP-07-01 Define Hybrid Question Decomposition and Source Routing]]
- Phase: [[02_Phases/Phase_07_hybrid_cross_source_research/Phase|Phase 07 hybrid cross source research]]

## Refined Implementation Boundary — 2026-07-20

- Extend existing `ResearchPlan`, plan-node, `sourceScopes`, planning-policy, validation, and Fred compiler contracts; add no parallel plan abstraction.
- Add only typed routing fields for document, dataset, optional recursive, and synthesis nodes with visible dependencies, evidence requirements, immutable source identities, and budgets.
- Deterministically route validated nodes to existing document research, dataset-query, or Phase 06 recursive preparation; synthesis waits for required predecessors.
- Follow repository Effect patterns plus `effect-ts`/`effect-best-practices`: schema-tagged errors, named `Effect.fn`, tagged recovery, bounded concurrency, and cancellation propagation.
- Deliver focused domain/research-engine/workflow tests and `docs/hybrid-research.md`; persistence, execution, and UI are out of scope.
