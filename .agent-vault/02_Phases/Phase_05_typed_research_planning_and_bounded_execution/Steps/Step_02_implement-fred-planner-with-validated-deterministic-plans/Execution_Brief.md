# Execution Brief

## Exact Outcome

- Implement focused Fred classification/planning agents whose schema-decoded proposals are deterministically normalized and either accepted as executable plans or rejected with the STEP-05-01 typed planning failures before any tool runs.

## Prerequisites

- Re-read [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Phase|Phase 05 typed research planning and bounded execution]] and confirm the step still matches the current roadmap sequence.
- Confirm the handoff from [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Steps/Step_01_define-typed-research-plan-and-execution-schemas|STEP-05-01 Define Typed Research Plan and Execution Schemas]] before widening scope.
- Keep deterministic work in typed Effect services, repositories, and tools; reserve Fred for agentic orchestration only.
- Extend the established `@struct/workflows` Fred adapter patterns and `@struct/research-engine`; do not add a second orchestration package or bypass Fred core execution.

## Planned Starting Files

- `packages/workflows/src/agents/question-classifier.ts`
- `packages/workflows/src/agents/research-planner.ts`
- `packages/research-engine/src/validate-plan.ts`
- `packages/research-engine/src/normalize-plan.ts`
- Focused tests in `packages/workflows/test/` and `packages/research-engine/test/`.

## Required Reading

- [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Phase|Phase 05 typed research planning and bounded execution]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[01_Architecture/System_Overview|System Overview]]
- [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Steps/Step_01_define-typed-research-plan-and-execution-schemas|STEP-05-01 Define Typed Research Plan and Execution Schemas]]
- `docs/product-brief.md` sections 13, 15, 18-24, 26-27, and 29-31.

## Concrete Deliverables

- Add purpose-specific classifier and planner agents in `@struct/workflows` with schema inputs/outputs, `maxSteps: 1`, no tool authority, and prompts that preserve immutable workspace/project/source-version scope.
- Add deterministic `Effect.fn` validation/normalization in `@struct/research-engine` for tool IDs, dependencies/cycles, fan-out, capabilities, evidence requirements, and all finite budgets.
- Return a normalized schema-valid plan or a specific typed planning failure; preserve the raw proposal only as bounded diagnostic data, not executable state.

## Smallest Bounded Checklist

- Implement and export the two focused Fred agent configurations through `@struct/workflows`.
- Validate and normalize decoded proposals entirely in deterministic Effect code before returning an executable plan.
- Test valid document-only, dataset-only, and mixed proposals plus unknown tool, cycle, missing dependency, fan-out, unsupported capability, and budget-overflow rejection.
- Prove the Fred agent boundary uses the typed schema and does not execute tools; run focused suites and repository static gates.

## Constraints and Non-Goals

- Research plans, tools, and workflow state must all use typed schemas and typed failures.
- Do not add worker jobs, persistence, checkpoints, event streaming, production tool registration, execution retries, or graph execution.
- Do not repair invalid plans by silently broadening scope or budgets; a bounded explicit replan may be proposed only through the same validation path.
- Keep deterministic inspection, retrieval, and SQL execution in Effect services/tools; Fred should orchestrate judgment, not replace core services.

## Related Notes

- Step: [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Steps/Step_02_implement-fred-planner-with-validated-deterministic-plans|STEP-05-02 Implement Fred Planner with Validated Deterministic Plans]]
- Phase: [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Phase|Phase 05 typed research planning and bounded execution]]
