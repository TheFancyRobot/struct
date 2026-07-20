# Execution Brief

## Exact Outcome

- Produce the concrete contracts, artifacts, and bounded implementation/design surfaces for Bounded Graph Orchestration and Model Routing that this step is responsible for before any broader follow-on work begins.

## Prerequisites

- Re-read [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Phase|Phase 05 typed research planning and bounded execution]] and confirm the step still matches the current roadmap sequence.
- Confirm the handoff from [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Steps/Step_02_implement-fred-planner-with-validated-deterministic-plans|STEP-05-02 Implement Fred Planner with Validated Deterministic Plans]] before widening scope.
- Keep deterministic work in typed Effect services, repositories, and tools; reserve Fred for agentic orchestration only.
- Treat the listed files as planned starting points; create only the smallest set needed to land the slice.

## Planned Starting Files

- These paths may not exist yet; use them as the first bounded implementation or design surface.
- `packages/workflows/src/graphs/research-run.ts`
- `packages/workflows/src/model-routing.ts`
- `packages/research-engine/src/budget-enforcer.ts`
- `apps/worker/src/jobs/execute-plan.ts`
- `packages/domain/src/research-budget.ts`

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
- Keep orchestration state typed and serializable so later checkpoint/replay work does not depend on hidden in-memory closures.

## Smallest Bounded Checklist

- First, implement the research-run graph that enforces max steps, model/tool budgets, duplicate-action detection, and no-progress termination.
- Then, add explicit model-routing policy so classification, planning, and synthesis can choose different providers/models without changing business logic.
- Next, keep orchestration state typed and serializable so later checkpoint/replay work does not depend on hidden in-memory closures.
- Finish by leaving one observable typed path—test, route, worker flow, or UI state—that proves the slice is ready for the next dependent step.

## Constraints and Non-Goals

- Research plans, tools, and workflow state must all use typed schemas and typed failures.
- Budgets, cancellation, duplicate-action detection, and no-progress detection are product requirements, not optional polish.
- Keep deterministic inspection, retrieval, and SQL execution in Effect services/tools; Fred should orchestrate judgment, not replace core services.

## Related Notes

- Step: [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Steps/Step_03_implement-bounded-graph-orchestration-and-model-routing|STEP-05-03 Implement Bounded Graph Orchestration and Model Routing]]
- Phase: [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Phase|Phase 05 typed research planning and bounded execution]]
