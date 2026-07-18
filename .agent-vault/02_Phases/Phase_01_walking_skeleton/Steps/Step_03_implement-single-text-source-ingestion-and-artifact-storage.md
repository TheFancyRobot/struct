---
note_type: step
template_version: 2
contract_version: 1
title: Implement Single Text Source Ingestion and Artifact Storage
step_id: STEP-01-03
phase: '[[02_Phases/Phase_01_walking_skeleton/Phase|Phase 01 walking skeleton]]'
status: planned
owner: ''
created: '2026-07-17'
updated: '2026-07-18'
depends_on:
  - '[[02_Phases/Phase_01_walking_skeleton/Steps/Step_02_define-core-domain-schemas-and-persistence-migrations|STEP-01-02 Define Core Domain Schemas and Persistence Migrations]]'
related_sessions: []
related_bugs: []
tags:
  - agent-vault
  - step
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
- Status: planned
- Current owner:
- Last touched: 2026-07-18
- Next action: Begin implementation only after confirming STEP-01-02 remains green, then follow the refined Execution Brief and Validation Plan. The first bounded change is to add typed storage/ingestion/job contracts against the existing STEP-01-02 schema; do not create new migrations or bypass the job_queue handoff unless a confirmed blocker is recorded.
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
