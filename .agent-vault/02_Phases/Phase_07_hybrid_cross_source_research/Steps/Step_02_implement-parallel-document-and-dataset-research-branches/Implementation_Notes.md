# Implementation Notes

- Capture durable findings learned during execution. Prefer short bullets with file paths, commands, and observed behavior.
- Implemented `runHybridBranches` as a typed Effect scheduler that selects dependency-ready nodes, skips checkpointed completions, and bounds ready work by `budget.maximumFanOut`.
- Added a Fred-backed hybrid coordinator without a second execution-state family. It reuses the existing action/provider, budget, registry, routing, checkpoint, artifact, cancellation, and replay contracts.
- Shared execution state is guarded by one semaphore. In-flight actions reserve global and tool-grant budgets before provider execution; completions canonicalize identities and artifacts so completion order does not change final state.
- Mixed document/dataset/recursive plans use the hybrid Fred workflow; single-source plans retain the existing per-node Fred workflow.
- Document evidence and dataset result/citation artifacts remain separate through their existing provenance paths.

## Related Notes

- Step: [[02_Phases/Phase_07_hybrid_cross_source_research/Steps/Step_02_implement-parallel-document-and-dataset-research-branches|STEP-07-02 Implement Parallel Document and Dataset Research Branches]]
- Phase: [[02_Phases/Phase_07_hybrid_cross_source_research/Phase|Phase 07 hybrid cross source research]]
