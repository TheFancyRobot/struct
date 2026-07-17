# Execution Brief

## Exact Outcome

- Produce the concrete contracts, artifacts, and bounded implementation/design surfaces for Typed Research Plan and Execution Schemas that this step is responsible for before any broader follow-on work begins.

## Prerequisites

- Re-read [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Phase|Phase 05 typed research planning and bounded execution]] and confirm the step still matches the current roadmap sequence.
- Confirm both prerequisite handoffs before widening scope: [[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Steps/Step_06_evaluate-retrieval-provenance-and-injection-resistance|STEP-02-06 Evaluate Retrieval Provenance and Injection Resistance]] and [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_06_evaluate-exact-computation-schema-security-and-recovery|STEP-04-06 Evaluate Exact Computation Schema Security and Recovery]].
- Keep deterministic work in typed Effect services, repositories, and tools; reserve Fred for agentic orchestration only.
- Treat the listed files as planned starting points; create only the smallest set needed to land the slice.

## Planned Starting Files

- These paths may not exist yet; use them as the first bounded implementation or design surface.
- `packages/domain/src/research-plan.ts`
- `packages/domain/src/research-step.ts`
- `packages/domain/src/research-limits.ts`
- `packages/research-engine/src/plan-schema.ts`
- `packages/research-engine/src/intent-classification.ts`

## Required Reading

- [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Phase|Phase 05 typed research planning and bounded execution]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[01_Architecture/System_Overview|System Overview]]
- [[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Steps/Step_06_evaluate-retrieval-provenance-and-injection-resistance|STEP-02-06 Evaluate Retrieval Provenance and Injection Resistance]]
- [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_06_evaluate-exact-computation-schema-security-and-recovery|STEP-04-06 Evaluate Exact Computation Schema Security and Recovery]]
- `docs/product-brief.md` sections 13, 15, 18-24, 26-27, and 29-31.

## Concrete Deliverables

- Define the concrete contract for Typed Research Plan and Execution Schemas in the first planned domain, persistence, or documentation files so downstream implementation does not need to rediscover the boundary.
- Define or update typed domain modules for `ResearchPlan`, `ResearchStep`, `Research Limits` in `packages/domain/src/research-plan.ts`, `packages/domain/src/research-step.ts`, `packages/domain/src/research-limits.ts`.
- Capture the orchestration or synthesis rules in `packages/research-engine/src/plan-schema.ts`, `packages/research-engine/src/intent-classification.ts` without moving deterministic work out of services/tools.

## Smallest Bounded Checklist

- First, define the concrete contract for Typed Research Plan and Execution Schemas in the first planned domain, persistence, or documentation files so downstream implementation does not need to rediscover the boundary.
- Then, define or update typed domain modules for `ResearchPlan`, `ResearchStep`, `Research Limits` in `packages/domain/src/research-plan.ts`, `packages/domain/src/research-step.ts`, `packages/domain/src/research-limits.ts`.
- Next, capture the orchestration or synthesis rules in `packages/research-engine/src/plan-schema.ts`, `packages/research-engine/src/intent-classification.ts` without moving deterministic work out of services/tools.
- Finish by leaving one observable typed path—test, route, worker flow, or UI state—that proves the slice is ready for the next dependent step.

## Constraints and Non-Goals

- Research plans, tools, and workflow state must all use typed schemas and typed failures.
- Budgets, cancellation, duplicate-action detection, and no-progress detection are product requirements, not optional polish.
- Keep deterministic inspection, retrieval, and SQL execution in Effect services/tools; Fred should orchestrate judgment, not replace core services.

## Related Notes

- Step: [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Steps/Step_01_define-typed-research-plan-and-execution-schemas|STEP-05-01 Define Typed Research Plan and Execution Schemas]]
- Phase: [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Phase|Phase 05 typed research planning and bounded execution]]
