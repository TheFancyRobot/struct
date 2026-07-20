# Implementation Notes

- Extended `@struct/domain` with branded plan, node, evidence-requirement, and checkpoint identities.
- Added versioned classification, document/dataset scopes, evidence requirements, dependency/input/evidence references, a closed tool-policy vocabulary, and explicitly capped finite budgets.
- Added compact JSON-safe execution/checkpoint state with bounded artifact references, budget usage, cancellation, duplicate/no-progress counters, and Fred correlation metadata.
- Kept validation deliberately small: one serializable tagged error discriminates malformed identities, unsupported tools/capabilities, missing/cyclic dependencies, excess fan-out, and invalid budgets.
- Root publication review added encoded checkpoint-size enforcement and rejected duplicate identities, missing input/evidence references, and node-output inputs without declared dependencies.
- Added no model, Fred graph, registry/dispatch, persistence, API, or worker behavior.

## Related Notes

- Step: [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Steps/Step_01_define-typed-research-plan-and-execution-schemas|STEP-05-01 Define Typed Research Plan and Execution Schemas]]
- Phase: [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Phase|Phase 05 typed research planning and bounded execution]]
