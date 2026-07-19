# Outcome

> **Historical outcome — topology superseded:** The measurements and
> selected-at-the-time worker result below remain valid spike evidence.
> DEC-0003 and DEC-0005 now require Phase 04 to implement an isolated DuckDB
> container/sidecar with any adapter runtime pinned inside the image. The
> maintained Bun host must not run the historical DuckDB child process or a
> Node fallback.

- Record the final result, validation performed, and explicit follow-up here.

## Related Notes
## Outcome Summary

### Step Completion Status
- ✅ DuckDB Topology Spike completed: three candidates measured, selection defect fixed, evidence regenerated.
- ✅ Defect fixed: a global child-crash probe (worker-only) previously let the in-process `direct` candidate (crashContained=null) pass the crash gate and win. The crash-containment gate is now applied PER TOPOLOGY. An in-process native crash cannot be contained, so `direct` can never qualify; `worker`/`service` qualify only with honest per-topology containment evidence.
- ✅ Regression assertion added: `direct` (crashContained=null) cannot win; `worker` (crashContained=true) wins; no honest containment → null winner + crash blocker.
- ✅ `results/benchmark.json` regenerated from actual output.

### Measured Results (single run on this host; see results/benchmark.json)

Totals from the recorded run in `results/benchmark.json` (`generatedAt` 2026-07-17T17:43:31Z); durations vary slightly on rerun, but the winner, crash-containment classification, and identical rowsHash are stable.

| Topology | Correctness | totalMs | crashContained |
|---|---|---|---|
| direct  | PASS | 49  | n/a (in-process: native crash not containable) |
| worker  | PASS | 103 | true (measured per topology) |
| service | PASS | 120 | true (measured per topology) |

- rowsHash identical across all three: `73d08d56…` (correctness + reproducibility).
- Cancellation via `conn.interrupt()`: ~93ms. Wall-clock timeout: ~255ms.
- Worker AND service each survived a forced `exit 137` crash, respawned, and served a retry.
- Atomic Parquet promote: final exists, no `.tmp-*` partial. Byte cap rejected 320B>8 cap.
- `memory_limit` (~244 MiB) and `threads=2` confirmed via `current_setting`. Pathological query bounded at ~10393ms.

### Recommendation

- **Selected at the time: `worker`** (isolated child process, JSON-over-stdio IPC).
- **Justification:** simplest crash-contained isolation that passes every correctness/safety gate and performs within 2x of the fastest crash-contained candidate. `direct` is faster/simpler but fails the per-topology crash-containment gate (native crash not containable; cooperative cancellation is not hard preemption).
- **Current Phase-04 handoff:** retain the measured protocol, hardening,
  resource, cancellation, promotion, and recovery invariants in the isolated
  DEC-0003/DEC-0005 sidecar; do not implement the historical host
  worker-process or Node fallback.

### Validation Status

- Commands passed: `bun install --frozen-lockfile`, `bunx tsc -p tsconfig.json --noEmit` (TS 7.0.2, exit 0), `bun test` (16 pass / 0 fail, 59 expect calls), `bun run src/benchmarks/run.ts results/benchmark.json`.
- `results/benchmark.json` is the only source of numbers; docs/spikes + README updated from actual output.

- Step: [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Steps/Step_03_spike-duckdb-bun-parquet-and-isolation-topology|STEP-00-03 Spike DuckDB Bun Parquet and Isolation Topology]]
- Phase: [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Phase|Phase 00 architecture spikes and delivery foundations]]
