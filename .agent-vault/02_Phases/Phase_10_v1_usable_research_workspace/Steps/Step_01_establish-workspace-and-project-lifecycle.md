---
note_type: step
template_version: 2
contract_version: 1
title: Establish Workspace and Project Lifecycle
step_id: STEP-10-01
phase: '[[02_Phases/Phase_10_v1_usable_research_workspace/Phase|Phase 10 v1 usable research workspace]]'
status: planned
owner: ''
created: '2026-07-21'
updated: '2026-07-23'
depends_on:
  - '[[02_Phases/Phase_09_v1_production_hardening_and_release/Steps/Step_06_publish-v1-documentation-accessibility-and-release-checklist|STEP-09-06 Publish v1 Documentation Accessibility and Release Checklist]]'
related_sessions:
  - '[[05_Sessions/2026-07-21-230129-establish-workspace-and-project-lifecycle-codex|SESSION-2026-07-21-230129 Codex session for Establish Workspace and Project Lifecycle]]'
  - '[[05_Sessions/2026-07-23-044455-establish-workspace-and-project-lifecycle-codex|SESSION-2026-07-23-044455 Codex session for Establish Workspace and Project Lifecycle]]'
related_bugs:
  - '[[03_Bugs/BUG-0013_v1-ui-lacks-core-research-workflows|BUG-0013 v1 UI lacks core research workflows]]'
  - '[[03_Bugs/BUG-0018_vite-proxy-regression-test-does-not-typecheck|BUG-0018 Vite proxy regression test does not typecheck]]'
tags:
  - agent-vault
  - step
context_id: SESSION-2026-07-23-044455
active_session_id: 05_Sessions/2026-07-23-044455-establish-workspace-and-project-lifecycle-codex
context_status: active
context_summary: Advance [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_01_establish-workspace-and-project-lifecycle|STEP-10-01 Establish Workspace and Project Lifecycle]].
---

# Step 01 - Establish Workspace and Project Lifecycle

Use this note as a thin index for one executable step. Keep detail in companion notes so execution can load only the smallest note needed.

## Purpose

- Outcome: Establish Workspace and Project Lifecycle.
- Parent phase: [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|Phase 10 v1 usable research workspace]].
- Exact outcome: an authenticated new browser session can list, create, select, deep-link, reload, and reopen a project without manually supplied workspace or project IDs.

## Required Reading

- [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|Phase 10 v1 usable research workspace]]
- [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_01_establish-workspace-and-project-lifecycle/Execution_Brief|Execution Brief]]
- [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_01_establish-workspace-and-project-lifecycle/Validation_Plan|Validation Plan]]
- `docs/superpowers/specs/2026-07-21-unified-research-workspace-design.md`
- `docs/superpowers/plans/2026-07-21-unified-research-workspace-implementation.md`
- [[03_Bugs/BUG-0013_v1-ui-lacks-core-research-workflows|BUG-0013 v1 UI lacks core research workflows]]
- [[01_Architecture/System_Overview|System Overview]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[01_Architecture/Integration_Map|Integration Map]]

## Companion Notes

- [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_01_establish-workspace-and-project-lifecycle/Execution_Brief|Execution Brief]] - Why the step exists, prerequisites, likely code paths, and the smallest execution checklist.
- [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_01_establish-workspace-and-project-lifecycle/Validation_Plan|Validation Plan]] - Acceptance checks, commands, edge cases, and regression expectations.
- [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_01_establish-workspace-and-project-lifecycle/Implementation_Notes|Implementation Notes]] - Durable findings discovered while the step is being executed.
- [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_01_establish-workspace-and-project-lifecycle/Outcome|Outcome]] - Final result, validation evidence, and explicit follow-up.

## Agent-Managed Snapshot

<!-- AGENT-START:step-agent-managed-snapshot -->
- Status: planned
- Current owner:
- Last touched: 2026-07-21
- Next action: Do not start this roadmap step while BUG-0013 remains confirmed; use its brief and validation plan only as technical reference for a tracked bug-remediation unit.
<!-- AGENT-END:step-agent-managed-snapshot -->

## Human Notes

- Refinement passed on 2026-07-21. Follow the companion execution/validation contracts; do not reintroduce browser-supplied workspace identifiers.

## Session History

<!-- AGENT-START:step-session-history -->
- 2026-07-21 - [[05_Sessions/2026-07-21-230129-establish-workspace-and-project-lifecycle-codex|SESSION-2026-07-21-230129 Codex session for Establish Workspace and Project Lifecycle]] - Session created.
- 2026-07-23 - [[05_Sessions/2026-07-23-044455-establish-workspace-and-project-lifecycle-codex|SESSION-2026-07-23-044455 Codex session for Establish Workspace and Project Lifecycle]] - Session created.
<!-- AGENT-END:step-session-history -->

## Related Notes

- [[07_Templates/Note_Contracts|Note Contracts]]
- [[07_Templates/Phase_Template|Phase Template]]
