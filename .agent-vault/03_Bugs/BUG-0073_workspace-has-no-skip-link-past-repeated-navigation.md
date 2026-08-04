---
note_type: bug
template_version: 2
contract_version: 1
title: Workspace has no skip link past repeated navigation
bug_id: BUG-0073
status: fixed
severity: sev-3
category: accessibility
reported_on: '2026-07-28'
fixed_on: '2026-08-03'
owner: Codex
created: '2026-07-28'
updated: '2026-08-03'
related_notes:
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]]'
  - '[[05_Sessions/2026-07-28-204323-complete-responsive-accessibility-and-theme-behavior-codex|SESSION-2026-07-28-204323 Codex session for Complete Responsive Accessibility and Theme Behavior]]'
tags:
  - agent-vault
  - bug
---

# BUG-0073 - Workspace has no skip link past repeated navigation

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Workspace has no skip link past repeated navigation.
- Related notes: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]], [[05_Sessions/2026-07-28-204323-complete-responsive-accessibility-and-theme-behavior-codex|SESSION-2026-07-28-204323 Codex session for Complete Responsive Accessibility and Theme Behavior]].
- **Observed:** The first keyboard path enters the full workspace navigation; no `Skip to main content` link exists in the accessibility tree on any route.
- **Expected:** A focus-visible skip link moves keyboard focus directly to route main content.
- **Reproduction:** Load any route and Tab from the document start.
- **Standards:** WCAG 2.4.1 Bypass Blocks.

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
- `WorkspaceShell` rendered repeated workspace navigation before the route `<main>` region but supplied neither a bypass control nor a focusable main target.

## Workaround

- Describe any temporary mitigation and remaining risk.

## Permanent Fix Plan

- Describe the intended durable fix.
- Added a visually hidden, focus-visible `Skip to main content` link before workspace navigation. It targets the route main region, which now has `id="workspace-main"` and `tabindex="-1"` so the browser moves keyboard focus there.

## Regression Coverage Needed

- List tests, fixtures, reproductions, alerts, or docs updates needed.
- `workspace-shell.test.tsx` verifies the skip link precedes navigation, remains focus-visible, and targets the focusable main region.

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- Phase: [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|Phase 10 v1 usable research workspace]]
- Step: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]]
- Session: [[05_Sessions/2026-07-28-204323-complete-responsive-accessibility-and-theme-behavior-codex|SESSION-2026-07-28-204323 Codex session for Complete Responsive Accessibility and Theme Behavior]]
<!-- AGENT-END:bug-related-notes -->

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-07-28 - Reported.
<!-- AGENT-END:bug-timeline -->
- 2026-08-03 - Fixed: added the route-main skip link and focused regression coverage; focused test and web typecheck passed.
