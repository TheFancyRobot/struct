# Validation Plan

## Acceptance Checks

- Confirm this deliverable is present, testable where applicable, and bounded to the step: Replay/recovery evaluations that prove planning and execution can resume from persisted checkpoints without duplicating side effects.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: Document the exact restart, replan, and failure classes the system can recover from versus the ones that still require operator action.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: Tie benchmark/report artifacts back to the planner, graph, and tool-registry contracts created earlier in Phase 05.
- The output includes a clear pass/fail signal, recorded defects or blockers, and the next action for anything intentionally left unresolved.

## Planned Verification

- Plan replay tests that cover restart after planning, restart mid-tool call, restart after partial event flush, and explicit cancellation.
- Plan benchmark/report review steps that show checkpoint size, replay latency, and failure categorization are acceptable for v1.
- Planned command once these packages exist: `bun test packages/evaluation` plus the nearest package-level `bun run typecheck`.
- Planned app/integration coverage once the app surfaces exist: `bun test apps/worker` for the API/worker/web path touched here.

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
