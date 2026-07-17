---
note_type: step
template_version: 2
contract_version: 1
title: Spike DuckDB Bun Parquet and Isolation Topology
step_id: STEP-00-03
phase: '[[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Phase|Phase 00 architecture spikes and delivery foundations]]'
status: planned
owner: ''
created: '2026-07-17'
updated: '2026-07-17'
depends_on:
  - '[[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Steps/Step_02_spike-live-events-cancellation-and-checkpoint-recovery|STEP-00-02 Spike Live Events Cancellation and Checkpoint Recovery]]'
related_sessions: []
related_bugs: []
tags:
  - agent-vault
  - step
---

# Step 03 - Spike DuckDB Bun Parquet and Isolation Topology

Use this note as a thin index for one executable step. Keep detail in companion notes so execution can load only the smallest note needed.

## Purpose

- Outcome: Run a focused spike for DuckDB Bun Parquet and Isolation Topology and leave a written recommendation plus the smallest proving harness needed to guide later implementation in Architecture Spikes and Delivery Foundations.
- Parent phase: [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Phase|Phase 00 architecture spikes and delivery foundations]].
- Sequencing: start after [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Steps/Step_02_spike-live-events-cancellation-and-checkpoint-recovery|STEP-00-02 Spike Live Events Cancellation and Checkpoint Recovery]] has a stable outcome or handoff.
- Refined sequencing: after STEP-00-01 fixes shared runtime rules, this spike may run in parallel with STEP-00-02; consume STEP-00-02 cancellation assumptions before final topology selection.
- Refined execution mode: keep the harness under `spikes/duckdb-topology/`; do not create production data-engine or worker packages in Phase 0.

## Required Reading

- [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Phase|Phase 00 architecture spikes and delivery foundations]]
- [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Steps/Step_03_spike-duckdb-bun-parquet-and-isolation-topology/Execution_Brief|Execution Brief]]
- [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Steps/Step_03_spike-duckdb-bun-parquet-and-isolation-topology/Validation_Plan|Validation Plan]]
- [[01_Architecture/System_Overview|System Overview]]
- [[01_Architecture/Code_Map|Code Map]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]

## Companion Notes

- [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Steps/Step_03_spike-duckdb-bun-parquet-and-isolation-topology/Execution_Brief|Execution Brief]] - Why the step exists, prerequisites, likely code paths, and the smallest execution checklist.
- [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Steps/Step_03_spike-duckdb-bun-parquet-and-isolation-topology/Validation_Plan|Validation Plan]] - Acceptance checks, commands, edge cases, and regression expectations.
- [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Steps/Step_03_spike-duckdb-bun-parquet-and-isolation-topology/Implementation_Notes|Implementation Notes]] - Durable findings discovered while the step is being executed.
- [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Steps/Step_03_spike-duckdb-bun-parquet-and-isolation-topology/Outcome|Outcome]] - Final result, validation evidence, and explicit follow-up.

## Agent-Managed Snapshot

<!-- AGENT-START:step-agent-managed-snapshot -->
- Status: planned
- Current owner: 
- Last touched: 2026-07-17
- Next action: Read [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Steps/Step_03_spike-duckdb-bun-parquet-and-isolation-topology/Execution_Brief|Execution Brief]] and [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Steps/Step_03_spike-duckdb-bun-parquet-and-isolation-topology/Validation_Plan|Validation Plan]], then confirm the first bounded change against the dependency chain.
<!-- AGENT-END:step-agent-managed-snapshot -->

## Human Notes

- Keep this step narrow and explicit; planned paths may not exist yet and should be created only when execution begins.

### Refinement Readiness Checklist

- Exact outcome/success: **PASS** — three candidates, common workloads, metrics, safety gates, and a deterministic selection rule are specified.
- Why it matters: **PASS** — this retires DEC-0003 native-runtime and DEC-0009 data-engine isolation risk.
- Prerequisites/dependencies: **PASS** — STEP-00-01 runtime rules and STEP-00-02 cancellation assumptions are explicit without unnecessary serialization.
- Starting files/commands/tests: **PASS** — spike-only paths, exact package baseline, benchmark command, tests, and typecheck are named.
- Required reading: **PASS** — DEC-0003/0005/0009 plus architecture, security, and evaluation sections are listed.
- Constraints/non-goals: **PASS** — no production packages, no unsafe convenience tradeoff, and no silent promotion of spike code.
- Validation/manual checks: **PASS** — correctness hashes, performance/resource measures, security denials, crash, cancellation, and cleanup are explicit.
- Edge/failure/recovery: **PASS** — native failure, temp/disk issues, corrupt/schema-conflict inputs, concurrency, crash, and partial Parquet are covered.
- Security/performance: **PASS** — deny-by-default reachability and the 2x qualifying-candidate rule are stated with hardware metadata.
- Integration/downstream: **PASS** — runtime boundary, roots, limits, atomic writes, telemetry, and fallback are handed off.
- Blockers/handoff: **PASS** — unsafe reach, parent crash, unbounded cancel, non-reproducibility, or no qualifying topology block completion.
- Junior-developer verdict: **PASS — execution-ready.**

## Session History

<!-- AGENT-START:step-session-history -->
- No sessions yet.
<!-- AGENT-END:step-session-history -->

## Related Notes

- [[07_Templates/Note_Contracts|Note Contracts]]
- [[07_Templates/Phase_Template|Phase Template]]
