# Implementation Notes

- Capture durable findings learned during execution. Prefer short bullets with file paths, commands, and observed behavior.

## Related Notes
## Implementation Notes

### Defect fixed (confirmed)

- `src/benchmarks/run.ts` had a single global child-crash gate: `runChildCrashProbe` probed only the worker, and `selectWinner` checked one global `child-crash: parent survives crash` probe. This let the in-process `direct` candidate (crashContained=null) pass the crash gate and win, because the gate never verified direct's (nonexistent) containment.
- The Validation Plan already required: "A forced native-worker/service crash must not terminate the parent" and "If direct in-process execution cannot be interrupted safely, record that as a topology failure." The old code violated this.

### Changes

- `src/probes/child-crash.ts`: now measures crash containment PER TOPOLOGY (worker + service). Probe names are namespaced: `child-crash:worker: …` and `child-crash:service: …`. The in-process `direct` topology is intentionally not probed (a native crash inside the controller is not containable).
- `src/benchmarks/run.ts`: `crashContainedFor()` derives honest per-topology containment from the namespaced probe reports. `selectWinner()` applies the crash gate PER TOPOLOGY (`crashContained === true`), not globally. `direct` (null) can never qualify; worker/service qualify only with measured evidence. `selectWinner` is exported for regression tests.
- `test/spike.test.ts`: crash probe test strengthened to assert both worker and service survive+recover. Two selection regression tests added: (1) direct (null) cannot win via a global probe, worker (true) wins; (2) no honest containment → null winner + crash blocker.

### Measured Artifacts (actual, from results/benchmark.json)

- direct: 49ms total, crashContained=null. worker: 103ms total, crashContained=true (winner). service: 120ms total, crashContained=true.
- No fabricated "security scores (70-100)" or "isolation (60-100%)" — those were not measured and have been removed from the vault notes.

### Validation

- `bun install --frozen-lockfile` — OK (no changes).
- `bunx tsc -p tsconfig.json --noEmit` — TS 7.0.2, exit 0.
- `bun test` — 16 pass / 0 fail (59 expect() calls).
- `bun run src/benchmarks/run.ts results/benchmark.json` — winner=worker.

### Recommendation

- **Selected Topology: `worker`** (isolated child process). `direct` rejected: native crash not containable, cooperative cancellation not hard preemption.

- Step: [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Steps/Step_03_spike-duckdb-bun-parquet-and-isolation-topology|STEP-00-03 Spike DuckDB Bun Parquet and Isolation Topology]]
- Phase: [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Phase|Phase 00 architecture spikes and delivery foundations]]
