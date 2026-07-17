# Implementation Notes

- Published package evidence recorded from `spikes/fred-runtime/`: `@fancyrobot/fred@2.0.0`, `@fancyrobot/fred-http@1.0.0`, Bun `1.3.13`, Node `v24.15.0`, and local Fred example commit `b964f3480c177ba3e3805cb66356c1e0f3f30cce`.
- Built a disposable proving harness in `spikes/fred-runtime/` with:
  - typed contracts in `src/contracts.ts`;
  - a deterministic Effect-backed Fred workflow boundary in `src/runtime-harness.ts`;
  - runtime, HTTP, and eval proofs under `test/`.
- The runtime proof confirms:
  - `createFred()` boots without live-provider config for deterministic function workflows;
  - `defineWorkflow()` validates typed input and final output through public APIs;
  - workflow hooks (`beforePipeline`, `beforeStep`, `afterStep`, `afterPipeline`, `onStepError`) are stable integration tap points;
  - `fred-http` can expose typed JSON and coarse SSE envelopes with scoped keys; and
  - `@fancyrobot/fred/eval` can run offline golden-trace assertions against the same Effect schemas used by the harness.
- Durable product conclusions:
  - product `runId` remains the public identity;
  - product checkpoints and event journals remain authoritative;
  - large tool payloads must stay artifact-referenced rather than checkpoint-inline; and
  - `fred-http` SSE is useful for smoke tests but insufficient as the product progress contract.
- Review follow-up tightened the harness with two negative-path regressions:
  - malformed deterministic tool output now fails closed with `DeterministicToolValidationFailure`;
  - malformed terminal workflow output now fails at Fred's output schema boundary with `WorkflowOutputValidationError`.
- `makeCheckpoint()` now computes `inlineBytes` with an explicit fixed-point helper so the serialized byte count remains accurate without unexplained duplicate assignments.
- Recorded the durable boundary as [[04_Decisions/DEC-0012_keep-fred-at-the-orchestration-boundary-for-typed-research-runs|DEC-0012 Keep Fred at the Orchestration Boundary for Typed Research Runs]].

## Related Notes

- Step: [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Steps/Step_01_spike-fred-runtime-and-workflow-integration|STEP-00-01 Spike Fred Runtime and Workflow Integration]]
- Phase: [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Phase|Phase 00 architecture spikes and delivery foundations]]
