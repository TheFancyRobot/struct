---
note_type: step
template_version: 2
contract_version: 1
title: Build Resumable Idempotent Ingestion Jobs
step_id: STEP-03-03
phase: '[[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Phase|Phase 03 durable directory ingestion and source refresh]]'
status: completed
owner: Codex
created: '2026-07-17'
updated: '2026-07-19'
depends_on:
  - '[[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_02_implement-sandboxed-recursive-discovery-and-hashing|STEP-03-02 Implement Sandboxed Recursive Discovery and Hashing]]'
related_sessions:
  - '[[05_Sessions/2026-07-19-125436-build-resumable-idempotent-ingestion-jobs-codex-step-03-03-worker|SESSION-2026-07-19-125436 Codex STEP-03-03 worker session for Build Resumable Idempotent Ingestion Jobs]]'
related_bugs: []
tags:
  - agent-vault
  - step
context_id: SESSION-2026-07-19-125436
active_session_id: 05_Sessions/2026-07-19-125436-build-resumable-idempotent-ingestion-jobs-codex-step-03-03-worker
context_status: completed
context_summary: Advance [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_03_build-resumable-idempotent-ingestion-jobs|STEP-03-03 Build Resumable Idempotent Ingestion Jobs]].
---

# Step 03 - Build Resumable Idempotent Ingestion Jobs

Use this note as a thin index for one executable step. Keep detail in companion notes so execution can load only the smallest note needed.

## Purpose

- Outcome: Implement the smallest coherent slice for Resumable Idempotent Ingestion Jobs that advances Durable Directory Ingestion and Source Refresh while preserving sandboxed, resumable ingestion without per-file model calls.
- Parent phase: [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Phase|Phase 03 durable directory ingestion and source refresh]].
- Sequencing: start after [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_02_implement-sandboxed-recursive-discovery-and-hashing|STEP-03-02 Implement Sandboxed Recursive Discovery and Hashing]] has a stable outcome or handoff.

## Required Reading

- [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Phase|Phase 03 durable directory ingestion and source refresh]]
- [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_03_build-resumable-idempotent-ingestion-jobs/Execution_Brief|Execution Brief]]
- [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_03_build-resumable-idempotent-ingestion-jobs/Validation_Plan|Validation Plan]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[01_Architecture/System_Overview|System Overview]]
- [[01_Architecture/Code_Map|Code Map]]

## Companion Notes

- [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_03_build-resumable-idempotent-ingestion-jobs/Execution_Brief|Execution Brief]] - Why the step exists, prerequisites, likely code paths, and the smallest execution checklist.
- [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_03_build-resumable-idempotent-ingestion-jobs/Validation_Plan|Validation Plan]] - Acceptance checks, commands, edge cases, and regression expectations.
- [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_03_build-resumable-idempotent-ingestion-jobs/Implementation_Notes|Implementation Notes]] - Durable findings discovered while the step is being executed.
- [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_03_build-resumable-idempotent-ingestion-jobs/Outcome|Outcome]] - Final result, validation evidence, and explicit follow-up.

## Agent-Managed Snapshot

<!-- AGENT-START:step-agent-managed-snapshot -->
- Status: completed
- Current owner: Codex
- Last touched: 2026-07-19
- Next action: Complete PR review and merge, then begin STEP-03-04 in a fresh worker.
<!-- AGENT-END:step-agent-managed-snapshot -->

## Human Notes

- Keep this step narrow and explicit; planned paths may not exist yet and should be created only when execution begins.

## Session History

<!-- AGENT-START:step-session-history -->
- 2026-07-19 - [[05_Sessions/2026-07-19-125436-build-resumable-idempotent-ingestion-jobs-codex-step-03-03-worker|SESSION-2026-07-19-125436 Codex STEP-03-03 worker session for Build Resumable Idempotent Ingestion Jobs]] - Session created.
<!-- AGENT-END:step-session-history -->

## Related Notes

- [[07_Templates/Note_Contracts|Note Contracts]]
- [[07_Templates/Phase_Template|Phase Template]]
