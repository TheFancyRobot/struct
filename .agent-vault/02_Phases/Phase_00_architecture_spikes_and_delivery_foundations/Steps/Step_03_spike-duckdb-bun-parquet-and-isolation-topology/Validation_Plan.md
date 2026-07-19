# Validation Plan

> **Historical validation plan — topology superseded:** This plan records how
> Phase 00 compared candidates. Its Node-compatible fallback is not current
> host permission. DEC-0003/DEC-0005 require the Phase-04 DuckDB adapter and
> any non-Bun runtime to remain inside a pinned isolated sidecar image.

## Acceptance Checks

- Confirm this deliverable is present, testable where applicable, and bounded to the step: Direct Bun/Node DuckDB access, an isolated worker process, and a narrow local service for dataset execution and Parquet materialization.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: Document the exact isolation topology: where DuckDB file access is allowed, how temp data is bounded, and how query resource limits are enforced.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: A benchmark-oriented recommendation that is specific about Parquet write paths, failure recovery, and deployment implications.
- The step leaves the next dependent step with a stable typed boundary, not a placeholder or undocumented assumption.

## Planned Verification

- Plan a probe that imports representative JSON/CSV data, writes Parquet, and runs one bounded read-only query through each candidate topology.
- Capture the measurements and failure modes needed to choose between in-process and isolated execution before Phase 04 implementation begins.
- Planned command once these packages exist: `bun test packages/data-engine` plus the nearest package-level `bun run typecheck`.
- Planned app/integration coverage once the app surfaces exist: `bun test apps/worker` for the API/worker/web path touched here.

## Edge Cases

- DuckDB startup or temp-directory failure must not corrupt future dataset snapshots or leave orphaned partial Parquet output.
- The chosen topology must explain how query cancellation works when the process is CPU-bound or scanning a large file set.
- Unsafe filesystem reachability from DuckDB must be treated as a blocker, not a convenience tradeoff.

## Regression Expectations

- This step should remain a clean successor to [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Steps/Step_02_spike-live-events-cancellation-and-checkpoint-recovery|STEP-00-02 Spike Live Events Cancellation and Checkpoint Recovery]] rather than reworking already-planned scope upstream.
- Do not narrow or contradict the product brief, architecture notes, or phase sequencing without an explicit follow-up decision note.
- Do not invent package APIs that imply implementation already exists; keep language and artifacts clearly planned or spike-scoped.
- Make sure later Phase 1 work can start from these outputs without re-litigating repository layout, security boundaries, or evaluation gates.

## Security / Observability / Evaluation Focus

- Model all imported content as untrusted evidence and keep prompt-injection defenses visible in the design outputs.
- Call out checkpoint, event, filesystem, and SQL trust boundaries wherever a spike touches them.
- Prefer observable, restart-safe designs over opaque runtime magic.

## Related Notes

- Step: [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Steps/Step_03_spike-duckdb-bun-parquet-and-isolation-topology|STEP-00-03 Spike DuckDB Bun Parquet and Isolation Topology]]
- Phase: [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Phase|Phase 00 architecture spikes and delivery foundations]]

## Refined Acceptance Contract

### Required Measurements

- Run the same seeded fixture, query corpus, limits, and result-hash assertions against all three candidate topologies.
- Record runtime/package/platform/hardware metadata, startup time, import and Parquet time, exact-query p50/p95, peak RSS, peak temp bytes, cancellation latency, concurrent throughput, error rate, and cleanup duration.
- Exact answers and persisted result hashes must match ground truth 100% for every qualifying candidate.
- Benchmark results are machine-specific evidence, not universal claims; raw JSON results and the human decision matrix are both required.

### Security, Failure, and Recovery Checks

- Reject arbitrary paths, `ATTACH`, extension install/load, network/process escape, DDL/DML, unsafe pragmas, unbounded rows, and outputs above the configured byte cap.
- A forced native-worker/service crash must not terminate the parent controller or corrupt the next run.
- Cancellation must produce a typed terminal outcome and release resources. If direct in-process execution cannot be interrupted safely, record that as a topology failure.
- Write Parquet through a temporary path and atomic promote. Startup/retry removes or quarantines partial artifacts; no partial file may be accepted as a dataset snapshot.
- Exercise missing/unwritable temp roots, corrupt JSON, schema conflicts, empty inputs, disk-pressure simulation where practical, and two concurrent long scans.
- Record observability fields for query/run identity, engine/runtime version, input snapshot/hash, limits, cancellation, output hash, truncation, and failure category.

### Selection and Blocker Rules

- **PASS:** one topology satisfies every correctness, isolation, cancellation, cleanup, bounded-output, and reproducibility check and meets the documented 2x performance selection rule; the fallback and downstream adapter contract are complete.
- **FAIL:** no topology qualifies, unsafe filesystem reach remains, a crash kills the parent, cancellation cannot be bounded, outputs are not reproducible, or partial Parquet can be mistaken for complete output.
- The historical plan said to record an isolated Node-compatible default when
  no topology qualified. Current policy instead permits that runtime only
  inside the pinned Phase-04 sidecar image; it is never a maintained-host
  fallback. Do not proceed by relaxing DEC-0009.
- The Outcome must include the winner/rejected-candidate rationale and the exact handoff required by STEP-00-04, STEP-00-05, and Phase 04.
