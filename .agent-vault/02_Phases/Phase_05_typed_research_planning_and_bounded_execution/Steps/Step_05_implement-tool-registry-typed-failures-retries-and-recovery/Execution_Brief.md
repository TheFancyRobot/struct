# Execution Brief

## Exact Outcome

- Bind the merged bounded graph and durable run state to one production Bun worker path through a typed Effect tool registry, explicit failure/retry policy, and idempotent checkpoint-based recovery.

## Prerequisites

- Re-read [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Phase|Phase 05 typed research planning and bounded execution]] and confirm the step still matches the current roadmap sequence.
- Confirm the handoff from [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Steps/Step_04_persist-checkpoints-events-budgets-and-cancellation|STEP-05-04 Persist Checkpoints Events Budgets and Cancellation]] before widening scope.
- Keep deterministic work in typed Effect services, repositories, and tools; reserve Fred for agentic orchestration only.
- Reuse the existing Phase 02 document retrieval, Phase 03 directory, and Phase 04 exact-query adapters; do not reimplement their deterministic behavior.

## Planned Starting Files

- `packages/workflows/src/tools/registry.ts`
- `packages/domain/src/tool-failures.ts`
- `packages/research-engine/src/retry-policy.ts`
- `packages/research-engine/src/recovery-policy.ts`
- `apps/worker/src/jobs/run-research.ts`
- Focused registry/policy/worker tests.

## Required Reading

- [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Phase|Phase 05 typed research planning and bounded execution]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[01_Architecture/System_Overview|System Overview]]
- [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Steps/Step_04_persist-checkpoints-events-budgets-and-cancellation|STEP-05-04 Persist Checkpoints Events Budgets and Cancellation]]
- `docs/product-brief.md` sections 13, 15, 18-24, 26-27, and 29-31.

## Concrete Deliverables

- Create a typed registry that binds plan-visible tool IDs to Effect Schema inputs/outputs, required capabilities, workspace/project authorization, timeout/idempotency policy, and structured tracing.
- Define specific `Schema.TaggedError` families plus finite retry/recovery policy that distinguishes non-retryable validation/auth/cancellation failures from transient provider, transport, lease, and sidecar faults.
- Integrate one existing `apps/worker` research-job path with planning, graph execution, checkpoints/events/budgets, cancellation, retries, and process-replacement resume without duplicate side effects.

## Smallest Bounded Checklist

- Register the existing deterministic document/directory/dataset capabilities and reject unknown or unauthorized tool IDs before dispatch.
- Implement finite retry classification with attempt history, idempotency requirements, backoff/stop reasons, and cancellation checks.
- Integrate the bounded graph into the existing worker job lifecycle and resume only from committed checkpoint/event state.
- Test one successful mixed-source run, permanent failure, transient retry, provider failure, cancellation, lease loss, and worker replacement; run focused and full repository gates.

## Constraints and Non-Goals

- Research plans, tools, and workflow state must all use typed schemas and typed failures.
- Keep agent nodes separate from deterministic tools; only registered deterministic tools are callable through the registry.
- Do not introduce a second worker path, execute raw model-authored SQL/code, expand source scope, or duplicate Phase 02-04 services.
- Maintained code runs on Bun. Dataset queries use `@struct/data-engine` and its existing authenticated protocol to the isolated Node 24 LTS DuckDB Compose sidecar; no host Node/DuckDB dependency is allowed.
- Keep deterministic inspection, retrieval, and SQL execution in Effect services/tools; Fred should orchestrate judgment, not replace core services.

## Related Notes

- Step: [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Steps/Step_05_implement-tool-registry-typed-failures-retries-and-recovery|STEP-05-05 Implement Tool Registry Typed Failures Retries and Recovery]]
- Phase: [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Phase|Phase 05 typed research planning and bounded execution]]
