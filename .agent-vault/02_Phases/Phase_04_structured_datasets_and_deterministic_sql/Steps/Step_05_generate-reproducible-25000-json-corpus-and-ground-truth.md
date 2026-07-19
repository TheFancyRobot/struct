---
note_type: step
template_version: 2
contract_version: 1
title: Generate Reproducible 25000 JSON Corpus and Ground Truth
step_id: STEP-04-05
phase: '[[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Phase|Phase 04 structured datasets and deterministic sql]]'
status: completed
owner: Codex
created: '2026-07-17'
updated: '2026-07-19'
depends_on:
  - '[[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_04_build-deterministic-dataset-query-tools-and-citations|STEP-04-04 Build Deterministic Dataset Query Tools and Citations]]'
related_sessions:
  - '[[05_Sessions/2026-07-19-222127-generate-reproducible-25000-json-corpus-and-ground-truth-codex-step-04-05-worker|SESSION-2026-07-19-222127 codex-step-04-05-worker session for Generate Reproducible 25000 JSON Corpus and Ground Truth]]'
related_bugs: []
tags:
  - agent-vault
  - step
context_id: SESSION-2026-07-19-222127
active_session_id: 05_Sessions/2026-07-19-222127-generate-reproducible-25000-json-corpus-and-ground-truth-codex-step-04-05-worker
context_status: completed
context_summary: 'STEP-04-05 merged through PR #23 at merge commit ca9514a after two full reproducibility runs, 472 passing tests, completed automatic reviews, and zero unresolved threads.'
---

# Step 05 - Generate Reproducible 25000 JSON Corpus and Ground Truth

Use this note as a thin index for one executable step. Keep detail in companion notes so execution can load only the smallest note needed.

## Purpose

- Outcome: Implement the smallest coherent slice for Reproducible 25000 JSON Corpus and Ground Truth that advances Structured Datasets and Deterministic SQL while preserving exact, reproducible computation with stable dataset citations.
- Parent phase: [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Phase|Phase 04 structured datasets and deterministic sql]].
- Sequencing: start after [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_04_build-deterministic-dataset-query-tools-and-citations|STEP-04-04 Build Deterministic Dataset Query Tools and Citations]] has a stable outcome or handoff.

## Required Reading

- [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Phase|Phase 04 structured datasets and deterministic sql]]
- [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_05_generate-reproducible-25000-json-corpus-and-ground-truth/Execution_Brief|Execution Brief]]
- [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_05_generate-reproducible-25000-json-corpus-and-ground-truth/Validation_Plan|Validation Plan]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
- [[01_Architecture/System_Overview|System Overview]]

## Companion Notes

- [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_05_generate-reproducible-25000-json-corpus-and-ground-truth/Execution_Brief|Execution Brief]] - Why the step exists, prerequisites, likely code paths, and the smallest execution checklist.
- [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_05_generate-reproducible-25000-json-corpus-and-ground-truth/Validation_Plan|Validation Plan]] - Acceptance checks, commands, edge cases, and regression expectations.
- [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_05_generate-reproducible-25000-json-corpus-and-ground-truth/Implementation_Notes|Implementation Notes]] - Durable findings discovered while the step is being executed.
- [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_05_generate-reproducible-25000-json-corpus-and-ground-truth/Outcome|Outcome]] - Final result, validation evidence, and explicit follow-up.

## Agent-Managed Snapshot

<!-- AGENT-START:step-agent-managed-snapshot -->
- Status: completed
- Current owner: Codex
- Last touched: 2026-07-19
- Next action: Use the merged corpus and ground truth as the verified input to STEP-04-06.
<!-- AGENT-END:step-agent-managed-snapshot -->

## Human Notes

- Keep this step narrow and explicit; planned paths may not exist yet and should be created only when execution begins.

## Session History

<!-- AGENT-START:step-session-history -->
- 2026-07-19 - [[05_Sessions/2026-07-19-222127-generate-reproducible-25000-json-corpus-and-ground-truth-codex-step-04-05-worker|SESSION-2026-07-19-222127 codex-step-04-05-worker session for Generate Reproducible 25000 JSON Corpus and Ground Truth]] - Session created.
<!-- AGENT-END:step-session-history -->

## Related Notes

- [[07_Templates/Note_Contracts|Note Contracts]]
- [[07_Templates/Phase_Template|Phase Template]]
