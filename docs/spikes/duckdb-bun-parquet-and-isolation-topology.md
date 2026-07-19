# DuckDB Bun Parquet and Isolation Topology Spike

> STATUS: This is a **proving harness**, not a production implementation. All
> numbers below are **machine-specific evidence from a single run on this host**
> (see `results/benchmark.json` for the raw, machine-generated bundle). They are
> not universal performance claims.
>
> **SUPERSEDED TOPOLOGY NOTICE:** The child-process winner and Node-compatible
> fallback below record what this Phase-00 harness selected at the time. They
> are not current production guidance. DEC-0003 and DEC-0005 now require
> Phase 04 to run DuckDB in an isolated container/sidecar whose adapter runtime
> is pinned inside the image. Bun remains the sole maintained host runtime;
> DuckDB must not run as a host child process or load its native adapter into a
> maintained host application.

## What this spike actually proves

This harness under `spikes/duckdb-topology/` compares three DuckDB isolation
topologies against a **deterministic, seeded** fixture and records only measured
values. It uses the **real `@duckdb/node-api` 1.5.4-r.1** operations
(`read_json_auto`, `read_csv_auto`, `COPY ... (FORMAT PARQUET)`, `read_parquet`,
`current_setting`), not simulations.

### The three candidates

1. **direct** — DuckDB runs in the controller process (`isolation: none`).
2. **worker** — DuckDB runs in a forked child process with JSON-over-stdio IPC
   (`isolation: process`).
3. **service** — DuckDB runs behind a narrow `127.0.0.1`-only HTTP service
   (`isolation: service`).

All three share one hardened DuckDB core (`src/common/duckdb.ts`).

## Proven DuckDB 1.5.4-r.1 hardening model

The security model was **verified by direct probes** (not assumed). The
sequence that works on this build is:

1. Create the instance with `allow_community_extensions=false` and
   `allow_unsigned_extensions=false`, external access **on** (default).
2. `SET allowed_directories=['<sandboxRoot>']` — carve out the allowlist.
3. `SET enable_external_access=false` — lock everything **except** the carve-out.

After step 3, measured behavior:

| Attempt | Result |
|---|---|
| `read_json_auto('/etc/passwd')` | **DENIED** — `Cannot access file ... file system operations are disabled` |
| `ATTACH '/tmp/rogue.db'` | **DENIED** — `Cannot access file ...` |
| `INSTALL httpfs` | **DENIED** — `Cannot access directory .../extensions/...` |
| `COPY ... TO '/tmp/x.parquet'` (outside root) | **DENIED** — path rejected by our guard + DuckDB FS layer |
| `read_json_auto('<root>/data/x.json')` | **allowed** (carve-out works) |
| `COPY ... TO '<root>/parquet/x.parquet'` | **allowed** (carve-out works) |

A second layer (`src/common/security.ts`) rejects path traversal (`../`) and
forbids `ATTACH/INSTALL/CREATE/DROP/INSERT/UPDATE/DELETE/COPY/PRAGMA`/etc. in
SQL **before** it reaches DuckDB (defense in depth).

> NOTE: `allowed_directories` **cannot** be set while `enable_external_access`
> is already `false` (`Cannot change allowed_directories when
> enable_external_access is disabled`). The carve-out must be set first. This
> ordering is enforced by `createHardenedConnection`.

## Measured results (single run on this host)

See `results/benchmark.json` for the authoritative, machine-generated bundle.
The totals below are from the single recorded run captured in that file
(`generatedAt` 2026-07-17T17:43:31Z); durations are machine-specific and
vary slightly on rerun, but the winner, crash-containment classification, and
identical rowsHash are stable across runs.

| Topology | Correctness | rowsHash (first 16) | totalMs | crashContained |
|---|---|---|---|---|
| direct   | PASS | `73d08d56dc1adbcf` | 49  | n/a (in-process: native crash not containable) |
| worker   | PASS | `73d08d56dc1adbcf` | 103 | true (measured per topology) |
| service  | PASS | `73d08d56dc1adbcf` | 120 | true (measured per topology) |

- All three topologies produce the **identical deterministic rowsHash** —
  correctness and reproducibility gate satisfied.
- Cancellation via `conn.interrupt()` terminated a long scan in ~93ms.
- Wall-clock timeout rejected a hung operation at ~255ms.
- A forced **worker** crash (`exit 137`) did **not** kill the parent; the
  parent respawned, re-initialized, and served a retry successfully.
- A forced **service** crash (`exit 137`) did **not** kill the parent; the
  parent respawned, re-initialized, and served a retry successfully.
- Atomic Parquet promote: the final file exists; no `.tmp-*` partial remains.
- Output above the byte cap (`320 bytes > 8 cap`) was rejected and removed.
- `memory_limit` and `threads` were confirmed applied via `current_setting`.
- A pathological query was bounded by the wall-clock timeout at ~10393ms.

### Selection

**WINNER: `worker`** — the simplest crash-contained isolation that passes every
correctness/safety gate and performs within 2x of the fastest crash-contained
candidate (103ms total vs 103ms fastest crash-contained). `blocker: null`.

The selection applies a **per-topology** crash-containment gate, not a single
global probe. The in-process `direct` candidate cannot contain a native crash
(`crashContained: null`), so it cannot qualify no matter how fast or simple it
is. A native crash inside the controller process cannot be safely contained
and cooperative cancellation (`conn.interrupt()`) cannot forcibly terminate
the native thread inside the same process; the wall-clock timeout can reject
the promise but cannot recover the process. Both process-isolated candidates
(worker, service) qualify with **honest per-topology containment evidence** —
each was independently forced to crash and proven to survive, respawn, and
retry. `worker` (process) wins over `service` because it is the simpler
isolation that still performs within 2x.

This is a **spike-level** recommendation. The worker topology passes every
gate the harness can exercise, including the DuckDB-native filesystem allowlist
and extension blocking, plus hard process-level crash containment that the
in-process direct topology cannot provide. See Limitations.

## Limitations (unproven claims, stated explicitly)

These are **not** claimed by this harness and are recorded as limitations:

1. **OS/container isolation is NOT exercised.** Docker, seccomp, namespaces,
   and cgroups are not run or measured. The harness proves DuckDB's own
   filesystem allowlist + extension blocking, **not** OS-level sandboxing.
   Container-level isolation remains an unproven assumption.
2. **Direct cancellation is cooperative, not hard preemption.** The direct
   topology relies on `conn.interrupt()`. A truly CPU-bound native scan that
   ignores interrupt falls back to the wall-clock timeout, which rejects the
   promise but cannot forcibly terminate the native thread inside the same
   process. This is a caveat, not a claim of hard preemption.
3. **The narrow service is a proving harness, not a production service.** It
   binds to `127.0.0.1` only and has **no authentication**. Network exposure
   beyond localhost is out of scope.
4. **Disk-pressure simulation is not exercised** (would require fs
   manipulation outside the sandbox). The byte cap and temp cleanup are
   exercised instead.
5. **Concurrency** is exercised at the level of overlapping long scans in the
   cancellation probe; a full multi-client load test is out of scope.
6. **Results are machine-specific.** Re-run `bun run src/benchmarks/run.ts
   results/benchmark.json` on the target machine for that host's evidence.

## How to run

```bash
cd spikes/duckdb-topology
bun install --frozen-lockfile          # frozen install
bun test                               # 16 tests: topologies + every probe + selection regression
bunx tsc -p tsconfig.json --noEmit      # TypeScript 7.0.2 typecheck
bun run src/benchmarks/run.ts results/benchmark.json   # regenerate evidence
```

## Layout

```
src/
  common/   types.ts fixtures.ts security.ts duckdb.ts results.ts
  direct/   direct.ts
  worker/   protocol.ts worker.ts parent.ts
  service/  server.ts client.ts
  probes/   allowlist.ts cancellation.ts child-crash.ts temp-cleanup.ts resource-limits.ts
  benchmarks/ run.ts
test/       spike.test.ts
results/    benchmark.json   # machine-generated, the only source of numbers
```

## Historical Handoff to STEP-00-04 / STEP-00-05 / Phase 04 (Superseded)

- **Selected at the time:** isolated child-process worker (DuckDB in a
  forked child process with JSON-over-stdio IPC). This is the simplest
  topology that provides honest process-level crash containment, on top of
  the proven `SET allowed_directories` → `SET enable_external_access=false`
  hardening. The in-process direct candidate was rejected because a native
  crash inside the controller process cannot be contained.
- **Staged/temp roots:** all data/temp/parquet live under a single sandbox
  root; nothing outside it is reachable.
- **Resource/cancel/output limits:** `memory_limit`, `threads`,
  wall-clock `timeoutMs`, `maxRows` read cap, `maxOutputBytes` byte cap.
  Cancellation owners: the child uses `conn.interrupt()`; the worker parent
  adds child-process kill + respawn as a hard fallback when the child dies or
  exceeds the timeout.
- **Parquet atomic-write rule:** write to `<dest>.tmp-<pid>-<ts>`, verify size
  ≤ cap, then `rename` (atomic on same filesystem). No partial is ever
  promoted as a dataset snapshot.
- **Telemetry fields:** query/run identity, engine/runtime version, input
  snapshot/hash, limits, cancellation, output hash, truncation, failure
  category (see `results.ts` + `benchmark.json`).
- **Historical harness fallback:** the worker and service topologies spawn via
  `bun` when available and fall back to `node`; the harness contains no
  Bun-only APIs. This measured portability remains spike evidence only and
  does not permit Node or a DuckDB child process on the maintained host.
- **Current Phase-04 handoff:** preserve the measured hardening, limits,
  cancellation, atomic-promotion, telemetry, and crash-recovery requirements
  behind an isolated DuckDB container/sidecar. Its adapter runtime must be
  pinned inside the image and accessed by the Bun worker through a typed,
  authenticated, bounded protocol.
- **Rejected option (recorded):** the in-process `direct` topology is faster
  and simpler but fails the crash-containment gate — a native crash is not
  containable and cooperative cancellation is not hard preemption. Do not
  re-litigate this without a new process-isolation mechanism.
