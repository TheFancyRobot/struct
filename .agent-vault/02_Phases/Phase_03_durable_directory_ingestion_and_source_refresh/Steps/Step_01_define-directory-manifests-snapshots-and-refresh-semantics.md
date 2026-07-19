---
note_type: step
template_version: 2
contract_version: 1
title: Define Directory Manifests Snapshots and Refresh Semantics
step_id: STEP-03-01
phase: '[[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Phase|Phase 03 durable directory ingestion and source refresh]]'
status: completed
owner: Codex
created: '2026-07-17'
updated: '2026-07-19'
depends_on:
  - '[[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Steps/Step_06_evaluate-retrieval-provenance-and-injection-resistance|STEP-02-06 Evaluate Retrieval Provenance and Injection Resistance]]'
related_sessions:
  - '[[05_Sessions/2026-07-19-114115-define-directory-manifests-snapshots-and-refresh-semantics-phase-03-refinement|SESSION-2026-07-19-114115 phase-03-refinement session for Define Directory Manifests Snapshots and Refresh Semantics]]'
  - '[[05_Sessions/2026-07-19-120741-define-directory-manifests-snapshots-and-refresh-semantics-codex-step-03-01-worker|SESSION-2026-07-19-120741 Codex STEP-03-01 worker session for Define Directory Manifests Snapshots and Refresh Semantics]]'
related_bugs: []
tags:
  - agent-vault
  - step
context_id: SESSION-2026-07-19-120741
active_session_id: 05_Sessions/2026-07-19-120741-define-directory-manifests-snapshots-and-refresh-semantics-codex-step-03-01-worker
context_status: completed
context_summary: STEP-03-01 implemented branded directory manifest/snapshot contracts, deterministic digest and refresh semantics, immutable source-version lineage, documentation, and focused tests; all repository gates passed.
---

# Step 01 - Define Directory Manifests Snapshots and Refresh Semantics

Use this note as a thin index for one executable step. Keep detail in companion notes so execution can load only the smallest note needed.

## Purpose

- Outcome: Define the smallest stable contract for Directory Manifests Snapshots and Refresh Semantics so later implementation can proceed without reopening boundaries around sandboxed, resumable ingestion without per-file model calls.
- Parent phase: [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Phase|Phase 03 durable directory ingestion and source refresh]].
- Sequencing: start only after merged [[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Steps/Step_06_evaluate-retrieval-provenance-and-injection-resistance|STEP-02-06 Evaluate Retrieval Provenance and Injection Resistance]] and the Phase 03 refinement PR.

## Required Reading

- [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Phase|Phase 03 durable directory ingestion and source refresh]]
- [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_01_define-directory-manifests-snapshots-and-refresh-semantics/Execution_Brief|Execution Brief]]
- [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_01_define-directory-manifests-snapshots-and-refresh-semantics/Validation_Plan|Validation Plan]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[01_Architecture/System_Overview|System Overview]]
- [[01_Architecture/Code_Map|Code Map]]

## Companion Notes

- [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_01_define-directory-manifests-snapshots-and-refresh-semantics/Execution_Brief|Execution Brief]] - Why the step exists, prerequisites, likely code paths, and the smallest execution checklist.
- [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_01_define-directory-manifests-snapshots-and-refresh-semantics/Validation_Plan|Validation Plan]] - Acceptance checks, commands, edge cases, and regression expectations.
- [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_01_define-directory-manifests-snapshots-and-refresh-semantics/Implementation_Notes|Implementation Notes]] - Durable findings discovered while the step is being executed.
- [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_01_define-directory-manifests-snapshots-and-refresh-semantics/Outcome|Outcome]] - Final result, validation evidence, and explicit follow-up.

## Agent-Managed Snapshot

<!-- AGENT-START:step-agent-managed-snapshot -->
- Status: completed
- Current owner: Codex
- Last touched: 2026-07-19
- Next action: Root orchestrator independently validates, publishes, and merges STEP-03-01 before STEP-03-02 begins.
<!-- AGENT-END:step-agent-managed-snapshot -->

## Human Notes

- Keep this step narrow and explicit; planned paths may not exist yet and should be created only when execution begins.

## Session History

<!-- AGENT-START:step-session-history -->
- 2026-07-19 - [[05_Sessions/2026-07-19-114115-define-directory-manifests-snapshots-and-refresh-semantics-phase-03-refinement|SESSION-2026-07-19-114115 phase-03-refinement session for Define Directory Manifests Snapshots and Refresh Semantics]] - Session created.
- 2026-07-19 - [[05_Sessions/2026-07-19-120741-define-directory-manifests-snapshots-and-refresh-semantics-codex-step-03-01-worker|SESSION-2026-07-19-120741 Codex STEP-03-01 worker session for Define Directory Manifests Snapshots and Refresh Semantics]] - Session created.
<!-- AGENT-END:step-session-history -->

## Related Notes

- [[07_Templates/Note_Contracts|Note Contracts]]
- [[07_Templates/Phase_Template|Phase Template]]
