# Validation Plan

## Acceptance Checks

- Confirm this deliverable is present, testable where applicable, and bounded to the step: The research-run graph that enforces max steps, model/tool budgets, duplicate-action detection, and no-progress termination.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: Explicit model-routing policy so classification, planning, and synthesis can choose different providers/models without changing business logic.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: Orchestration state typed and serializable so later checkpoint/replay work does not depend on hidden in-memory closures.
- The step leaves the next dependent step with a stable typed boundary, not a placeholder or undocumented assumption.

## Planned Verification

- Plan orchestration tests that show a run stops at budget limits, rejects duplicate actions, and records the stop reason.
- Plan a routing test that proves planner/synthesizer/model selection is configurable without changing workflow contracts.
- Planned command once these packages exist: `bun test packages/domain packages/workflows packages/research-engine` plus the nearest package-level `bun run typecheck`.
- Planned app/integration coverage once the app surfaces exist: `bun test apps/worker` for the API/worker/web path touched here.

## Edge Cases

- A run that hits the budget mid-step needs a deterministic terminal state and a resume story, not a silent partial answer.
- Model-routing fallback must not switch to an incompatible output schema or unbounded provider behavior.
- Graph state should remain small enough to checkpoint even when a step touches large tool outputs.

## Regression Expectations

- This step should remain a clean successor to [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Steps/Step_02_implement-fred-planner-with-validated-deterministic-plans|STEP-05-02 Implement Fred Planner with Validated Deterministic Plans]] rather than reworking already-planned scope upstream.
- Do not let planner or workflow convenience erase source-version provenance, citation validation, or exact-computation routing.
- Keep checkpoints lightweight by storing large outputs by reference rather than embedding them wholesale.
- Preserve restart safety and explicit event lifecycles as the graph grows more capable.

## Security / Observability / Evaluation Focus

- Prevent unbounded loops, unconstrained tool calls, and hidden model state from leaking into persisted workflow state.
- Keep authorization and workspace checks at every tool boundary.
- Add validation around retries, cancellation, and replay before trusting orchestration in later phases.

## Related Notes

- Step: [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Steps/Step_03_implement-bounded-graph-orchestration-and-model-routing|STEP-05-03 Implement Bounded Graph Orchestration and Model Routing]]
- Phase: [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Phase|Phase 05 typed research planning and bounded execution]]
