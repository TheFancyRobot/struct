# Execution Brief

## Exact Outcome

- Persist accepted plans or typed planning failures, serializable graph checkpoints, consumed budgets, ordered product events, and cancellation intent so reconnect and process replacement can reconstruct one authoritative run state.

## Prerequisites

- Re-read [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Phase|Phase 05 typed research planning and bounded execution]] and confirm the step still matches the current roadmap sequence.
- Confirm the handoff from [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Steps/Step_03_implement-bounded-graph-orchestration-and-model-routing|STEP-05-03 Implement Bounded Graph Orchestration and Model Routing]] before widening scope.
- Keep deterministic work in typed Effect services, repositories, and tools; reserve Fred for agentic orchestration only.
- Extend the existing research execution/event journal and migration patterns rather than introducing a parallel run store.

## Planned Starting Files

- `packages/persistence/src/repositories/research-execution.ts`
- `packages/persistence/src/repositories/checkpoints.ts`
- `packages/domain/src/research-events.ts`
- `apps/api/src/routes/research-events.ts`
- `apps/api/src/routes/research-cancel.ts`
- One forward-only migration plus focused repository/API tests where the existing schema requires new columns/tables.

## Required Reading

- [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Phase|Phase 05 typed research planning and bounded execution]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[01_Architecture/System_Overview|System Overview]]
- [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Steps/Step_03_implement-bounded-graph-orchestration-and-model-routing|STEP-05-03 Implement Bounded Graph Orchestration and Model Routing]]
- `docs/product-brief.md` sections 13, 15, 18-24, 26-27, and 29-31.

## Concrete Deliverables

- Persist an accepted normalized plan or typed planning failure before executable state, then persist checkpoint references and monotonically consumed budgets without embedding large tool outputs.
- Extend the append-only `ResearchEvent` stream and authenticated cancel endpoint for cursor replay, idempotent cancellation, and one durable terminal winner.
- Enforce and test a transaction/ordering rule for checkpoint, budget, event, cancellation, and terminal writes that STEP-05-05 recovery dispatch can trust.

## Smallest Bounded Checklist

- Extend the existing durable schema/repositories with scoped plan/failure, checkpoint-reference, budget, and cancellation state.
- Append and replay committed events by cursor; make duplicate/late cancellation deterministic and authorization-scoped.
- Test restart readback, checkpoint-before-stream reconstruction, monotonic budget accounting, cancellation races, and one terminal event.
- Run focused PostgreSQL/API suites plus repository static/migration gates.

## Constraints and Non-Goals

- Research plans, tools, and workflow state must all use typed schemas and typed failures.
- Product events remain authoritative for UI progress; Fred checkpoints do not replace the product journal.
- Do not add production tool registry/dispatch, retry classification, worker recovery execution, frontend UX, or data-engine changes.
- Keep deterministic inspection, retrieval, and SQL execution in Effect services/tools; Fred should orchestrate judgment, not replace core services.

## Related Notes

- Step: [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Steps/Step_04_persist-checkpoints-events-budgets-and-cancellation|STEP-05-04 Persist Checkpoints Events Budgets and Cancellation]]
- Phase: [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Phase|Phase 05 typed research planning and bounded execution]]
