# Validation Plan

## Acceptance Checks

- Each run durably records either its accepted normalized plan or typed planning failure before executable state.
- Checkpoint references, monotonic consumed budgets, cancellation intent, and ordered product events survive process restart without embedding large outputs.
- Cursor replay reconstructs committed progress; duplicate or late cancellation is idempotent, authorization-scoped, and cannot create a second terminal outcome.
- The transaction/ordering rule for checkpoint, event, cancellation, and terminal commits is executable in repository/API tests and ready for STEP-05-05 recovery dispatch.

## Planned Verification

- Run focused PostgreSQL repository tests for plan/failure persistence, checkpoint create/resume, monotonic budgets, event ordering, and terminal fencing.
- Run API tests for authenticated cursor replay plus duplicate, racing, and late cancellation.
- Run `bun test packages/domain packages/persistence apps/api`.
- Run `bun run typecheck`, `bun run lint`, `bun run lint:imports`, and migration validation.

## Edge Cases

- Restarting after the checkpoint is written but before the event is streamed must still let the client reconstruct the run state.
- Repeated cancellation or replay requests must not duplicate events or roll back consumed budget counters.
- Checkpoint payloads should store references to tool outputs, not large blobs that make resume slow and brittle.

## Regression Expectations

- This step should remain a clean successor to [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Steps/Step_03_implement-bounded-graph-orchestration-and-model-routing|STEP-05-03 Implement Bounded Graph Orchestration and Model Routing]] rather than reworking already-planned scope upstream.
- Do not let planner or workflow convenience erase source-version provenance, citation validation, or exact-computation routing.
- Keep checkpoints lightweight by storing large outputs by reference rather than embedding them wholesale.
- Preserve restart safety and explicit event lifecycles as the graph grows more capable.

## Security / Observability / Evaluation Focus

- Prevent unbounded loops, unconstrained tool calls, and hidden model state from leaking into persisted workflow state.
- Keep authorization and workspace checks at every tool boundary.
- Add validation around retries, cancellation, and replay before trusting orchestration in later phases.
- Trace every restart, cancel, and replay decision with run/step identifiers so operators can reconstruct the timeline after failure.

## Related Notes

- Step: [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Steps/Step_04_persist-checkpoints-events-budgets-and-cancellation|STEP-05-04 Persist Checkpoints Events Budgets and Cancellation]]
- Phase: [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Phase|Phase 05 typed research planning and bounded execution]]
