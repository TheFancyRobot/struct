# Implementation Notes

- Capture durable findings learned during execution. Prefer short bullets with file paths, commands, and observed behavior.
- Added a schema-serializable, artifact-reference-only research graph state and typed stop reasons in `packages/research-engine/src/execution-policy.ts`.
- Budget enforcement checks declared tool/capability grants, per-grant/global calls, steps, model calls, estimated cost, elapsed time, concurrency, duplicates, and no-progress before resolver invocation. A second elapsed-time check prevents a late result from being committed.
- Model routing keeps classification, planning, critique, and synthesis provider/model choices behind explicit one-step output-contract-compatible routes.
- The Fred graph compiler consumes the already validated `ResearchPlan`, injects typed tool/model resolvers, and adds no persistence, production registry, API, worker-dispatch, retry, or recovery behavior.
- The compiler derives deterministic topological execution order from dependencies; canonical node-ID ordering is not assumed to be executable ordering.
- The compiled Fred IR intentionally serializes that dependency-respecting order. Core Fred fan-out runs branches concurrently with independent state and mapped branch outputs at joins; STEP-05-03 has no global budget-state merge protocol, so it does not claim parallel plan-topology preservation. Later persistence and dispatch work owns any such merge protocol.

## Related Notes

- Step: [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Steps/Step_03_implement-bounded-graph-orchestration-and-model-routing|STEP-05-03 Implement Bounded Graph Orchestration and Model Routing]]
- Phase: [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Phase|Phase 05 typed research planning and bounded execution]]
