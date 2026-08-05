---
note_type: step
template_version: 2
contract_version: 1
title: Build Unified Three Pane Workspace Shell
step_id: STEP-10-02
phase: '[[02_Phases/Phase_10_v1_usable_research_workspace/Phase|Phase 10 v1 usable research workspace]]'
status: completed
owner: phase10-step02-attempt1
created: '2026-07-21'
updated: '2026-08-05'
depends_on:
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_01_establish-workspace-and-project-lifecycle|STEP-10-01 Establish Workspace and Project Lifecycle]]'
related_sessions:
  - '[[05_Sessions/2026-07-23-124442-build-unified-three-pane-workspace-shell-openai-codex-gpt-5-4|SESSION-2026-07-23-124442 BUG-0013 workspace-shell remediation session]]'
related_bugs:
  - '[[03_Bugs/BUG-0013_v1-ui-lacks-core-research-workflows|BUG-0013 v1 UI lacks core research workflows]]'
  - '[[03_Bugs/BUG-0042_center-workspace-is-fragmented-by-redundant-title-chrome-and-card-framing|BUG-0042 Center workspace is fragmented by redundant title chrome and card framing]]'
  - '[[03_Bugs/BUG-0043_workspace-navigation-lacks-project-source-and-recent-discovery-sections|BUG-0043 Workspace navigation lacks project, source, and recent discovery sections]]'
  - '[[03_Bugs/BUG-0044_navigation-discovery-sections-lack-direct-creation-actions|BUG-0044 Navigation discovery sections lack direct creation actions]]'
  - '[[03_Bugs/BUG-0119_project-navigation-is-over-spaced-and-lacks-discoverable-search-and-settings|BUG-0119 Project navigation is over-spaced and lacks discoverable search and settings]]'
tags:
  - agent-vault
  - step
context_id: SESSION-2026-07-23-124442
active_session_id: 05_Sessions/2026-07-23-124442-build-unified-three-pane-workspace-shell-openai-codex-gpt-5-4
context_status: completed
context_summary: Verified the existing unified workspace shell end to end and preserved the Evidence complementary landmark while exact citation detail is selected.
---

# Step 02 - Build Unified Three Pane Workspace Shell

Use this note as a thin index for one executable step. Keep detail in companion notes so execution can load only the smallest note needed.

## Purpose

- Outcome: Build Unified Three Pane Workspace Shell.
- Parent phase: [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|Phase 10 v1 usable research workspace]].
- Exact outcome: the approved full-viewport LTR workspace replaces the drawer/navbar/breadcrumb/logo/editorial nesting while preserving project state and accessible navigation.

## Required Reading

- [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|Phase 10 v1 usable research workspace]]
- [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_02_build-unified-three-pane-workspace-shell/Execution_Brief|Execution Brief]]
- [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_02_build-unified-three-pane-workspace-shell/Validation_Plan|Validation Plan]]
- `docs/superpowers/specs/2026-07-21-unified-research-workspace-design.md`
- `docs/superpowers/plans/2026-07-21-unified-research-workspace-implementation.md`
- [[03_Bugs/BUG-0013_v1-ui-lacks-core-research-workflows|BUG-0013 v1 UI lacks core research workflows]]
- [[01_Architecture/System_Overview|System Overview]]
- [[01_Architecture/Integration_Map|Integration Map]]

## Companion Notes

- [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_02_build-unified-three-pane-workspace-shell/Execution_Brief|Execution Brief]] - Why the step exists, prerequisites, likely code paths, and the smallest execution checklist.
- [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_02_build-unified-three-pane-workspace-shell/Validation_Plan|Validation Plan]] - Acceptance checks, commands, edge cases, and regression expectations.
- [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_02_build-unified-three-pane-workspace-shell/Implementation_Notes|Implementation Notes]] - Durable findings discovered while the step is being executed.
- [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_02_build-unified-three-pane-workspace-shell/Outcome|Outcome]] - Final result, validation evidence, and explicit follow-up.

## Agent-Managed Snapshot

<!-- AGENT-START:step-agent-managed-snapshot -->
- Status: planned
- Current owner:
- Last touched: 2026-07-21
- Next action: Read [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_02_build-unified-three-pane-workspace-shell/Execution_Brief|Execution Brief]] and [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_02_build-unified-three-pane-workspace-shell/Validation_Plan|Validation Plan]].
<!-- AGENT-END:step-agent-managed-snapshot -->

## Human Notes

- Refinement passed on 2026-07-21. Keep this slice shell-only and preserve project-scoped center state while later slices fill the panes.

## Session History

<!-- AGENT-START:step-session-history -->
- 2026-07-23 - [[05_Sessions/2026-07-23-124442-build-unified-three-pane-workspace-shell-openai-codex-gpt-5-4|SESSION-2026-07-23-124442 BUG-0013 workspace-shell remediation session]] - Completed BUG-0013 remediation using this step only as technical reference; roadmap status remains planned.
<!-- AGENT-END:step-session-history -->
- 2026-07-26 — Completion verification reused the existing responsive shell/provider, corrected the selected-evidence complementary landmark in `WorkspaceShell.tsx`, added regression coverage to the existing walking-skeleton citation journey, and passed focused plus repository-wide gates. See [[05_Sessions/2026-07-23-124442-build-unified-three-pane-workspace-shell-openai-codex-gpt-5-4|SESSION-2026-07-23-124442 BUG-0013 workspace-shell remediation session]].

## Related Notes

- [[07_Templates/Note_Contracts|Note Contracts]]
- [[07_Templates/Phase_Template|Phase Template]]
