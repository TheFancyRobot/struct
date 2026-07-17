# Outcome

- Result: completed.
- Deliverables landed:
  - `docs/spikes/fred-compatibility-matrix.md`
  - `docs/spikes/fred-runtime-and-workflow-integration.md`
  - `docs/adr/DEC-0012-keep-fred-at-the-orchestration-boundary-for-typed-research-runs.md`
  - `spikes/fred-runtime/` proving harness
  - [[04_Decisions/DEC-0012_keep-fred-at-the-orchestration-boundary-for-typed-research-runs|DEC-0012 Keep Fred at the Orchestration Boundary for Typed Research Runs]]
- Proven boundary:
  - Fred owns workflow execution, hooks, and optional transport helpers.
  - Product code owns public run identity, journals, checkpoint records, artifact references, auth, and replay semantics.
- Review follow-up completed:
  - `.gitignore` no longer hides `docs/**`, and `node_modules/` is now ignored.
  - runtime regressions now prove malformed tool output fails with `DeterministicToolValidationFailure` and malformed terminal workflow output fails with `WorkflowOutputValidationError`.
  - the gap register now explicitly covers typed tool-failure propagation and bounded parallel decomposition.
  - checkpoint byte computation now uses a documented fixed-point helper.
- STEP-00-02 handoff:
  - use product `runId` as the public identity;
  - keep product checkpoints authoritative;
  - capture lifecycle transitions from `beforePipeline`, `beforeStep`, `afterStep`, `afterPipeline`, and `onStepError`; and
  - treat `fred-http` SSE as coarse transport evidence, not the product event contract.

## Validation Evidence

- Command set run from `spikes/fred-runtime/`:
  - `bun --version`
  - `node --version`
  - `npm view @fancyrobot/fred version`
  - `npm view @fancyrobot/fred-http version`
  - `git -C ../../../fred rev-parse HEAD`
  - `bun install --frozen-lockfile`
  - `bun test`
  - `bunx tsc -p tsconfig.json --noEmit`
- Observed results:
  - Bun `1.3.13`
  - Node `v24.15.0`
  - `@fancyrobot/fred` `2.0.0`
  - `@fancyrobot/fred-http` `1.0.0`
  - local Fred example commit `b964f3480c177ba3e3805cb66356c1e0f3f30cce`
  - targeted runtime regressions: `5 pass / 0 fail`
  - frozen install unchanged
  - full suite: `8 pass / 0 fail`
  - typecheck: pass

## Follow-Up

- STEP-00-02 should now prove durable event, cancellation, replay, and checkpoint semantics against the product-first boundary established here.

## Related Notes

- Step: [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Steps/Step_01_spike-fred-runtime-and-workflow-integration|STEP-00-01 Spike Fred Runtime and Workflow Integration]]
- Phase: [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Phase|Phase 00 architecture spikes and delivery foundations]]
