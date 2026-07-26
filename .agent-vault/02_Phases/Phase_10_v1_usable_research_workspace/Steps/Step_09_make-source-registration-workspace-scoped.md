---
note_type: step
template_version: 2
contract_version: 1
title: Make Source Registration Workspace Scoped
step_id: STEP-10-09
phase: '[[02_Phases/Phase_10_v1_usable_research_workspace/Phase|Phase 10 v1 usable research workspace]]'
status: completed
owner: openai-codex/gpt-5.6-sol
created: '2026-07-26'
updated: '2026-07-26'
depends_on: '- ''[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_08_gate-v1-on-the-complete-browser-journey|STEP-10-08 Gate v1 on the Complete Browser Journey]]'''
related_sessions: []
related_bugs: '- ''[[03_Bugs/BUG-0046_global-source-import-is-blocked-by-project-selection|BUG-0046 Global source import is blocked by project selection]]'''
tags:
  - agent-vault
  - step
---

# Step 09 - Make Source Registration Workspace Scoped

Use this note as a thin index for one executable step. Keep detail in companion notes so execution can load only the smallest note needed.

## Purpose

- Outcome: Make Source Registration Workspace Scoped.
- Parent phase: [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|Phase 10 v1 usable research workspace]].

## Required Reading

- [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|Phase 10 v1 usable research workspace]]
- [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_09_make-source-registration-workspace-scoped/Execution_Brief|Execution Brief]]
- [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_09_make-source-registration-workspace-scoped/Validation_Plan|Validation Plan]]
- [[01_Architecture/System_Overview|System Overview]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[01_Architecture/Integration_Map|Integration Map]]
- [[04_Decisions/DEC-0006_make-source-versions-immutable-and-provenance-typed|DEC-0006 Make Source Versions Immutable and Provenance Typed]]
- [[04_Decisions/DEC-0008_own-the-typed-api-and-live-research-event-stream|DEC-0008 Own the Typed API and Live Research Event Stream]]
- [[04_Decisions/DEC-0009_sandbox-filesystem-roots-and-allowlist-read-only-sql|DEC-0009 Sandbox Filesystem Roots and Allowlist Read-Only SQL]]
- [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_03_deliver-source-catalog-and-non-blocking-import|STEP-10-03 Deliver Source Catalog and Non-Blocking Import]]
- [[03_Bugs/BUG-0045_sources-are-scoped-to-one-project-and-cannot-be-reused|BUG-0045 Sources are scoped to one project and cannot be reused]]
- [[03_Bugs/BUG-0046_global-source-import-is-blocked-by-project-selection|BUG-0046 Global source import is blocked by project selection]]

## Companion Notes

- [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_09_make-source-registration-workspace-scoped/Execution_Brief|Execution Brief]] - Why the step exists, prerequisites, likely code paths, and the smallest execution checklist.
- [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_09_make-source-registration-workspace-scoped/Validation_Plan|Validation Plan]] - Acceptance checks, commands, edge cases, and regression expectations.
- [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_09_make-source-registration-workspace-scoped/Implementation_Notes|Implementation Notes]] - Durable findings discovered while the step is being executed.
- [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_09_make-source-registration-workspace-scoped/Outcome|Outcome]] - Final result, validation evidence, and explicit follow-up.

## Agent-Managed Snapshot

<!-- AGENT-START:step-agent-managed-snapshot -->
- Status: completed
- Current owner: openai-codex/gpt-5.6-sol
- Last touched: 2026-07-26
- Next action: Await the remaining BUG-0047 remediation before Phase 10 can advance.
<!-- AGENT-END:step-agent-managed-snapshot -->

## Human Notes

- Put judgment calls or cautions here.

## Session History

<!-- AGENT-START:step-session-history -->
- 2026-07-26 — Completed workspace-scoped source registration and closed BUG-0046. The greenfield database was recreated, all 22 migrations applied, and the full suite passed: 989 passed, 3 skipped, 0 failed.
<!-- AGENT-END:step-session-history -->
- 2026-07-26 — Implemented workspace-library browser imports at `POST /api/sources`, optional project attachment, library-mode attachment controls, and scoped idempotency hashing. Added focused web/API regressions. Validation: 14 focused tests passed; full typecheck passed; ESLint passed.
- 2026-07-26 — Full suite: 985 passed, 3 skipped, 4 failed. Failures were in research replay/data-engine artifact lookup and three dataset persistence suites. STEP-10-09 remains in-progress under the zero-defect gate pending root-orchestrator triage/remediation.
- 2026-07-26 — Attempt 3 diagnosed the 43-failure run as two environment/schema issues plus one STEP-10-09 migration regression. The local database had 0022 schema effects without an `_migrations` record and a stale 0021 checksum, so the greenfield test database was dropped, recreated, and migrated cleanly. Migration 0022 now preserves automatic `project_sources` attachment for non-null origin projects while allowing workspace-only sources, and its down migration restores the unconditional function with `CREATE OR REPLACE` without duplicating the retained trigger. The data-engine containers were recreated to replace a stale `.local/artifacts_recovery_test` mount with `.local/artifacts`. Validation: migration integration subset 8 passed/0 failed; research replay 1 passed/0 failed; full suite 989 passed/3 skipped/0 failed (992 tests).
- 2026-07-26 — Review remediation forced project-route attachment, made unattached datasets emit only source-version completion events, guarded irreversible rollback, and disambiguated legacy workspace batch IDs. Validation: 990 passed, 3 skipped, 0 failed; typecheck, lint, migration tests, and vault validation passed.

## Related Notes

- [[07_Templates/Note_Contracts|Note Contracts]]
- [[07_Templates/Phase_Template|Phase Template]]
