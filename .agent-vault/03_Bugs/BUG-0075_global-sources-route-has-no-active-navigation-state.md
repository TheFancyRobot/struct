---
note_type: bug
template_version: 2
contract_version: 1
title: Global Sources route has no active navigation state
bug_id: BUG-0075
status: fixed
severity: sev-3
category: navigation
reported_on: '2026-07-28'
fixed_on: '2026-08-03'
owner: bug_0075
created: '2026-07-28'
updated: '2026-08-03'
related_notes:
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]]'
  - '[[05_Sessions/2026-07-28-204323-complete-responsive-accessibility-and-theme-behavior-codex|SESSION-2026-07-28-204323 Codex session for Complete Responsive Accessibility and Theme Behavior]]'
tags:
  - agent-vault
  - bug
---

# BUG-0075 - Global Sources route has no active navigation state

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Global Sources route has no active navigation state.
- Related notes: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]], [[05_Sessions/2026-07-28-204323-complete-responsive-accessibility-and-theme-behavior-codex|SESSION-2026-07-28-204323 Codex session for Complete Responsive Accessibility and Theme Behavior]].
- **Observed:** On `/sources`, Add source and Manage source library both have `aria-current=null` and no active class, while project-scoped destinations expose current state.
- **Expected:** Mark Manage source library current on the route and preserve an appropriate active target for the import anchor.
- **Reproduction:** Open `/sources` and inspect workspace navigation links.

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
The global-source navigation fallback rendered `Manage source library` without the same `aria-current` condition used by project-scoped navigation. Adding current state to both that link and the `/sources#source-import-heading` shortcut would incorrectly advertise two current destinations for one page.

## Workaround

- Describe any temporary mitigation and remaining risk.

## Permanent Fix Plan

- Describe the intended durable fix.
Apply `aria-current="page"` to Manage source library only when the current pathname is `/sources`. Keep Add source as the anchor shortcut that preserves its existing focus behavior, without current-page state.

## Regression Coverage Needed

- List tests, fixtures, reproductions, alerts, or docs updates needed.
Server-render the global `/sources` navigation and assert that Manage source library is the sole `aria-current="page"` link while Add source retains its import-anchor href.

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
