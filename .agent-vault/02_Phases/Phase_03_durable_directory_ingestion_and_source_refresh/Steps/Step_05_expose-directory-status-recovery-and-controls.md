---
note_type: step
template_version: 2
contract_version: 1
title: Expose Directory Status Recovery and Controls
step_id: STEP-03-05
phase: '[[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Phase|Phase 03 durable directory ingestion and source refresh]]'
status: in_progress
owner: Codex
created: '2026-07-17'
updated: '2026-07-19'
depends_on:
  - '[[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_04_process-changed-sources-and-preserve-version-lineage|STEP-03-04 Process Changed Sources and Preserve Version Lineage]]'
related_sessions:
  - '[[05_Sessions/2026-07-19-143611-expose-directory-status-recovery-and-controls-codex-step-03-05-worker|SESSION-2026-07-19-143611 Codex STEP-03-05 worker session for Expose Directory Status Recovery and Controls]]'
related_bugs: []
tags:
  - agent-vault
  - step
context_id: SESSION-2026-07-19-143611
active_session_id: 05_Sessions/2026-07-19-143611-expose-directory-status-recovery-and-controls-codex-step-03-05-worker
context_status: in_progress
context_summary: Implementation and root validation are complete; dedicated PR review and merge remain before STEP-03-05 is complete.
---

# Step 05 - Expose Directory Status Recovery and Controls

Use this note as a thin index for one executable step. Keep detail in companion notes so execution can load only the smallest note needed.

## Purpose

- Outcome: Implement the smallest coherent slice for Directory Status Recovery and Controls that advances Durable Directory Ingestion and Source Refresh while preserving sandboxed, resumable ingestion without per-file model calls.
- Parent phase: [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Phase|Phase 03 durable directory ingestion and source refresh]].
- Sequencing: start after [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_04_process-changed-sources-and-preserve-version-lineage|STEP-03-04 Process Changed Sources and Preserve Version Lineage]] has a stable outcome or handoff.

## Required Reading

- [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Phase|Phase 03 durable directory ingestion and source refresh]]
- [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_05_expose-directory-status-recovery-and-controls/Execution_Brief|Execution Brief]]
- [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_05_expose-directory-status-recovery-and-controls/Validation_Plan|Validation Plan]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[01_Architecture/System_Overview|System Overview]]
- [[01_Architecture/Code_Map|Code Map]]

## Companion Notes

- [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_05_expose-directory-status-recovery-and-controls/Execution_Brief|Execution Brief]] - Why the step exists, prerequisites, likely code paths, and the smallest execution checklist.
- [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_05_expose-directory-status-recovery-and-controls/Validation_Plan|Validation Plan]] - Acceptance checks, commands, edge cases, and regression expectations.
- [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_05_expose-directory-status-recovery-and-controls/Implementation_Notes|Implementation Notes]] - Durable findings discovered while the step is being executed.
- [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_05_expose-directory-status-recovery-and-controls/Outcome|Outcome]] - Final result, validation evidence, and explicit follow-up.

## Agent-Managed Snapshot

<!-- AGENT-START:step-agent-managed-snapshot -->
- Status: in_progress
- Current owner: Codex
- Last touched: 2026-07-19
- Next action: Address PR review feedback, revalidate, and merge STEP-03-05 before advancing.
<!-- AGENT-END:step-agent-managed-snapshot -->

## Human Notes

- Keep this step narrow and explicit; planned paths may not exist yet and should be created only when execution begins.

## Session History

<!-- AGENT-START:step-session-history -->
- 2026-07-19 - [[05_Sessions/2026-07-19-143611-expose-directory-status-recovery-and-controls-codex-step-03-05-worker|SESSION-2026-07-19-143611 Codex STEP-03-05 worker session for Expose Directory Status Recovery and Controls]] - Session created.
<!-- AGENT-END:step-session-history -->

## Related Notes

- [[07_Templates/Note_Contracts|Note Contracts]]
- [[07_Templates/Phase_Template|Phase Template]]
