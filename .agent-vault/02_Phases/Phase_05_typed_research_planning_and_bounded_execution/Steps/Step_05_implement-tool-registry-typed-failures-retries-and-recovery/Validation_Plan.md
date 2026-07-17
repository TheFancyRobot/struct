# Validation Plan

## Acceptance Checks

- Confirm this deliverable is present, testable where applicable, and bounded to the step: A typed tool registry that binds tool IDs to Effect Schema inputs/outputs, authorization checks, timeouts, and structured tracing.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: Typed failure families plus retry and recovery policies that distinguish permanent validation errors from transient infrastructure faults.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: Worker dispatch logic explicit about which tools are deterministic services versus Fred-mediated agent steps.
- The step leaves the next dependent step with a stable typed boundary, not a placeholder or undocumented assumption.

## Planned Verification

- Plan unit tests for tool registration, schema validation failure, retry eligibility, and bounded recovery escalation.
- Plan worker dispatch tests that prove one transient failure retries and one permanent failure stops immediately with the correct typed error.
- Planned command once these packages exist: `bun test packages/domain packages/fred-workflows packages/research-engine` plus the nearest package-level `bun run typecheck`.
- Planned app/integration coverage once the app surfaces exist: `bun test apps/worker` for the API/worker/web path touched here.

## Edge Cases

- A retryable tool must be idempotent or guarded by idempotency keys before automated retries are enabled.
- Schema validation failure should never be retried as if it were a flaky provider/network issue.
- Tracing must preserve tool identity, attempt count, and stop reason without logging secrets or oversized payloads.

## Regression Expectations

- This step should remain a clean successor to [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Steps/Step_04_persist-checkpoints-events-budgets-and-cancellation|STEP-05-04 Persist Checkpoints Events Budgets and Cancellation]] rather than reworking already-planned scope upstream.
- Do not let planner or workflow convenience erase source-version provenance, citation validation, or exact-computation routing.
- Keep checkpoints lightweight by storing large outputs by reference rather than embedding them wholesale.
- Preserve restart safety and explicit event lifecycles as the graph grows more capable.

## Security / Observability / Evaluation Focus

- Prevent unbounded loops, unconstrained tool calls, and hidden model state from leaking into persisted workflow state.
- Keep authorization and workspace checks at every tool boundary.
- Add validation around retries, cancellation, and replay before trusting orchestration in later phases.
- Trace every restart, cancel, and replay decision with run/step identifiers so operators can reconstruct the timeline after failure.

## Related Notes

- Step: [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Steps/Step_05_implement-tool-registry-typed-failures-retries-and-recovery|STEP-05-05 Implement Tool Registry Typed Failures Retries and Recovery]]
- Phase: [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Phase|Phase 05 typed research planning and bounded execution]]
