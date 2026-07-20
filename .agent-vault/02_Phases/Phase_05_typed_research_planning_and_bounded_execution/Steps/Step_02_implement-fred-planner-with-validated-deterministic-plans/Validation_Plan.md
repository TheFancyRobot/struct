# Validation Plan

## Acceptance Checks

- Focused Fred classifier/planner agents use STEP-05-01 schemas, one model step, no tools, and preserve immutable workspace/project/source-version scope.
- Deterministic `@struct/research-engine` validation accepts and normalizes valid document, dataset, and mixed plans before execution.
- Unknown tools, cycles, missing dependencies, fan-out, unsupported capabilities, and budget overflow return their specific typed planning failures; none are silently repaired or executed.
- No worker, persistence, checkpoint, event, registry, or graph-execution surface is added in this step.

## Planned Verification

- Run `bun test packages/workflows packages/research-engine`.
- Run `bun run typecheck`, `bun run lint`, and `bun run lint:imports`.

## Edge Cases

- Malformed model envelopes and schema-invalid output fail before policy validation.
- A replan may narrow a plan but must not expand source scope, capabilities, or budgets.
- Model/provider failure remains typed and does not fall through to tool execution.

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
