# Execution Brief

## Exact Outcome

- Compile an already validated plan into a bounded Fred research graph with explicit model routing and deterministic in-memory enforcement of step/tool/model/cost/time/concurrency, duplicate-action, and no-progress limits.

## Prerequisites

- Re-read [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Phase|Phase 05 typed research planning and bounded execution]] and confirm the step still matches the current roadmap sequence.
- Confirm the handoff from [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Steps/Step_02_implement-fred-planner-with-validated-deterministic-plans|STEP-05-02 Implement Fred Planner with Validated Deterministic Plans]] before widening scope.
- Keep deterministic work in typed Effect services, repositories, and tools; reserve Fred for agentic orchestration only.
- Build on the merged STEP-05-01/02 schemas and planner; use typed resolver interfaces and test doubles until production registry/worker binding in STEP-05-05.

## Planned Starting Files

- `packages/workflows/src/graphs/research-run.ts`
- `packages/workflows/src/model-routing.ts`
- `packages/research-engine/src/budget-enforcer.ts`
- `packages/research-engine/src/execution-policy.ts`
- Focused graph/policy tests in the same two packages.

## Required Reading

- [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Phase|Phase 05 typed research planning and bounded execution]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[01_Architecture/System_Overview|System Overview]]
- [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Steps/Step_02_implement-fred-planner-with-validated-deterministic-plans|STEP-05-02 Implement Fred Planner with Validated Deterministic Plans]]
- `docs/product-brief.md` sections 13, 15, 18-24, 26-27, and 29-31.

## Concrete Deliverables

- Implement the research-run graph that enforces max steps, model/tool budgets, duplicate-action detection, and no-progress termination.
- Add explicit model-routing policy so classification, planning, and synthesis can choose different providers/models without changing business logic.
- Resolve only plan-declared tool/capability IDs through a typed resolver interface, and keep orchestration state typed/serializable so later checkpoint/replay work does not depend on hidden closures.

## Smallest Bounded Checklist

- First, implement the research-run graph that enforces max steps, model/tool budgets, duplicate-action detection, and no-progress termination.
- Then, add explicit model-routing policy so classification, planning, and synthesis can choose different providers/models without changing business logic.
- Next, reject undeclared tool/capability resolution and emit a typed stop reason for every limit, duplicate, no-progress, provider, or interruption path.
- Finish with deterministic graph tests using fake models/tools; run focused suites and repository static gates.

## Constraints and Non-Goals

- Research plans, tools, and workflow state must all use typed schemas and typed failures.
- Do not add database migrations, checkpoints, API routes, production registry bindings, worker dispatch, retries, or restart recovery; STEP-05-04/05 own those integrations.
- Do not redefine STEP-05-01 schemas or STEP-05-02 plan validation.
- Keep deterministic inspection, retrieval, and SQL execution in Effect services/tools; Fred should orchestrate judgment, not replace core services.

## Related Notes

- Step: [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Steps/Step_03_implement-bounded-graph-orchestration-and-model-routing|STEP-05-03 Implement Bounded Graph Orchestration and Model Routing]]
- Phase: [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Phase|Phase 05 typed research planning and bounded execution]]
