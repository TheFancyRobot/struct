# DuckDB Topology Spike

A **proving harness** (not a production implementation) that compares three
DuckDB isolation topologies using **real `@duckdb/node-api` 1.5.4-r.1**
operations and records only measured values.

> **Topology superseded:** The child-process candidate remains measured
> Phase-00 evidence, not current production guidance. DEC-0003/DEC-0005 require
> Phase 04 to run DuckDB in an isolated container/sidecar with its adapter
> runtime pinned inside the image. Bun is the sole maintained host runtime; do
> not use this harness as permission for a DuckDB host child process or Node
> fallback.

## Candidates

1. **direct** — DuckDB in the controller process (`isolation: none`)
2. **worker** — DuckDB in a forked child process with JSON-over-stdio IPC (`isolation: process`)
3. **service** — DuckDB behind a narrow `127.0.0.1`-only HTTP service (`isolation: service`)

## Commands

```bash
bun install --frozen-lockfile                          # frozen install
bun test                                               # 16 tests
bunx tsc -p tsconfig.json --noEmit                      # TypeScript 7.0.2 typecheck
bun run src/benchmarks/run.ts results/benchmark.json   # regenerate evidence
```

## Evidence

The only source of numbers is the machine-generated `results/benchmark.json`.
See `docs/spikes/duckdb-bun-parquet-and-isolation-topology.md` for the
recommendation, the proven hardening model, measured results, and explicit
limitations (OS/container isolation is NOT exercised).

## Layout

```
src/common/    shared types, deterministic fixtures, security guards, hardened DuckDB core
src/direct/    in-process topology
src/worker/    isolated child-process topology (protocol + worker + parent)
src/service/   narrow localhost service topology (server + client)
src/probes/    allowlist, cancellation/timeout, child-crash, temp-cleanup, resource-limits
src/benchmarks/  orchestration that writes results/benchmark.json
test/          spike.test.ts
```

## Selection rule

The simplest candidate that returns 100% correct deterministic results, denies
arbitrary filesystem/network/extension/process reach, supports bounded output
and cooperative cancellation, **contains a native crash without killing the
parent (proven per topology, not via a global probe)**, leaves no accepted
partial Parquet, and performs within 2x of the fastest crash-contained
candidate. The in-process `direct` candidate cannot qualify: a native crash
inside the controller process is not containable. Unsafe filesystem reach or a
crash that kills the parent is a blocker.
