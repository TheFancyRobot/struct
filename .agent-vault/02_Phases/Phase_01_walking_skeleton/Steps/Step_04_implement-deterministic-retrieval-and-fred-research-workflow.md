---
note_type: step
template_version: 2
contract_version: 1
title: Implement Deterministic Retrieval and Fred Research Workflow
step_id: STEP-01-04
phase: '[[02_Phases/Phase_01_walking_skeleton/Phase|Phase 01 walking skeleton]]'
status: completed
owner: step-01-04-implementor
created: '2026-07-17'
updated: '2026-07-19'
depends_on:
  - '[[02_Phases/Phase_01_walking_skeleton/Steps/Step_03_implement-single-text-source-ingestion-and-artifact-storage|STEP-01-03 Implement Single Text Source Ingestion and Artifact Storage]]'
related_sessions:
  - '[[05_Sessions/2026-07-18-201147-implement-deterministic-retrieval-and-fred-research-workflow-step-01-04-implementor|SESSION-2026-07-18-201147 step-01-04-implementor session for Implement Deterministic Retrieval and Fred Research Workflow]]'
  - '[[05_Sessions/2026-07-19-015307-implement-deterministic-retrieval-and-fred-research-workflow-ingestion-heartbeat-remediation|SESSION-2026-07-19-015307 ingestion-heartbeat-remediation session for Implement Deterministic Retrieval and Fred Research Workflow]]'
  - '[[05_Sessions/2026-07-19-020048-implement-deterministic-retrieval-and-fred-research-workflow-research-ownership-remediator|SESSION-2026-07-19-020048 research-ownership-remediator session for Implement Deterministic Retrieval and Fred Research Workflow]]'
  - '[[05_Sessions/2026-07-19-022106-implement-deterministic-retrieval-and-fred-research-workflow-duckdb-runtime-docs-remediation|SESSION-2026-07-19-022106 duckdb-runtime-docs-remediation session for Implement Deterministic Retrieval and Fred Research Workflow]]'
  - '[[05_Sessions/2026-07-19-022407-implement-deterministic-retrieval-and-fred-research-workflow-step-01-04-reindex-lease-remediation|SESSION-2026-07-19-022407 step-01-04-reindex-lease-remediation session for Implement Deterministic Retrieval and Fred Research Workflow]]'
  - '[[05_Sessions/2026-07-19-025731-implement-deterministic-retrieval-and-fred-research-workflow-step-01-04-ingestion-event-contract-remediation|SESSION-2026-07-19-025731 step-01-04-ingestion-event-contract-remediation session for Implement Deterministic Retrieval and Fred Research Workflow]]'
  - '[[05_Sessions/2026-07-19-025912-implement-deterministic-retrieval-and-fred-research-workflow-step-01-04-research-event-contract-remediation|SESSION-2026-07-19-025912 step-01-04-research-event-contract-remediation session for Implement Deterministic Retrieval and Fred Research Workflow]]'
  - '[[05_Sessions/2026-07-19-030510-implement-deterministic-retrieval-and-fred-research-workflow-step-01-04-ingestion-provenance-metadata-remediation|SESSION-2026-07-19-030510 step-01-04-ingestion-provenance-metadata-remediation session for Implement Deterministic Retrieval and Fred Research Workflow]]'
  - '[[05_Sessions/2026-07-19-030752-implement-deterministic-retrieval-and-fred-research-workflow-step-01-04-event-cursor-commit-order-remediation|SESSION-2026-07-19-030752 step-01-04-event-cursor-commit-order-remediation session for Implement Deterministic Retrieval and Fred Research Workflow]]'
  - '[[05_Sessions/2026-07-19-032025-implement-deterministic-retrieval-and-fred-research-workflow-generic-event-append-remediator|SESSION-2026-07-19-032025 generic-event-append-remediator session for Implement Deterministic Retrieval and Fred Research Workflow]]'
related_bugs:
  - '[[03_Bugs/BUG-0001_research-completion-rejects-serialized-postgresql-jsonb-payloads|BUG-0001 Research completion rejects serialized PostgreSQL JSONB payloads]]'
  - '[[03_Bugs/BUG-0004_source-text-reindex-lacks-continuous-lease-renewal-and-database-clock-recovery|BUG-0004 Source text reindex lacks continuous lease renewal and database clock recovery]]'
  - '[[03_Bugs/BUG-0005_canonical-duckdb-runtime-documentation-contradicts-bun-only-host-boundary|BUG-0005 Canonical DuckDB runtime documentation contradicts Bun only host boundary]]'
  - '[[03_Bugs/BUG-0006_job-transitions-persist-unvalidated-cross-domain-journal-payloads|BUG-0006 Job transitions persist unvalidated cross-domain journal payloads]]'
  - '[[03_Bugs/BUG-0007_event-journal-cursors-can-commit-out-of-replay-order|BUG-0007 Event journal cursors can commit out of replay order]]'
  - '[[03_Bugs/BUG-0008_generic-eventjournal-append-bypasses-typed-transition-contracts|BUG-0008 Generic EventJournal append bypasses typed transition contracts]]'
tags:
  - agent-vault
  - step
context_id: SESSION-2026-07-19-032025
active_session_id: 05_Sessions/2026-07-19-032025-implement-deterministic-retrieval-and-fred-research-workflow-generic-event-append-remediator
context_status: active
context_summary: Advance [[02_Phases/Phase_01_walking_skeleton/Steps/Step_04_implement-deterministic-retrieval-and-fred-research-workflow|STEP-01-04 Implement Deterministic Retrieval and Fred Research Workflow]].
---

# Step 04 - Implement Deterministic Retrieval and Fred Research Workflow

Use this note as a thin index for one executable step. Keep detail in companion notes so execution can load only the smallest note needed.

## Purpose

- Outcome: Implement the smallest coherent slice for Deterministic Retrieval and Fred Research Workflow that advances Walking Skeleton while preserving a single executable walking slice.
- Parent phase: [[02_Phases/Phase_01_walking_skeleton/Phase|Phase 01 walking skeleton]].
- Sequencing: start after [[02_Phases/Phase_01_walking_skeleton/Steps/Step_03_implement-single-text-source-ingestion-and-artifact-storage|STEP-01-03 Implement Single Text Source Ingestion and Artifact Storage]] has a stable outcome or handoff.

## Required Reading

- [[02_Phases/Phase_01_walking_skeleton/Phase|Phase 01 walking skeleton]]
- [[02_Phases/Phase_01_walking_skeleton/Steps/Step_04_implement-deterministic-retrieval-and-fred-research-workflow/Execution_Brief|Execution Brief]]
- [[02_Phases/Phase_01_walking_skeleton/Steps/Step_04_implement-deterministic-retrieval-and-fred-research-workflow/Validation_Plan|Validation Plan]]
- [[01_Architecture/System_Overview|System Overview]]
- [[01_Architecture/Code_Map|Code Map]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]

## Companion Notes

- [[02_Phases/Phase_01_walking_skeleton/Steps/Step_04_implement-deterministic-retrieval-and-fred-research-workflow/Execution_Brief|Execution Brief]] - Why the step exists, prerequisites, likely code paths, and the smallest execution checklist.
- [[02_Phases/Phase_01_walking_skeleton/Steps/Step_04_implement-deterministic-retrieval-and-fred-research-workflow/Validation_Plan|Validation Plan]] - Acceptance checks, commands, edge cases, and regression expectations.
- [[02_Phases/Phase_01_walking_skeleton/Steps/Step_04_implement-deterministic-retrieval-and-fred-research-workflow/Implementation_Notes|Implementation Notes]] - Durable findings discovered while the step is being executed.
- [[02_Phases/Phase_01_walking_skeleton/Steps/Step_04_implement-deterministic-retrieval-and-fred-research-workflow/Outcome|Outcome]] - Final result, validation evidence, and explicit follow-up.

## Agent-Managed Snapshot

<!-- AGENT-START:step-agent-managed-snapshot -->
- Status: completed
- Current owner: step-01-04-implementor
- Last touched: 2026-07-19
- Next action: Root orchestrator publishes the independently reviewed implementation through the remaining PR re-review and merge gates, then advances to STEP-01-05.
<!-- AGENT-END:step-agent-managed-snapshot -->

## Human Notes

- Keep this step narrow and explicit; planned paths may not exist yet and should be created only when execution begins.

## Session History

<!-- AGENT-START:step-session-history -->
- 2026-07-18 - [[05_Sessions/2026-07-18-201147-implement-deterministic-retrieval-and-fred-research-workflow-step-01-04-implementor|SESSION-2026-07-18-201147 step-01-04-implementor session for Implement Deterministic Retrieval and Fred Research Workflow]] - Session created.
- 2026-07-19 - [[05_Sessions/2026-07-19-015307-implement-deterministic-retrieval-and-fred-research-workflow-ingestion-heartbeat-remediation|SESSION-2026-07-19-015307 ingestion-heartbeat-remediation session for Implement Deterministic Retrieval and Fred Research Workflow]] - Session created.
- 2026-07-19 - [[05_Sessions/2026-07-19-020048-implement-deterministic-retrieval-and-fred-research-workflow-research-ownership-remediator|SESSION-2026-07-19-020048 research-ownership-remediator session for Implement Deterministic Retrieval and Fred Research Workflow]] - Session created.
- 2026-07-19 - [[05_Sessions/2026-07-19-022106-implement-deterministic-retrieval-and-fred-research-workflow-duckdb-runtime-docs-remediation|SESSION-2026-07-19-022106 duckdb-runtime-docs-remediation session for Implement Deterministic Retrieval and Fred Research Workflow]] - Session created.
- 2026-07-19 - [[05_Sessions/2026-07-19-022407-implement-deterministic-retrieval-and-fred-research-workflow-step-01-04-reindex-lease-remediation|SESSION-2026-07-19-022407 step-01-04-reindex-lease-remediation session for Implement Deterministic Retrieval and Fred Research Workflow]] - Session created.
- 2026-07-19 - [[05_Sessions/2026-07-19-025731-implement-deterministic-retrieval-and-fred-research-workflow-step-01-04-ingestion-event-contract-remediation|SESSION-2026-07-19-025731 step-01-04-ingestion-event-contract-remediation session for Implement Deterministic Retrieval and Fred Research Workflow]] - Session created.
- 2026-07-19 - [[05_Sessions/2026-07-19-025912-implement-deterministic-retrieval-and-fred-research-workflow-step-01-04-research-event-contract-remediation|SESSION-2026-07-19-025912 step-01-04-research-event-contract-remediation session for Implement Deterministic Retrieval and Fred Research Workflow]] - Session created.
- 2026-07-19 - [[05_Sessions/2026-07-19-030510-implement-deterministic-retrieval-and-fred-research-workflow-step-01-04-ingestion-provenance-metadata-remediation|SESSION-2026-07-19-030510 step-01-04-ingestion-provenance-metadata-remediation session for Implement Deterministic Retrieval and Fred Research Workflow]] - Session created.
- 2026-07-19 - [[05_Sessions/2026-07-19-030752-implement-deterministic-retrieval-and-fred-research-workflow-step-01-04-event-cursor-commit-order-remediation|SESSION-2026-07-19-030752 step-01-04-event-cursor-commit-order-remediation session for Implement Deterministic Retrieval and Fred Research Workflow]] - Session created.
- 2026-07-19 - [[05_Sessions/2026-07-19-032025-implement-deterministic-retrieval-and-fred-research-workflow-generic-event-append-remediator|SESSION-2026-07-19-032025 generic-event-append-remediator session for Implement Deterministic Retrieval and Fred Research Workflow]] - Session created.
<!-- AGENT-END:step-session-history -->
### PR review remediation — bounded retrieval candidate materialization (PRRT_kwDOTcucmc6SCdz4)

- PostgreSQL now deterministically limits highlighted support locations to 24 before `jsonb_agg`, retaining the first and last 12 eligible source lines in source order. Tenant/project/source-version predicates and the original web-search query remain unchanged.
- Highlight decoding and source match collection independently enforce the same 24-location head/tail budget, including high-frequency matches within one long line, so marker arrays cannot grow with source frequency.
- Evidence construction admits at most 80 unique candidates. Non-positional compact AND evidence and local contiguous positional windows precede line/wide fallbacks; every excerpt remains at most 1,200 characters and is still revalidated by PostgreSQL against the original query.
- Added a 600k-character / 100,000-occurrence common-term regression proving at most 80 support-query excerpts and at most 96,000 candidate characters while returning grounded evidence.
- Validation: focused native Bun retrieval 15 passed / 0 failed / 66 assertions; focused real PostgreSQL retrieval + research 31 passed / 0 failed / 144 assertions; root typecheck, root lint, and import-boundary checks passed.

## Related Notes

- [[07_Templates/Note_Contracts|Note Contracts]]
- [[07_Templates/Phase_Template|Phase Template]]
