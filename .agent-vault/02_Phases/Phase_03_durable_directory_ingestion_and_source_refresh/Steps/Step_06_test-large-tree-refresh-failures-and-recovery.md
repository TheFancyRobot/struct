---
note_type: step
template_version: 2
contract_version: 1
title: Test Large-Tree Refresh Failures and Recovery
step_id: STEP-03-06
phase: '[[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Phase|Phase 03 durable directory ingestion and source refresh]]'
status: completed
owner: Codex
created: '2026-07-17'
updated: '2026-07-22'
depends_on:
  - '[[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_05_expose-directory-status-recovery-and-controls|STEP-03-05 Expose Directory Status Recovery and Controls]]'
related_sessions:
  - '[[05_Sessions/2026-07-19-151248-test-large-tree-refresh-failures-and-recovery-codex-step-03-06-worker|SESSION-2026-07-19-151248 Codex STEP-03-06 worker session for Test Large-Tree Refresh Failures and Recovery]]'
related_bugs:
  - '[[03_Bugs/BUG-0024_source-text-reindex-heartbeat-failure-test-asserts-redacted-persistence-detail|BUG-0024 Source Text Reindex Heartbeat Failure Test Asserts Redacted Persistence Detail]]'
  - '[[03_Bugs/BUG-0025_ingestion-heartbeat-failure-test-asserts-redacted-persistence-detail|BUG-0025 Ingestion Heartbeat Failure Test Asserts Redacted Persistence Detail]]'
tags:
  - agent-vault
  - step
context_id: SESSION-2026-07-19-151248
active_session_id: 05_Sessions/2026-07-19-151248-test-large-tree-refresh-failures-and-recovery-codex-step-03-06-worker
context_status: completed
context_summary: 'Implemented, independently validated, reviewed with zero unresolved findings, and merged to main in PR #16 at c9dab0d.'
---

# Step 06 - Test Large-Tree Refresh Failures and Recovery

Use this note as a thin index for one executable step. Keep detail in companion notes so execution can load only the smallest note needed.

## Purpose

- Outcome: Validate and harden Large-Tree Refresh Failures and Recovery with explicit evidence, remaining gaps, and next actions before the roadmap moves past Durable Directory Ingestion and Source Refresh.
- Parent phase: [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Phase|Phase 03 durable directory ingestion and source refresh]].
- Sequencing: start after [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_05_expose-directory-status-recovery-and-controls|STEP-03-05 Expose Directory Status Recovery and Controls]] has a stable outcome or handoff.

## Required Reading

- [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Phase|Phase 03 durable directory ingestion and source refresh]]
- [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_06_test-large-tree-refresh-failures-and-recovery/Execution_Brief|Execution Brief]]
- [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_06_test-large-tree-refresh-failures-and-recovery/Validation_Plan|Validation Plan]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[01_Architecture/System_Overview|System Overview]]
- [[01_Architecture/Code_Map|Code Map]]

## Companion Notes

- [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_06_test-large-tree-refresh-failures-and-recovery/Execution_Brief|Execution Brief]] - Why the step exists, prerequisites, likely code paths, and the smallest execution checklist.
- [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_06_test-large-tree-refresh-failures-and-recovery/Validation_Plan|Validation Plan]] - Acceptance checks, commands, edge cases, and regression expectations.
- [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_06_test-large-tree-refresh-failures-and-recovery/Implementation_Notes|Implementation Notes]] - Durable findings discovered while the step is being executed.
- [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_06_test-large-tree-refresh-failures-and-recovery/Outcome|Outcome]] - Final result, validation evidence, and explicit follow-up.

## Agent-Managed Snapshot

<!-- AGENT-START:step-agent-managed-snapshot -->
- Status: completed
- Current owner: Codex
- Last touched: 2026-07-19
- Next action: None. PR #16 merged, Phase 03 is closed, and Phase 04 refinement completed before STEP-04-01 began.
<!-- AGENT-END:step-agent-managed-snapshot -->

## Human Notes

- Keep this step narrow and explicit; planned paths may not exist yet and should be created only when execution begins.

## Session History

<!-- AGENT-START:step-session-history -->
- 2026-07-19 - [[05_Sessions/2026-07-19-151248-test-large-tree-refresh-failures-and-recovery-codex-step-03-06-worker|SESSION-2026-07-19-151248 Codex STEP-03-06 worker session for Test Large-Tree Refresh Failures and Recovery]] - Session created.
<!-- AGENT-END:step-session-history -->

## Related Notes

- [[07_Templates/Note_Contracts|Note Contracts]]
- [[07_Templates/Phase_Template|Phase Template]]
