# Execution Brief

## Exact Outcome

- Produce the concrete contracts, artifacts, and bounded implementation/design surfaces for Tool Registry Typed Failures Retries and Recovery that this step is responsible for before any broader follow-on work begins.

## Prerequisites

- Re-read [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Phase|Phase 05 typed research planning and bounded execution]] and confirm the step still matches the current roadmap sequence.
- Confirm the handoff from [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Steps/Step_04_persist-checkpoints-events-budgets-and-cancellation|STEP-05-04 Persist Checkpoints Events Budgets and Cancellation]] before widening scope.
- Keep deterministic work in typed Effect services, repositories, and tools; reserve Fred for agentic orchestration only.
- Treat the listed files as planned starting points; create only the smallest set needed to land the slice.

## Planned Starting Files

- These paths may not exist yet; use them as the first bounded implementation or design surface.
- `packages/fred-workflows/src/tools/index.ts`
- `packages/domain/src/tool-failures.ts`
- `packages/research-engine/src/retry-policy.ts`
- `apps/worker/src/jobs/tool-dispatch.ts`
- `packages/research-engine/src/recovery-policy.ts`

## Required Reading

- [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Phase|Phase 05 typed research planning and bounded execution]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[01_Architecture/System_Overview|System Overview]]
- [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Steps/Step_04_persist-checkpoints-events-budgets-and-cancellation|STEP-05-04 Persist Checkpoints Events Budgets and Cancellation]]
- `docs/product-brief.md` sections 13, 15, 18-24, 26-27, and 29-31.

## Concrete Deliverables

- Create a typed tool registry that binds tool IDs to Effect Schema inputs/outputs, authorization checks, timeouts, and structured tracing.
- Define typed failure families plus retry and recovery policies that distinguish permanent validation errors from transient infrastructure faults.
- Keep worker dispatch logic explicit about which tools are deterministic services versus Fred-mediated agent steps.

## Smallest Bounded Checklist

- First, create a typed tool registry that binds tool IDs to Effect Schema inputs/outputs, authorization checks, timeouts, and structured tracing.
- Then, define typed failure families plus retry and recovery policies that distinguish permanent validation errors from transient infrastructure faults.
- Next, keep worker dispatch logic explicit about which tools are deterministic services versus Fred-mediated agent steps.
- Finish by leaving one observable typed path—test, route, worker flow, or UI state—that proves the slice is ready for the next dependent step.

## Constraints and Non-Goals

- Research plans, tools, and workflow state must all use typed schemas and typed failures.
- Budgets, cancellation, duplicate-action detection, and no-progress detection are product requirements, not optional polish.
- Keep deterministic inspection, retrieval, and SQL execution in Effect services/tools; Fred should orchestrate judgment, not replace core services.

## Related Notes

- Step: [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Steps/Step_05_implement-tool-registry-typed-failures-retries-and-recovery|STEP-05-05 Implement Tool Registry Typed Failures Retries and Recovery]]
- Phase: [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Phase|Phase 05 typed research planning and bounded execution]]
