# Validation Plan

## Acceptance Checks

- A validated plan compiles to a Fred graph that resolves only declared tool/capability IDs and focused agent nodes.
- Step/tool/model/cost/time/concurrency, duplicate-action, and no-progress limits stop deterministically with typed reasons before the next action.
- Classification, planning, critique, and synthesis model routing changes through policy/configuration without changing graph business contracts.
- Graph state is schema-serializable; tests use typed fake resolvers and this step adds no persistence or production worker dispatch.

## Planned Verification

- Run focused graph tests for each independent limit, duplicate/no-progress termination, undeclared capability/tool resolution, interruption, and provider failure.
- Run routing tests proving role-specific model/provider selection without graph-contract changes.
- Run `bun test packages/domain packages/workflows packages/research-engine`.
- Run `bun run typecheck`, `bun run lint`, and `bun run lint:imports`.

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
