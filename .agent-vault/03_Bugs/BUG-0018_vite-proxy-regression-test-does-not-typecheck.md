---
note_type: bug
template_version: 2
contract_version: 1
title: Vite proxy regression test does not typecheck
bug_id: BUG-0018
status: fixed
severity: sev-3
category: logic
reported_on: '2026-07-21'
fixed_on: '2026-07-21'
owner: orchestrator
created: '2026-07-21'
updated: '2026-07-21'
related_notes:
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_01_establish-workspace-and-project-lifecycle|STEP-10-01 Establish Workspace and Project Lifecycle]]'
tags:
  - agent-vault
  - bug
---

# BUG-0018 - Vite proxy regression test does not typecheck

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Vite proxy regression test does not typecheck.
- Related notes: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_01_establish-workspace-and-project-lifecycle|STEP-10-01 Establish Workspace and Project Lifecycle]].

## Observed Behavior

- Describe what actually happens.

## Expected Behavior

- Describe what should happen instead.

## Reproduction Steps

1. List the exact setup state.
2. List the user or developer actions.
3. Record the observed result.

## Scope / Blast Radius

- List affected packages, commands, integrations, environments, or users.

## Suspected Root Cause

- Record current theories and assumptions.

## Confirmed Root Cause

- Record the proven cause and decisive evidence.

## Workaround

- Describe any temporary mitigation and remaining risk.

## Permanent Fix Plan

- Describe the intended durable fix.

## Regression Coverage Needed

- List tests, fixtures, reproductions, alerts, or docs updates needed.

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- Phase: [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|Phase 10 v1 usable research workspace]]
- Step: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_01_establish-workspace-and-project-lifecycle|STEP-10-01 Establish Workspace and Project Lifecycle]]
<!-- AGENT-END:bug-related-notes -->

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-07-21 - Reported.
- 2026-07-21 - Fixed by narrowing the Vite proxy entry before reading `rewrite`; validated with focused test and full `bun run typecheck`.
<!-- AGENT-END:bug-timeline -->
