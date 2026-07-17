# Execution Brief

## Exact Outcome

- Produce the concrete contracts, artifacts, and bounded implementation/design surfaces for Checkpoints Events Budgets and Cancellation that this step is responsible for before any broader follow-on work begins.

## Prerequisites

- Re-read [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Phase|Phase 05 typed research planning and bounded execution]] and confirm the step still matches the current roadmap sequence.
- Confirm the handoff from [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Steps/Step_03_implement-bounded-graph-orchestration-and-model-routing|STEP-05-03 Implement Bounded Graph Orchestration and Model Routing]] before widening scope.
- Keep deterministic work in typed Effect services, repositories, and tools; reserve Fred for agentic orchestration only.
- Treat the listed files as planned starting points; create only the smallest set needed to land the slice.

## Planned Starting Files

- These paths may not exist yet; use them as the first bounded implementation or design surface.
- `packages/persistence/src/repositories/research-runs.ts`
- `packages/persistence/src/repositories/checkpoints.ts`
- `packages/domain/src/research-events.ts`
- `apps/api/src/routes/research-events.ts`
- `apps/api/src/routes/research-cancel.ts`

## Required Reading

- [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Phase|Phase 05 typed research planning and bounded execution]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[01_Architecture/System_Overview|System Overview]]
- [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Steps/Step_03_implement-bounded-graph-orchestration-and-model-routing|STEP-05-03 Implement Bounded Graph Orchestration and Model Routing]]
- `docs/product-brief.md` sections 13, 15, 18-24, 26-27, and 29-31.

## Concrete Deliverables

- Persist `ResearchRun` state, checkpoint references, and consumed budgets in repository modules that can survive process restart.
- Define the append-only `ResearchEvent` stream and cancel endpoint semantics needed for replayable progress and user-driven cancellation.
- Ensure checkpoint writes, event writes, and cancellation signals have a documented ordering rule that future recovery logic can trust.

## Smallest Bounded Checklist

- First, persist `ResearchRun` state, checkpoint references, and consumed budgets in repository modules that can survive process restart.
- Then, define the append-only `ResearchEvent` stream and cancel endpoint semantics needed for replayable progress and user-driven cancellation.
- Next, ensure checkpoint writes, event writes, and cancellation signals have a documented ordering rule that future recovery logic can trust.
- Finish by leaving one observable typed path—test, route, worker flow, or UI state—that proves the slice is ready for the next dependent step.

## Constraints and Non-Goals

- Research plans, tools, and workflow state must all use typed schemas and typed failures.
- Budgets, cancellation, duplicate-action detection, and no-progress detection are product requirements, not optional polish.
- Keep deterministic inspection, retrieval, and SQL execution in Effect services/tools; Fred should orchestrate judgment, not replace core services.

## Related Notes

- Step: [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Steps/Step_04_persist-checkpoints-events-budgets-and-cancellation|STEP-05-04 Persist Checkpoints Events Budgets and Cancellation]]
- Phase: [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Phase|Phase 05 typed research planning and bounded execution]]
