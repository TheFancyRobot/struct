# Validation Plan

## Acceptance Checks

- Valid mixed document/dataset plans decode with branded scope/source identities, explicit dependencies, evidence requirements, tool capabilities, and finite budgets.
- Invalid identity, missing dependency, cycle, unknown capability/tool ID, excess fan-out, and invalid limit shapes fail with specific serializable tagged errors.
- Plan and execution/checkpoint state encode/decode without functions, provider/tool instances, hidden model state, or large artifact bodies.
- `@struct/domain` exports preserve existing citation, provenance, and dataset-query evidence contracts; this step adds no runtime orchestration or persistence.

## Planned Verification

- Run `bun test packages/domain`.
- Run `bun run typecheck`, `bun run lint`, and `bun run lint:imports`.

## Edge Cases

- Partial progress, retries, or restarts should leave this step in a typed, inspectable state rather than a silent half-success.
- Version drift, missing required fields, or ambiguous identity rules should be called out in the contract instead of deferred to implementation guesswork.

## Regression Expectations

- This step must preserve both the document evidence contracts from [[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Steps/Step_06_evaluate-retrieval-provenance-and-injection-resistance|STEP-02-06 Evaluate Retrieval Provenance and Injection Resistance]] and deterministic dataset contracts from [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_06_evaluate-exact-computation-schema-security-and-recovery|STEP-04-06 Evaluate Exact Computation Schema Security and Recovery]].
- Do not let planner or workflow convenience erase source-version provenance, citation validation, or exact-computation routing.
- Keep checkpoints lightweight by storing large outputs by reference rather than embedding them wholesale.
- Preserve restart safety and explicit event lifecycles as the graph grows more capable.

## Security / Observability / Evaluation Focus

- Prevent unbounded loops, unconstrained tool calls, and hidden model state from leaking into persisted workflow state.
- Keep authorization and workspace checks at every tool boundary.
- Add validation around retries, cancellation, and replay before trusting orchestration in later phases.

## Related Notes

- Step: [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Steps/Step_01_define-typed-research-plan-and-execution-schemas|STEP-05-01 Define Typed Research Plan and Execution Schemas]]
- Phase: [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Phase|Phase 05 typed research planning and bounded execution]]
