# Validation Plan

## Acceptance Checks

- The registry binds existing document, directory, and dataset capabilities to schemas, authorization, timeout/idempotency policy, and tracing; unknown/unauthorized tools fail before dispatch.
- Specific tagged failures determine finite retry eligibility, attempt history, backoff, and terminal/recovery action without retrying validation, authorization, or cancellation failures.
- The existing research worker path alone integrates planning, graph execution, durable checkpoints/events/budgets, cancellation, lease ownership, and restart resume.
- Exact-query tools use `@struct/data-engine`; no host Node/DuckDB dependency or duplicate Phase 02-04 implementation is introduced.

## Planned Verification

- Run registry/policy tests for successful dispatch, schema/auth rejection, transient retry, permanent stop, cancellation, exhausted attempts, and secret-safe tracing.
- Run worker tests for successful mixed-source execution, provider/tool failure, lease loss, cancellation, checkpoint resume, worker replacement, and zero duplicate side effects.
- Run `bun test packages/domain packages/workflows packages/research-engine apps/worker`.
- Run live PostgreSQL and data-engine sidecar integration coverage, then `bun run typecheck`, `bun run lint`, and `bun run lint:imports`.

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
