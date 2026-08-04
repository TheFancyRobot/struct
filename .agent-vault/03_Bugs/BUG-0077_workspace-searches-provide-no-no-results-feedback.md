---
note_type: bug
template_version: 2
contract_version: 1
title: Workspace searches provide no results feedback
bug_id: BUG-0077
status: fixed
severity: sev-3
category: ux
reported_on: '2026-07-28'
fixed_on: '2026-08-04'
owner: bug_0077
created: '2026-07-28'
updated: '2026-08-04'
related_notes:
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]]'
  - '[[05_Sessions/2026-07-28-204323-complete-responsive-accessibility-and-theme-behavior-codex|SESSION-2026-07-28-204323 Codex session for Complete Responsive Accessibility and Theme Behavior]]'
tags:
  - agent-vault
  - bug
---

# BUG-0077 - Workspace searches provide no results feedback

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Workspace searches provide no results feedback.
- Related notes: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]], [[05_Sessions/2026-07-28-204323-complete-responsive-accessibility-and-theme-behavior-codex|SESSION-2026-07-28-204323 Codex session for Complete Responsive Accessibility and Theme Behavior]].
- **Observed:** A query with zero project/source matches leaves a blank list with no status, result count, or recovery guidance.
- **Expected:** Show `No matching projects/sources` and preserve the add/manage action.
- **Reproduction:** Enter `zzzz-no-project` or `zzzz-no-source` in workspace searches.
- **Evidence:** `.local/ui-audit/lead/screenshots/sidebar-search-no-results-blank.png` and light report L-05.

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
The workspace navigation filtered project and attached document lists directly but rendered an empty list when a non-empty query had no matches. It did not distinguish a completed zero-match search from loading.

## Workaround

- Describe any temporary mitigation and remaining risk.

## Permanent Fix Plan

- Describe the intended durable fix.
Render a polite status message for completed project or source searches with zero matches, while leaving the existing add and manage actions in place.

## Regression Coverage Needed

- List tests, fixtures, reproductions, alerts, or docs updates needed.
Focused workspace-shell coverage verifies non-empty, loaded zero-result searches produce feedback while empty queries, loading, and matching searches do not.

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
- 2026-08-04 - Fixed: added accessible no-match search states and focused regression coverage; workspace-shell tests and web typecheck pass.
