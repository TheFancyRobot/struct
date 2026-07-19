---
note_type: step
template_version: 2
contract_version: 1
title: Implement Single Text Source Ingestion and Artifact Storage
step_id: STEP-01-03
phase: '[[02_Phases/Phase_01_walking_skeleton/Phase|Phase 01 walking skeleton]]'
status: completed
owner: step-01-03-recovery2-implementor
created: '2026-07-17'
updated: '2026-07-19'
depends_on:
  - '[[02_Phases/Phase_01_walking_skeleton/Steps/Step_02_define-core-domain-schemas-and-persistence-migrations|STEP-01-02 Define Core Domain Schemas and Persistence Migrations]]'
related_sessions:
  - '[[05_Sessions/2026-07-18-165219-implement-single-text-source-ingestion-and-artifact-storage-step-01-03-implementor|SESSION-2026-07-18-165219 step-01-03-implementor session for Implement Single Text Source Ingestion and Artifact Storage]]'
  - '[[05_Sessions/2026-07-18-193554-implement-single-text-source-ingestion-and-artifact-storage-step-01-03-review-remediation|SESSION-2026-07-18-193554 step-01-03-review-remediation session for Implement Single Text Source Ingestion and Artifact Storage]]'
  - '[[05_Sessions/2026-07-19-020940-implement-single-text-source-ingestion-and-artifact-storage-ingestion-transition-remediator|SESSION-2026-07-19-020940 ingestion-transition-remediator session for Implement Single Text Source Ingestion and Artifact Storage]]'
  - '[[05_Sessions/2026-07-19-021959-implement-single-text-source-ingestion-and-artifact-storage-source-registration-remediator|SESSION-2026-07-19-021959 source-registration-remediator session for Implement Single Text Source Ingestion and Artifact Storage]]'
  - '[[05_Sessions/2026-07-19-031251-implement-single-text-source-ingestion-and-artifact-storage-ingestion-retryability-remediator|SESSION-2026-07-19-031251 ingestion-retryability-remediator session for Implement Single Text Source Ingestion and Artifact Storage]]'
  - '[[05_Sessions/2026-07-19-032516-implement-single-text-source-ingestion-and-artifact-storage-step-01-04-registration-payload-leak-remediation|SESSION-2026-07-19-032516 step-01-04-registration-payload-leak-remediation session for Implement Single Text Source Ingestion and Artifact Storage]]'
related_bugs:
  - '[[03_Bugs/BUG-0002_sourceversion-ingestion-attempt-accepts-forged-aggregate-scope|BUG-0002 SourceVersion ingestion attempt accepts forged aggregate scope]]'
  - '[[03_Bugs/BUG-0003_source-registration-persists-unauthorized-mismatched-aggregate-scope|BUG-0003 Source registration persists unauthorized mismatched aggregate scope]]'
  - '[[03_Bugs/BUG-0009_source-registration-persists-extra-sensitive-payload-fields|BUG-0009 Source registration persists extra sensitive payload fields]]'
tags:
  - agent-vault
  - step
context_id: SESSION-2026-07-19-032516
active_session_id: 05_Sessions/2026-07-19-032516-implement-single-text-source-ingestion-and-artifact-storage-step-01-04-registration-payload-leak-remediation
context_status: active
context_summary: Advance [[02_Phases/Phase_01_walking_skeleton/Steps/Step_03_implement-single-text-source-ingestion-and-artifact-storage|STEP-01-03 Implement Single Text Source Ingestion and Artifact Storage]].
---

# Step 03 - Implement Single Text Source Ingestion and Artifact Storage

Use this note as a thin index for one executable step. Keep detail in companion notes so execution can load only the smallest note needed.

## Purpose

- Outcome: Implement the smallest coherent slice for Single Text Source Ingestion and Artifact Storage that advances Walking Skeleton while preserving a single executable walking slice.
- Parent phase: [[02_Phases/Phase_01_walking_skeleton/Phase|Phase 01 walking skeleton]].
- Sequencing: start after [[02_Phases/Phase_01_walking_skeleton/Steps/Step_02_define-core-domain-schemas-and-persistence-migrations|STEP-01-02 Define Core Domain Schemas and Persistence Migrations]] has a stable outcome or handoff.

## Required Reading

- [[02_Phases/Phase_01_walking_skeleton/Phase|Phase 01 walking skeleton]]
- [[02_Phases/Phase_01_walking_skeleton/Steps/Step_03_implement-single-text-source-ingestion-and-artifact-storage/Execution_Brief|Execution Brief]]
- [[02_Phases/Phase_01_walking_skeleton/Steps/Step_03_implement-single-text-source-ingestion-and-artifact-storage/Validation_Plan|Validation Plan]]
- [[02_Phases/Phase_01_walking_skeleton/Steps/Step_02_define-core-domain-schemas-and-persistence-migrations/Outcome|STEP-01-02 Outcome]]
- [[01_Architecture/System_Overview|System Overview]]
- [[01_Architecture/Code_Map|Code Map]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[01_Architecture/Integration_Map|Integration Map]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
- [[04_Decisions/DEC-0006_make-source-versions-immutable-and-provenance-typed|DEC-0006 Make Source Versions Immutable and Provenance Typed]]
- [[04_Decisions/DEC-0009_sandbox-filesystem-roots-and-allowlist-read-only-sql|DEC-0009 Sandbox Filesystem Roots and Allowlist Read-Only SQL]]

## Companion Notes

- [[02_Phases/Phase_01_walking_skeleton/Steps/Step_03_implement-single-text-source-ingestion-and-artifact-storage/Execution_Brief|Execution Brief]] - Why the step exists, prerequisites, likely code paths, and the smallest execution checklist.
- [[02_Phases/Phase_01_walking_skeleton/Steps/Step_03_implement-single-text-source-ingestion-and-artifact-storage/Validation_Plan|Validation Plan]] - Acceptance checks, commands, edge cases, and regression expectations.
- [[02_Phases/Phase_01_walking_skeleton/Steps/Step_03_implement-single-text-source-ingestion-and-artifact-storage/Implementation_Notes|Implementation Notes]] - Durable findings discovered while the step is being executed.
- [[02_Phases/Phase_01_walking_skeleton/Steps/Step_03_implement-single-text-source-ingestion-and-artifact-storage/Outcome|Outcome]] - Final result, validation evidence, and explicit follow-up.

## Agent-Managed Snapshot

<!-- AGENT-START:step-agent-managed-snapshot -->
- Status: completed
- Current owner: step-01-03-recovery2-implementor
- Last touched: 2026-07-18
- Next action: Proceed to STEP-01-04 only after review/approval. STEP-01-03 leaves stable retrieval boundaries: immutable SourceVersion id/contentHash/manifest ref, normalized text artifact ref, event cursors, and completed/failed job state.
<!-- AGENT-END:step-agent-managed-snapshot -->

## Human Notes

- Keep this step narrow and explicit; planned paths may not exist yet and should be created only when execution begins.

## Session History

<!-- AGENT-START:step-session-history -->
- 2026-07-18 - [[05_Sessions/2026-07-18-165219-implement-single-text-source-ingestion-and-artifact-storage-step-01-03-implementor|SESSION-2026-07-18-165219 step-01-03-implementor session for Implement Single Text Source Ingestion and Artifact Storage]] - Completed STEP-01-03 implementation and validation.
- 2026-07-18 - [[05_Sessions/2026-07-18-193554-implement-single-text-source-ingestion-and-artifact-storage-step-01-03-review-remediation|SESSION-2026-07-18-193554 step-01-03-review-remediation session for Implement Single Text Source Ingestion and Artifact Storage]] - Session created.
- 2026-07-19 - [[05_Sessions/2026-07-19-020940-implement-single-text-source-ingestion-and-artifact-storage-ingestion-transition-remediator|SESSION-2026-07-19-020940 ingestion-transition-remediator session for Implement Single Text Source Ingestion and Artifact Storage]] - Session created.
- 2026-07-19 - [[05_Sessions/2026-07-19-021959-implement-single-text-source-ingestion-and-artifact-storage-source-registration-remediator|SESSION-2026-07-19-021959 source-registration-remediator session for Implement Single Text Source Ingestion and Artifact Storage]] - Session created.
- 2026-07-19 - [[05_Sessions/2026-07-19-031251-implement-single-text-source-ingestion-and-artifact-storage-ingestion-retryability-remediator|SESSION-2026-07-19-031251 ingestion-retryability-remediator session for Implement Single Text Source Ingestion and Artifact Storage]] - Session created.
- 2026-07-19 - [[05_Sessions/2026-07-19-032516-implement-single-text-source-ingestion-and-artifact-storage-step-01-04-registration-payload-leak-remediation|SESSION-2026-07-19-032516 step-01-04-registration-payload-leak-remediation session for Implement Single Text Source Ingestion and Artifact Storage]] - Session created.
<!-- AGENT-END:step-session-history -->

## Related Notes

- [[07_Templates/Note_Contracts|Note Contracts]]
- [[07_Templates/Phase_Template|Phase Template]]
- Bug: [[03_Bugs/BUG-0006_job-transitions-persist-unvalidated-cross-domain-journal-payloads|BUG-0006 Job transitions persist unvalidated cross-domain journal payloads]]
- Session: [[05_Sessions/2026-07-19-031251-implement-single-text-source-ingestion-and-artifact-storage-ingestion-retryability-remediator|SESSION-2026-07-19-031251 ingestion retryability remediator]]
