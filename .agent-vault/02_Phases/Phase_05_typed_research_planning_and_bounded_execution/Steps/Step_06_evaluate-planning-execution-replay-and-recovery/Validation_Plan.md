# Validation Plan

## Acceptance Checks

- A machine-readable report maps every Phase 05 acceptance criterion to a deterministic fixture, observed result, and explicit pass/fail gate.
- Two runs have byte-identical deterministic report sections and zero duplicate side effects across restart after planning, mid-tool attempt, post-checkpoint/event commit, cancellation, provider failure, and sidecar failure/restart.
- Measured checkpoint size/replay latency and exact automated/operator recovery classes are documented and meet the v1 thresholds.
- Full repository, security, Compose/live-service, migration, and vault gates pass with no converted skips or weakened thresholds.

## Planned Verification

- Run the focused Phase 05 evaluator twice and compare deterministic report hashes.
- Run live PostgreSQL and Compose data-engine recovery scenarios, including sidecar failure/restart while the Bun worker remains healthy.
- Run `bun test packages/evaluation apps/worker` plus the repository's full unit/integration, typecheck, lint, import-boundary, build, security, migration, Compose, and vault gates.

## Edge Cases

- Replay must not re-run completed deterministic SQL or ingestion side effects unless the contract explicitly allows it.
- If a prompt/model version changes between pause and resume, the plan should say whether replay is blocked, migrated, or forked.
- The evaluation should surface operator-facing recovery instructions when automated replay is intentionally unsupported.

## Regression Expectations

- This step should remain a clean successor to [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Steps/Step_05_implement-tool-registry-typed-failures-retries-and-recovery|STEP-05-05 Implement Tool Registry Typed Failures Retries and Recovery]] rather than reworking already-planned scope upstream.
- Do not let planner or workflow convenience erase source-version provenance, citation validation, or exact-computation routing.
- Keep checkpoints lightweight by storing large outputs by reference rather than embedding them wholesale.
- Preserve restart safety and explicit event lifecycles as the graph grows more capable.

## Security / Observability / Evaluation Focus

- Prevent unbounded loops, unconstrained tool calls, and hidden model state from leaking into persisted workflow state.
- Keep authorization and workspace checks at every tool boundary.
- Add validation around retries, cancellation, and replay before trusting orchestration in later phases.
- Trace every restart, cancel, and replay decision with run/step identifiers so operators can reconstruct the timeline after failure.

## Related Notes

- Step: [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Steps/Step_06_evaluate-planning-execution-replay-and-recovery|STEP-05-06 Evaluate Planning Execution Replay and Recovery]]
- Phase: [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Phase|Phase 05 typed research planning and bounded execution]]
