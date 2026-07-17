---
note_type: step
template_version: 2
contract_version: 1
title: Define Dataset Assets Schemas and Versioned Catalog
step_id: STEP-04-01
phase: '[[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Phase|Phase 04 structured datasets and deterministic sql]]'
status: planned
owner: ''
created: '2026-07-17'
updated: '2026-07-17'
depends_on:
  - '[[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_06_test-large-tree-refresh-failures-and-recovery|STEP-03-06 Test Large-Tree Refresh Failures and Recovery]]'
related_sessions: []
related_bugs: []
tags:
  - agent-vault
  - step
---

# Step 01 - Define Dataset Assets Schemas and Versioned Catalog

Use this note as a thin index for one executable step. Keep detail in companion notes so execution can load only the smallest note needed.

## Purpose

- Outcome: Define the smallest stable contract for Dataset Assets Schemas and Versioned Catalog so later implementation can proceed without reopening boundaries around exact, reproducible computation with stable dataset citations.
- Parent phase: [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Phase|Phase 04 structured datasets and deterministic sql]].
- Sequencing: start after [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_06_test-large-tree-refresh-failures-and-recovery|STEP-03-06 Test Large-Tree Refresh Failures and Recovery]] has a stable outcome or handoff.

## Required Reading

- [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Phase|Phase 04 structured datasets and deterministic sql]]
- [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_01_define-dataset-assets-schemas-and-versioned-catalog/Execution_Brief|Execution Brief]]
- [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_01_define-dataset-assets-schemas-and-versioned-catalog/Validation_Plan|Validation Plan]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
- [[01_Architecture/System_Overview|System Overview]]

## Companion Notes

- [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_01_define-dataset-assets-schemas-and-versioned-catalog/Execution_Brief|Execution Brief]] - Why the step exists, prerequisites, likely code paths, and the smallest execution checklist.
- [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_01_define-dataset-assets-schemas-and-versioned-catalog/Validation_Plan|Validation Plan]] - Acceptance checks, commands, edge cases, and regression expectations.
- [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_01_define-dataset-assets-schemas-and-versioned-catalog/Implementation_Notes|Implementation Notes]] - Durable findings discovered while the step is being executed.
- [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_01_define-dataset-assets-schemas-and-versioned-catalog/Outcome|Outcome]] - Final result, validation evidence, and explicit follow-up.

## Agent-Managed Snapshot

<!-- AGENT-START:step-agent-managed-snapshot -->
- Status: planned
- Current owner: 
- Last touched: 2026-07-17
- Next action: Read [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_01_define-dataset-assets-schemas-and-versioned-catalog/Execution_Brief|Execution Brief]] and [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_01_define-dataset-assets-schemas-and-versioned-catalog/Validation_Plan|Validation Plan]], then confirm the first bounded change against the dependency chain.
<!-- AGENT-END:step-agent-managed-snapshot -->

## Human Notes

- Keep this step narrow and explicit; planned paths may not exist yet and should be created only when execution begins.

## Session History

<!-- AGENT-START:step-session-history -->
- No sessions yet.
<!-- AGENT-END:step-session-history -->

## Related Notes

- [[07_Templates/Note_Contracts|Note Contracts]]
- [[07_Templates/Phase_Template|Phase Template]]
