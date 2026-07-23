---
note_type: step
template_version: 2
contract_version: 1
title: Implement Sandboxed Recursive Discovery and Hashing
step_id: STEP-03-02
phase: '[[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Phase|Phase 03 durable directory ingestion and source refresh]]'
status: completed
owner: Codex
created: '2026-07-17'
updated: '2026-07-19'
depends_on:
  - '[[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_01_define-directory-manifests-snapshots-and-refresh-semantics|STEP-03-01 Define Directory Manifests Snapshots and Refresh Semantics]]'
related_sessions:
  - '[[05_Sessions/2026-07-19-122554-implement-sandboxed-recursive-discovery-and-hashing-codex-step-03-02-worker|SESSION-2026-07-19-122554 Codex STEP-03-02 worker session for Implement Sandboxed Recursive Discovery and Hashing]]'
related_bugs: []
tags:
  - agent-vault
  - step
context_id: SESSION-2026-07-19-122554
active_session_id: 05_Sessions/2026-07-19-122554-implement-sandboxed-recursive-discovery-and-hashing-codex-step-03-02-worker
context_status: completed
context_summary: Completed and validated STEP-03-02 sandboxed recursive discovery and hashing.
---

# Step 02 - Implement Sandboxed Recursive Discovery and Hashing

Use this note as a thin index for one executable step. Keep detail in companion notes so execution can load only the smallest note needed.

## Purpose

- Outcome: Implement the smallest coherent slice for Sandboxed Recursive Discovery and Hashing that advances Durable Directory Ingestion and Source Refresh while preserving sandboxed, resumable ingestion without per-file model calls.
- Parent phase: [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Phase|Phase 03 durable directory ingestion and source refresh]].
- Sequencing: start after [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_01_define-directory-manifests-snapshots-and-refresh-semantics|STEP-03-01 Define Directory Manifests Snapshots and Refresh Semantics]] has a stable outcome or handoff.

## Required Reading

- [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Phase|Phase 03 durable directory ingestion and source refresh]]
- [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_02_implement-sandboxed-recursive-discovery-and-hashing/Execution_Brief|Execution Brief]]
- [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_02_implement-sandboxed-recursive-discovery-and-hashing/Validation_Plan|Validation Plan]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[01_Architecture/System_Overview|System Overview]]
- [[01_Architecture/Code_Map|Code Map]]

## Companion Notes

- [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_02_implement-sandboxed-recursive-discovery-and-hashing/Execution_Brief|Execution Brief]] - Why the step exists, prerequisites, likely code paths, and the smallest execution checklist.
- [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_02_implement-sandboxed-recursive-discovery-and-hashing/Validation_Plan|Validation Plan]] - Acceptance checks, commands, edge cases, and regression expectations.
- [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_02_implement-sandboxed-recursive-discovery-and-hashing/Implementation_Notes|Implementation Notes]] - Durable findings discovered while the step is being executed.
- [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_02_implement-sandboxed-recursive-discovery-and-hashing/Outcome|Outcome]] - Final result, validation evidence, and explicit follow-up.

## Agent-Managed Snapshot

<!-- AGENT-START:step-agent-managed-snapshot -->
- Status: completed
- Current owner:
- Last touched: 2026-07-17
- Next action: None; step completed.
<!-- AGENT-END:step-agent-managed-snapshot -->

## Human Notes

- Keep this step narrow and explicit; planned paths may not exist yet and should be created only when execution begins.
- Completed with `DirectoryDiscovery`, an Effect service over an injected filesystem adapter. It preserves STEP-03-01 canonical contracts, streams bounded hashes, and emits deterministic partial outcomes without widening registered roots.
- The Bun filesystem layer rejects symlink roots and entries, verifies canonical containment, opens files with `O_NOFOLLOW`, and matches the opened descriptor to the current contained path before hashing.
- Downstream refresh work must inspect all typed failures before interpreting absent manifest paths as removals.
- Root pre-PR validation: ingestion 29 pass / 0 fail; repository 350 pass / 114 PostgreSQL-gated skip / 0 fail; typecheck, lint, dependency boundaries, build, docs lint, secrets scan, and vault doctor all passed.

## Session History

<!-- AGENT-START:step-session-history -->
- 2026-07-19 - [[05_Sessions/2026-07-19-122554-implement-sandboxed-recursive-discovery-and-hashing-codex-step-03-02-worker|SESSION-2026-07-19-122554 Codex STEP-03-02 worker session for Implement Sandboxed Recursive Discovery and Hashing]] - Session created.
<!-- AGENT-END:step-session-history -->

## Related Notes

- [[07_Templates/Note_Contracts|Note Contracts]]
- [[07_Templates/Phase_Template|Phase Template]]
