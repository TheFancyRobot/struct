---
note_type: bug
template_version: 2
contract_version: 1
title: Successful source import is not announced
bug_id: BUG-0076
status: fixed
severity: sev-3
category: accessibility
reported_on: '2026-07-28'
fixed_on: '2026-08-03'
owner: bug_0076
created: '2026-07-28'
updated: '2026-08-03'
related_notes:
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]]'
  - '[[05_Sessions/2026-07-28-204323-complete-responsive-accessibility-and-theme-behavior-codex|SESSION-2026-07-28-204323 Codex session for Complete Responsive Accessibility and Theme Behavior]]'
tags:
  - agent-vault
  - bug
---

# BUG-0076 - Successful source import is not announced

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Successful source import is not announced.
- Related notes: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]], [[05_Sessions/2026-07-28-204323-complete-responsive-accessibility-and-theme-behavior-codex|SESSION-2026-07-28-204323 Codex session for Complete Responsive Accessibility and Theme Behavior]].
- **Observed:** After `Accepting…`, the form clears and a list row appears, but no toast, alert, or live status confirms how many items were accepted; the refreshed list is not live.
- **Expected:** Announce `N sources accepted and processing` without moving focus.
- **Reproduction:** Submit a Paste import on either Sources route and inspect the post-submit accessibility tree.

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
- The successful submission path cleared the form and refreshed source data but never updated an accessible status region with the server-returned accepted count.

## Workaround

- Describe any temporary mitigation and remaining risk.

## Permanent Fix Plan

- Describe the intended durable fix.
- Keep a persistent, atomic polite status region in the import form. On successful imports, populate it from `result.accepted.length` with `N sources accepted and processing`; clearing and refreshing remain unchanged, so focus stays where the submit flow left it.

## Regression Coverage Needed

- List tests, fixtures, reproductions, alerts, or docs updates needed.
- `source-import-panel.test.tsx` asserts the persistent `role="status"` polite atomic live region and verifies singular and plural messages use the exact accepted count.

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
- 2026-08-03 - Fixed: added a non-focus-moving polite live confirmation using the accepted response count and regression coverage.
