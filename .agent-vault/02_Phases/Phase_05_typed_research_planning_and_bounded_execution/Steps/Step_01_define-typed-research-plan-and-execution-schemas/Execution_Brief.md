# Execution Brief

## Exact Outcome

- Add the shared Effect Schema contracts and typed validation failures that let later Phase 05 steps exchange research classifications, plans, nodes, dependencies, budgets, tool policies, evidence requirements, and serializable execution state without model, Fred, persistence, or worker behavior.

## Prerequisites

- Re-read [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Phase|Phase 05 typed research planning and bounded execution]] and confirm the step still matches the current roadmap sequence.
- Confirm both prerequisite handoffs before widening scope: [[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Steps/Step_06_evaluate-retrieval-provenance-and-injection-resistance|STEP-02-06 Evaluate Retrieval Provenance and Injection Resistance]] and [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_06_evaluate-exact-computation-schema-security-and-recovery|STEP-04-06 Evaluate Exact Computation Schema Security and Recovery]].
- Keep deterministic work in typed Effect services, repositories, and tools; reserve Fred for agentic orchestration only.
- Extend the existing `@struct/domain` package and its current branded-ID/error conventions; do not create a new package.

## Planned Starting Files

- `packages/domain/src/research-plan.ts`
- `packages/domain/src/research-execution.ts`
- `packages/domain/src/typed-errors.ts`
- `packages/domain/src/index.ts`
- Focused colocated `bun:test` files for the new schemas.

## Required Reading

- [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Phase|Phase 05 typed research planning and bounded execution]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[01_Architecture/System_Overview|System Overview]]
- [[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Steps/Step_06_evaluate-retrieval-provenance-and-injection-resistance|STEP-02-06 Evaluate Retrieval Provenance and Injection Resistance]]
- [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_06_evaluate-exact-computation-schema-security-and-recovery|STEP-04-06 Evaluate Exact Computation Schema Security and Recovery]]
- `docs/product-brief.md` sections 13, 15, 18-24, 26-27, and 29-31.

## Concrete Deliverables

- Define branded/versioned schemas for question classification, `ResearchPlan`, plan nodes and dependencies, evidence requirements, allowed tool IDs/capabilities, and finite run budgets.
- Define serializable execution/checkpoint state and explicit `Schema.TaggedError` failures for malformed plans, unsupported capabilities, cycles/missing dependencies, fan-out, and budget violations.
- Export the contracts from `@struct/domain` and prove unknown-input decoding plus encoded round trips; preserve Phase 02 citation/source-version contracts and Phase 04 dataset-query evidence identities.

## Smallest Bounded Checklist

- Add the minimum domain modules and exports for the complete shared contract.
- Decode one valid mixed document/dataset plan and reject malformed identity, dependency, capability, and limit shapes with typed failures.
- Round-trip serializable plan/execution state without functions, provider clients, tool implementations, or large artifact bodies.
- Run the focused domain suite and the repository typecheck/lint/import-boundary gates.

## Constraints and Non-Goals

- Research plans, tools, and workflow state must all use typed schemas and typed failures.
- This step defines budget/cancellation/duplicate/no-progress state only; enforcement belongs to STEP-05-03 and durable transitions belong to STEP-05-04.
- Do not implement intent classification, a Fred agent/graph, repositories, API routes, worker jobs, or tool dispatch.
- Keep deterministic inspection, retrieval, and SQL execution in Effect services/tools; Fred should orchestrate judgment, not replace core services.

## Related Notes

- Step: [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Steps/Step_01_define-typed-research-plan-and-execution-schemas|STEP-05-01 Define Typed Research Plan and Execution Schemas]]
- Phase: [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Phase|Phase 05 typed research planning and bounded execution]]
