# Execution Brief

## Exact Outcome

- Produce the concrete contracts, artifacts, and bounded implementation/design surfaces for Planning Execution Replay and Recovery that this step is responsible for before any broader follow-on work begins.

## Prerequisites

- Re-read [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Phase|Phase 05 typed research planning and bounded execution]] and confirm the step still matches the current roadmap sequence.
- Confirm the handoff from [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Steps/Step_05_implement-tool-registry-typed-failures-retries-and-recovery|STEP-05-05 Implement Tool Registry Typed Failures Retries and Recovery]] before widening scope.
- Keep deterministic work in typed Effect services, repositories, and tools; reserve Fred for agentic orchestration only.
- Treat the listed files as planned starting points; create only the smallest set needed to land the slice.

## Planned Starting Files

- These paths may not exist yet; use them as the first bounded implementation or design surface.
- `packages/evaluation/src/research-planner.ts`
- `apps/worker/test/research-replay.integration.test.ts`
- `docs/operations/research-recovery.md`
- `docs/benchmarks/research-planning.md`

## Required Reading

- [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Phase|Phase 05 typed research planning and bounded execution]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[01_Architecture/System_Overview|System Overview]]
- [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Steps/Step_05_implement-tool-registry-typed-failures-retries-and-recovery|STEP-05-05 Implement Tool Registry Typed Failures Retries and Recovery]]
- `docs/product-brief.md` sections 13, 15, 18-24, 26-27, and 29-31.

## Concrete Deliverables

- Run replay/recovery evaluations that prove planning and execution can resume from persisted checkpoints without duplicating side effects.
- Document the exact restart, replan, and failure classes the system can recover from versus the ones that still require operator action.
- Tie benchmark/report artifacts back to the planner, graph, and tool-registry contracts created earlier in Phase 05.

## Smallest Bounded Checklist

- First, run replay/recovery evaluations that prove planning and execution can resume from persisted checkpoints without duplicating side effects.
- Then, document the exact restart, replan, and failure classes the system can recover from versus the ones that still require operator action.
- Next, tie benchmark/report artifacts back to the planner, graph, and tool-registry contracts created earlier in Phase 05.
- Finish by capturing the deterministic fixture, benchmark, or gate evidence that will let the validation plan judge the slice without guesswork.

## Constraints and Non-Goals

- Research plans, tools, and workflow state must all use typed schemas and typed failures.
- Budgets, cancellation, duplicate-action detection, and no-progress detection are product requirements, not optional polish.
- Keep deterministic inspection, retrieval, and SQL execution in Effect services/tools; Fred should orchestrate judgment, not replace core services.

## Related Notes

- Step: [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Steps/Step_06_evaluate-planning-execution-replay-and-recovery|STEP-05-06 Evaluate Planning Execution Replay and Recovery]]
- Phase: [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Phase|Phase 05 typed research planning and bounded execution]]
