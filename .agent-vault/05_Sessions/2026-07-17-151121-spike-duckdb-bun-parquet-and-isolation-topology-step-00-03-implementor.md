---
note_type: session
template_version: 2
contract_version: 1
title: step-00-03-implementor session for Spike DuckDB Bun Parquet and Isolation Topology
session_id: SESSION-2026-07-17-151121
date: '2026-07-17'
status: completed
owner: step-00-03-closure-implementor
branch: ''
phase: '[[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Phase|Phase 00 architecture spikes and delivery foundations]]'
context:
  context_id: SESSION-2026-07-17-151121
  status: completed
  updated_at: '2026-07-17T16:59:00.000Z'
  current_focus:
    summary: Advance [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Steps/Step_03_spike-duckdb-bun-parquet-and-isolation-topology|STEP-00-03 Spike DuckDB Bun Parquet and Isolation Topology]].
    target: '[[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Steps/Step_03_spike-duckdb-bun-parquet-and-isolation-topology|STEP-00-03 Spike DuckDB Bun Parquet and Isolation Topology]]'
  resume_target:
    type: step
    target: '[[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Steps/Step_03_spike-duckdb-bun-parquet-and-isolation-topology|STEP-00-03 Spike DuckDB Bun Parquet and Isolation Topology]]'
    section: Context Handoff
  last_action:
    type: saved
    summary: Fixed per-topology crash-containment defect; regenerated benchmark (winner=worker); 16 tests pass; vault notes updated with measured results.
related_bugs: []
related_decisions: []
created: '2026-07-17'
updated: '2026-07-17'
tags:
  - agent-vault
  - session
---

# step-00-03-implementor session for Spike DuckDB Bun Parquet and Isolation Topology

> **Historical session — topology superseded:** This session preserves the
> measured Phase-00 result and the child-process winner selected at the time.
> DEC-0003/DEC-0005 now require an isolated Phase-04 DuckDB sidecar with any
> adapter runtime pinned inside the image. Bun remains the sole maintained
> host runtime; the historical DuckDB child process and Node fallback are not
> current implementation guidance.

Use one note per meaningful work session. Record chronology, validation, and handoff state, but promote durable conclusions into phase, architecture, bug, or decision notes. See [[07_Templates/Note_Contracts|Note Contracts]].

## Objective

- Advance [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Steps/Step_03_spike-duckdb-bun-parquet-and-isolation-topology|STEP-00-03 Spike DuckDB Bun Parquet and Isolation Topology]].
- Leave a clean handoff if the work stops mid-step.

## Planned Scope

- Review [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Steps/Step_03_spike-duckdb-bun-parquet-and-isolation-topology|STEP-00-03 Spike DuckDB Bun Parquet and Isolation Topology]] before editing.
- Record changed paths and validation as the session progresses.

## Execution Log

<!-- AGENT-START:session-execution-log -->
- 15:11 - Created session note.
- 15:11 - Linked related step [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Steps/Step_03_spike-duckdb-bun-parquet-and-isolation-topology|STEP-00-03 Spike DuckDB Bun Parquet and Isolation Topology]].
- 17:46 - Aligned docs/vault/session measured totals + rationale to the authoritative regenerated `results/benchmark.json` (lead run, generatedAt 2026-07-17T17:43:31Z): direct=49ms, worker=103ms (winner, fastest crash-contained), service=120ms; rationale=103ms; cancel ~93ms; timeout ~255ms; pathological ~10393ms. Added recorded-run + rerun-variability wording. vault_refresh + doctor clean.
<!-- AGENT-END:session-execution-log -->

## Findings

- Defect confirmed and fixed: `src/benchmarks/run.ts` used a single global child-crash probe (worker-only) that let the in-process `direct` candidate (crashContained=null) pass the crash gate and win. Crash containment is now applied PER TOPOLOGY: in-process native crash cannot be contained (direct stays null → cannot qualify); worker/service qualify only with honest per-topology evidence.
- The Validation Plan already required per-topology crash containment ("A forced native-worker/service crash must not terminate the parent"; "If direct in-process execution cannot be interrupted safely, record that as a topology failure"). The old code violated this.
- Removed fabricated vault claims ("security scores (70-100)", "isolation (60-100%)", "JSON import 248-623ms") that were never measured; replaced with actual values from results/benchmark.json.

## Context Handoff

- Use this as the single canonical prose section for prepared context, resume notes, and handoff summaries tied to the current effective context.
- Keep durable conclusions promoted into phase, bug, decision, or architecture notes when they outlive the session.

## Changed Paths

<!-- AGENT-START:session-changed-paths -->
- spikes/duckdb-topology/src/benchmarks/run.ts (per-topology crash gate; crashContainedFor; export selectWinner)
- spikes/duckdb-topology/src/probes/child-crash.ts (measure worker + service crash containment independently)
- spikes/duckdb-topology/test/spike.test.ts (worker+service crash assertions; 2 selection regression tests)
- spikes/duckdb-topology/results/benchmark.json (regenerated; winner=worker)
- spikes/duckdb-topology/README.md (16 tests; per-topology selection rule)
- spikes/duckdb-topology/.gitignore (new; exclude dist/ tsconfig.tsbuildinfo)
- docs/spikes/duckdb-bun-parquet-and-isolation-topology.md (measured results; winner=worker; handoff=worker)
- .agent-vault/02_Phases/.../Step_03_.../Outcome.md (measured results; removed fabricated claims)
- .agent-vault/02_Phases/.../Step_03_.../Implementation_Notes.md (defect + changes + measured)
- .agent-vault/02_Phases/.../Step_03_.../Execution_Brief.md (measured execution summary)
- Removed: spikes/duckdb-topology/tsconfig.tsbuildinfo, vault_validation_results.json
<!-- AGENT-END:session-changed-paths -->

## Validation Run

<!-- AGENT-START:session-validation-run -->
- Command: `bun install --frozen-lockfile` → OK (no changes, 9 installs/36 packages)
- Command: `bunx tsc -p tsconfig.json --noEmit` → exit 0 (TS 7.0.2)
- Command: `bun test` → 16 pass / 0 fail (59 expect() calls)
- Command: `bun run src/benchmarks/run.ts results/benchmark.json` → winner=worker, rationale=simplest crash-contained isolation (process) within 2x (103ms total)
- Notes: All four commands pass. benchmark.json regenerated from actual output.
<!-- AGENT-END:session-validation-run -->

## Bugs Encountered

<!-- AGENT-START:session-bugs-encountered -->
- None.
<!-- AGENT-END:session-bugs-encountered -->

## Decisions Made or Updated

<!-- AGENT-START:session-decisions-made-or-updated -->
- None.
<!-- AGENT-END:session-decisions-made-or-updated -->

## Follow-Up Work

<!-- AGENT-START:session-follow-up-work -->
- [x] Fixed per-topology crash-containment gate in src/benchmarks/run.ts.
- [x] Regenerated results/benchmark.json; updated README + docs/spikes from actual output.
- [x] Replaced fabricated vault STEP-00-03 claims with measured results.
- [x] Historical lead review completed. The later DEC-0003/DEC-0005 decision
  supersedes the worker-process handoff with an isolated Phase-04 sidecar.
<!-- AGENT-END:session-follow-up-work -->

## Completion Summary

- State what finished, what remains, and whether handoff is clean.

**Finished:** Fixed the confirmed selection defect — the global worker-only child-crash gate in `src/benchmarks/run.ts` that let in-process `direct` (crashContained=null) win. Crash containment is now applied per topology: `direct` can never qualify (native crash not containable); `worker`/`service` qualify only with honest per-topology evidence. Added a per-topology crash probe (worker + service) and two selection regression tests. Regenerated `results/benchmark.json` (winner=worker). Updated README + docs/spikes from actual output. Replaced fabricated vault STEP-00-03 Outcome/Implementation/Execution claims with measured results.

**Validation:** frozen install OK; `tsc --noEmit` exit 0 (TS 7.0.2); `bun test` 16 pass / 0 fail; benchmark regenerated.

**Winner selected at the time:** `worker` (isolated child process), simplest
crash-contained isolation within 2x. `direct` rejected (native crash not
containable). Limitation: OS/container isolation was not exercised by this
spike.

**Current handoff:** Preserve the measured hardening, limits, cancellation,
atomic-promotion, telemetry, and recovery evidence in the isolated
DEC-0003/DEC-0005 Phase-04 sidecar. Do not implement the historical host
worker-process or Node fallback.
