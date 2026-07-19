# Execution Brief

> **Historical execution brief — topology superseded:** This records the
> Phase-00 experiment and its selected-at-the-time child-process result.
> DEC-0003 and DEC-0005 now require an isolated Phase-04 DuckDB
> container/sidecar. Any adapter runtime is pinned inside that image; Bun
> remains the sole maintained host runtime, with no DuckDB host child process
> or host-loaded native adapter.

## Exact Outcome

- Produce the concrete contracts, artifacts, and bounded implementation/design surfaces for DuckDB Bun Parquet and Isolation Topology that this step is responsible for before any broader follow-on work begins.

## Prerequisites

- Re-read [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Phase|Phase 00 architecture spikes and delivery foundations]] and confirm the step still matches the current roadmap sequence.
- Confirm the handoff from [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Steps/Step_02_spike-live-events-cancellation-and-checkpoint-recovery|STEP-00-02 Spike Live Events Cancellation and Checkpoint Recovery]] before widening scope.
- Keep deterministic work in typed Effect services, repositories, and tools; reserve Fred for agentic orchestration only.
- Treat the listed files as planned starting points; create only the smallest set needed to land the slice.

## Planned Starting Files

- These paths may not exist yet; use them as the first bounded implementation or design surface.
- `docs/spikes/duckdb-bun-parquet-and-isolation-topology.md`
- `packages/data-engine/src/duckdb/runtime.ts`
- `packages/data-engine/src/duckdb/query-runner.ts`
- `apps/worker/src/data/duckdb-executor.ts`
- `docker-compose.yml`

## Required Reading

- [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Phase|Phase 00 architecture spikes and delivery foundations]]
- [[01_Architecture/System_Overview|System Overview]]
- [[01_Architecture/Code_Map|Code Map]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
- [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Steps/Step_02_spike-live-events-cancellation-and-checkpoint-recovery|STEP-00-02 Spike Live Events Cancellation and Checkpoint Recovery]]
- `docs/product-brief.md` sections 5-7, 13, 18-19, 21, 24, 26, and 29-31.

## Concrete Deliverables

- Compare direct Bun/Node DuckDB access, an isolated worker process, and a narrow local service for dataset execution and Parquet materialization.
- Document the exact isolation topology: where DuckDB file access is allowed, how temp data is bounded, and how query resource limits are enforced.
- Produce a benchmark-oriented recommendation that is specific about Parquet write paths, failure recovery, and deployment implications.

## Smallest Bounded Checklist

- First, compare direct Bun/Node DuckDB access, an isolated worker process, and a narrow local service for dataset execution and Parquet materialization.
- Then, document the exact isolation topology: where DuckDB file access is allowed, how temp data is bounded, and how query resource limits are enforced.
- Next, produce a benchmark-oriented recommendation that is specific about Parquet write paths, failure recovery, and deployment implications.
- Finish by leaving one observable typed path—test, route, worker flow, or UI state—that proves the slice is ready for the next dependent step.

## Constraints and Non-Goals

- Keep Phase 0 work decision-oriented: prove boundaries, not broad production scaffolding.
- Keep deterministic work in typed Effect services and adapters; use Fred only where agentic judgment is actually required.
- Record tradeoffs and rejected options explicitly so later implementation steps do not need to rediscover them.

## Related Notes
## Execution Summary (measured)

### Completed Tasks
- Fixed the per-topology crash-containment defect in `src/benchmarks/run.ts` (global worker-only gate let in-process `direct` win).
- Extended `src/probes/child-crash.ts` to measure worker AND service crash containment independently.
- Added selection regression tests; regenerated `results/benchmark.json`.

### Measured Results (actual, from results/benchmark.json)
- direct: 49ms total, crashContained=null (cannot qualify). worker: 103ms, crashContained=true (winner). service: 120ms, crashContained=true.
- rowsHash identical across all three. Cancellation ~93ms; timeout ~255ms; pathological query bounded ~10393ms.
- No fabricated "security scores (70-100)" or "isolation (60-100%)" — not measured; removed.

### Recommendation
- **Selected at the time: `worker`** (isolated child process). `direct` rejected: native crash not containable.
- **Current Phase-04 handoff:** preserve the measured invariants behind the
  isolated DEC-0003/DEC-0005 sidecar; do not implement the historical host
  worker-process boundary or Node fallback.



- Step: [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Steps/Step_03_spike-duckdb-bun-parquet-and-isolation-topology|STEP-00-03 Spike DuckDB Bun Parquet and Isolation Topology]]
- Phase: [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Phase|Phase 00 architecture spikes and delivery foundations]]

## Refinement Addendum

### Starting Points and Required Reading

- Use `docs/spikes/duckdb-bun-parquet-and-isolation-topology.md`, `spikes/duckdb-topology/`, and deterministic spike fixtures; production data-engine/worker paths do not yet exist.
- Read DEC-0003, DEC-0005, and DEC-0009; `docs/architecture.md` sections 6.3, 10, and 13-14; the DuckDB boundaries in `docs/security-model.md`; and the scale/structured-data gates in `docs/evaluation-strategy.md`.
- Record exact resolved versions. The researched baseline is `@duckdb/node-api@1.5.4-r.1` and `@duckdb/node-bindings@1.5.4-r.1`, but the spike lockfile is authoritative.

### Candidates and Workloads

Compare one adapter contract across: (1) official Node API directly under Bun, (2) isolated child data worker, and (3) narrow local service.

Run each against a small smoke fixture and a seeded approximately 25,000-JSON-file scale fixture; JSON import/schema inspection; Parquet materialization/reopen; exact bounded queries; concurrency/backpressure; cancellation during scan; invalid path and `ATTACH`/extension/network attempts; temp-directory failure; forced child crash; and cleanup/retry after partial output. Reconcile the spike fixture seed/manifest with STEP-00-06 before finalizing.

### Evidence and Selection Rule

For every candidate record correctness and hashes, startup/import/materialization/query duration, peak RSS, peak temp bytes, cancellation latency, concurrency behavior, crash containment, partial-output cleanup, deployment complexity, and Bun/Node portability.

Select the simplest candidate that returns 100% correct deterministic results; denies arbitrary filesystem/network/extension/process reach; supports bounded output and cooperative cancellation; contains a native crash without killing the parent control process; leaves no accepted partial Parquet artifact; and performs within 2x the fastest candidate that also passes every safety/correctness gate on the recorded machine.

The historical spike plan allowed an isolated Node-compatible candidate when
no Bun candidate qualified. That rule is superseded for maintained-host
execution: an adapter runtime may now exist only inside the pinned isolated
service image defined by DEC-0003/DEC-0005. Unsafe filesystem reach or a crash
that kills the control plane remains a blocker.

### Commands and Handoff

```bash
cd spikes/duckdb-topology
bun --version
node --version
npm view @duckdb/node-api version
npm view @duckdb/node-bindings version
bun install --frozen-lockfile
bun test
bunx tsc -p tsconfig.json --noEmit
bun run benchmark -- --seed phase-00 --json results.json
```

Hand off the measured staged/temp roots, resource/cancel/output limits or
calibration owners, Parquet atomic-write rule, artifact-reference rule, and
telemetry fields to the isolated Phase-04 sidecar. The historical
Node-compatible host fallback is evidence only and must not be implemented.
