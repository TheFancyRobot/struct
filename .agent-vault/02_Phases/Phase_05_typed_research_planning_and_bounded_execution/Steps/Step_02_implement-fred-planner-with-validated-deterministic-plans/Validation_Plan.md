# Validation Plan

## Acceptance Checks

- Confirm this deliverable is present, testable where applicable, and bounded to the step: An evidence-backed validation pass for Fred Planner with Validated Deterministic Plans, with explicit pass/fail criteria and durable output artifacts.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: The orchestration or synthesis rules in `packages/research-engine/src/validate-plan.ts`, `packages/research-engine/src/plan-revision.ts` without moving deterministic work out of services/tools.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: Fred-specific graph/agent wiring isolated to `packages/fred-workflows/src/agents/research-planner.ts` and typed at every boundary.
- The output includes a clear pass/fail signal, recorded defects or blockers, and the next action for anything intentionally left unresolved.

## Planned Verification

- Planned command once these packages exist: `bun test packages/fred-workflows packages/research-engine` plus the nearest package-level `bun run typecheck`.
- Planned app/integration coverage once the app surfaces exist: `bun test apps/worker` for the API/worker/web path touched here.

## Edge Cases

- Partial progress, retries, or restarts should leave this step in a typed, inspectable state rather than a silent half-success.
- Cancellation, duplicate actions, replay after restart, and stale source-version assumptions should produce deterministic terminal states.

## Regression Expectations

- This step should remain a clean successor to [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Steps/Step_01_define-typed-research-plan-and-execution-schemas|STEP-05-01 Define Typed Research Plan and Execution Schemas]] rather than reworking already-planned scope upstream.
- Do not let planner or workflow convenience erase source-version provenance, citation validation, or exact-computation routing.
- Keep checkpoints lightweight by storing large outputs by reference rather than embedding them wholesale.
- Preserve restart safety and explicit event lifecycles as the graph grows more capable.

## Security / Observability / Evaluation Focus

- Prevent unbounded loops, unconstrained tool calls, and hidden model state from leaking into persisted workflow state.
- Keep authorization and workspace checks at every tool boundary.
- Add validation around retries, cancellation, and replay before trusting orchestration in later phases.

## Related Notes

- Step: [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Steps/Step_02_implement-fred-planner-with-validated-deterministic-plans|STEP-05-02 Implement Fred Planner with Validated Deterministic Plans]]
- Phase: [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Phase|Phase 05 typed research planning and bounded execution]]
