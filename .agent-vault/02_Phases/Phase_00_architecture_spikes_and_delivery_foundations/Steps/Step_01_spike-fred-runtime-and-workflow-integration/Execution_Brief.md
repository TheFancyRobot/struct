# Execution Brief

## Exact Outcome

- Produce the concrete contracts, artifacts, and bounded implementation/design surfaces for Fred Runtime and Workflow Integration that this step is responsible for before any broader follow-on work begins.

## Prerequisites

- Re-read [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Phase|Phase 00 architecture spikes and delivery foundations]] and confirm the step still matches the current roadmap sequence.
- Keep deterministic work in typed Effect services, repositories, and tools; reserve Fred for agentic orchestration only.
- Treat the listed files as planned starting points; create only the smallest set needed to land the slice.

## Planned Starting Files

- These paths may not exist yet; use them as the first bounded implementation or design surface.
- `docs/spikes/fred-runtime-and-workflow-integration.md`
- `docs/adr/ADR-xxxx-fred-integration-boundary.md`
- `packages/workflows/src/runtime-harness.ts`
- `packages/research-engine/src/research-run.ts`
- `apps/worker/src/workflows/research-run.ts`

## Required Reading

- [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Phase|Phase 00 architecture spikes and delivery foundations]]
- [[01_Architecture/System_Overview|System Overview]]
- [[01_Architecture/Code_Map|Code Map]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
- `docs/product-brief.md` sections 5-7, 13, 18-19, 21, 24, 26, and 29-31.

## Concrete Deliverables

- Write a spike note and ADR that pin down where Fred stops and product-local Effect services, repositories, and HTTP/worker adapters begin.
- Sketch a narrow runtime harness that can execute one typed research graph without coupling business logic to Fred internals.
- Record the minimum typed inputs/outputs, lifecycle hooks, and persistence touchpoints later phases should reuse.

## Smallest Bounded Checklist

- First, write a spike note and ADR that pin down where Fred stops and product-local Effect services, repositories, and HTTP/worker adapters begin.
- Then, sketch a narrow runtime harness that can execute one typed research graph without coupling business logic to Fred internals.
- Next, record the minimum typed inputs/outputs, lifecycle hooks, and persistence touchpoints later phases should reuse.
- Finish by leaving one observable typed path—test, route, worker flow, or UI state—that proves the slice is ready for the next dependent step.

## Constraints and Non-Goals

- Keep Phase 0 work decision-oriented: prove boundaries, not broad production scaffolding.
- Keep deterministic work in typed Effect services and adapters; use Fred only where agentic judgment is actually required.
- Record tradeoffs and rejected options explicitly so later implementation steps do not need to rediscover them.

## Related Notes

- Step: [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Steps/Step_01_spike-fred-runtime-and-workflow-integration|STEP-00-01 Spike Fred Runtime and Workflow Integration]]
- Phase: [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Phase|Phase 00 architecture spikes and delivery foundations]]

## Refinement Addendum

### Verified Baseline and Starting Points

- The repository is documentation-only; the listed `apps/` and `packages/` paths do not exist and are future handoff targets, not Phase 0 starting files.
- Start with `docs/spikes/fred-compatibility-matrix.md`, `docs/spikes/fred-runtime-and-workflow-integration.md`, and a disposable `spikes/fred-runtime/` package containing its own `package.json`, `bun.lock`, `tsconfig.json`, `src/`, and `test/`.
- Verify published `@fancyrobot/fred@2.0.0` and `@fancyrobot/fred-http@1.0.0`. The local Fred checkout at commit `b964f3480c177ba3e3805cb66356c1e0f3f30cce` may add development evidence, but published public exports remain the release contract.

### Required Reading Completion

Before editing, read `docs/architecture.md` sections 2.1, 4, 5.3, 7, 9, 10, and 12-14; `docs/research-execution-model.md` sections 7-10, 17, and 21; `docs/product-brief.md` sections 13, 15, 26, and 29-31; DEC-0001, DEC-0002, DEC-0003, and DEC-0010; and the pinned Fred graph-workflow, typed-evaluation, and HTTP-workflow examples.

### Required Artifacts

1. Compatibility matrix: exact package version, public export/API, proving test, observed result, limitation, and product consumer.
2. Fred-versus-product boundary table: planning, deterministic tools, workflow composition, routing, persistence, checkpoints, events, cancellation hooks, authorization, observability, and evaluation.
3. Typed harness: `Schema`-validated input -> one deterministic Effect-backed tool -> typed output -> compact checkpoint metadata/artifact reference -> terminal result.
4. Gap register covering granular events, durable cancellation, cross-process recovery, large outputs by reference, typed tool failures, capability-aware routing, and bounded parallel decomposition.
5. STEP-00-02 handoff naming product/Fred run correlation, checkpoint ownership, event hook points, and unresolved gaps.

### Commands

Run from `spikes/fred-runtime/` and copy the outputs or artifact paths into the spike note:

```bash
bun --version
node --version
npm view @fancyrobot/fred version
npm view @fancyrobot/fred-http version
bun install --frozen-lockfile
bun test
bunx tsc -p tsconfig.json --noEmit
```

If the local checkout is used, also record `git -C ../../../fred rev-parse HEAD`; never import its internal source paths.

### Constraints and Failure Handling

- Zero imports from unpublished Fred internals are allowed.
- Keep runtime execution at spike entry/test boundaries; internal services return Effect/Stream values.
- STEP-00-02 owns event, cancellation, replay, and recovery semantics; this step exposes hook points only.
- Store no secrets, untrusted source bodies, or large tool payloads in workflow/checkpoint metadata. Target at most 64 KiB inline per checkpoint; larger values use artifact references.
- If behavior requires application policy inside Fred core, default to a product-local adapter and record an upstream candidate only with a portable reproduction.
- Do not promote spike code into Phase 1 unchanged; the Outcome must identify what to reimplement, reuse, or discard.
