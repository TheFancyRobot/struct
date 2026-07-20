# Execution Brief

## Exact Outcome

- Produce the concrete contracts, artifacts, and bounded implementation/design surfaces for Fred Planner with Validated Deterministic Plans that this step is responsible for before any broader follow-on work begins.

## Prerequisites

- Re-read [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Phase|Phase 05 typed research planning and bounded execution]] and confirm the step still matches the current roadmap sequence.
- Confirm the handoff from [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Steps/Step_01_define-typed-research-plan-and-execution-schemas|STEP-05-01 Define Typed Research Plan and Execution Schemas]] before widening scope.
- Keep deterministic work in typed Effect services, repositories, and tools; reserve Fred for agentic orchestration only.
- Treat the listed files as planned starting points; create only the smallest set needed to land the slice.

## Planned Starting Files

- These paths may not exist yet; use them as the first bounded implementation or design surface.
- `packages/workflows/src/agents/research-planner.ts`
- `packages/research-engine/src/validate-plan.ts`
- `packages/research-engine/src/plan-revision.ts`
- `apps/worker/src/jobs/plan-research.ts`

## Required Reading

- [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Phase|Phase 05 typed research planning and bounded execution]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[01_Architecture/System_Overview|System Overview]]
- [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Steps/Step_01_define-typed-research-plan-and-execution-schemas|STEP-05-01 Define Typed Research Plan and Execution Schemas]]
- `docs/product-brief.md` sections 13, 15, 18-24, 26-27, and 29-31.

## Concrete Deliverables

- Produce an evidence-backed validation pass for Fred Planner with Validated Deterministic Plans, with explicit pass/fail criteria and durable output artifacts.
- Capture the orchestration or synthesis rules in `packages/research-engine/src/validate-plan.ts`, `packages/research-engine/src/plan-revision.ts` without moving deterministic work out of services/tools.
- Keep Fred-specific graph/agent wiring isolated to `packages/workflows/src/agents/research-planner.ts` and typed at every boundary.
- Constrain worker-side execution in `apps/worker/src/jobs/plan-research.ts` to one resumable, observable path for this slice.

## Smallest Bounded Checklist

- First, produce an evidence-backed validation pass for Fred Planner with Validated Deterministic Plans, with explicit pass/fail criteria and durable output artifacts.
- Then, capture the orchestration or synthesis rules in `packages/research-engine/src/validate-plan.ts`, `packages/research-engine/src/plan-revision.ts` without moving deterministic work out of services/tools.
- Next, keep Fred-specific graph/agent wiring isolated to `packages/workflows/src/agents/research-planner.ts` and typed at every boundary.
- Then, constrain worker-side execution in `apps/worker/src/jobs/plan-research.ts` to one resumable, observable path for this slice.
- Finish by proving that worker path with one observable typed test or event lifecycle that leaves the slice ready for the next dependent step.

## Constraints and Non-Goals

- Research plans, tools, and workflow state must all use typed schemas and typed failures.
- Budgets, cancellation, duplicate-action detection, and no-progress detection are product requirements, not optional polish.
- Keep deterministic inspection, retrieval, and SQL execution in Effect services/tools; Fred should orchestrate judgment, not replace core services.

## Related Notes

- Step: [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Steps/Step_02_implement-fred-planner-with-validated-deterministic-plans|STEP-05-02 Implement Fred Planner with Validated Deterministic Plans]]
- Phase: [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Phase|Phase 05 typed research planning and bounded execution]]
