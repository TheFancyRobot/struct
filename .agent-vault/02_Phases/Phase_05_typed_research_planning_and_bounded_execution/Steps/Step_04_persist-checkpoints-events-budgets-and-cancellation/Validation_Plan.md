# Validation Plan

## Acceptance Checks

- Confirm this deliverable is present, testable where applicable, and bounded to the step: Persist `ResearchRun` state, checkpoint references, and consumed budgets in repository modules that can survive process restart.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: The append-only `ResearchEvent` stream and cancel endpoint semantics needed for replayable progress and user-driven cancellation.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: Checkpoint writes, event writes, and cancellation signals have a documented ordering rule that future recovery logic can trust.
- The step leaves the next dependent step with a stable typed boundary, not a placeholder or undocumented assumption.

## Planned Verification

- Plan repository tests for checkpoint creation, update, and resume lookup plus event append/readback ordering.
- Plan an API/worker scenario where cancellation races with in-flight work and still produces one durable terminal state.
- Planned command once these packages exist: `bun test packages/domain packages/persistence` plus the nearest package-level `bun run typecheck`.
- Planned app/integration coverage once the app surfaces exist: `bun test apps/api` for the API/worker/web path touched here.

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
