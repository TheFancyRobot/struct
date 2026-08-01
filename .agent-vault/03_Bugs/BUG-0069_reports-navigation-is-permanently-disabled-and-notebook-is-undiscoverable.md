---
note_type: bug
template_version: 2
contract_version: 1
title: Reports navigation is permanently disabled and notebook is undiscoverable
bug_id: BUG-0069
status: fixed
severity: sev-2
category: navigation
reported_on: '2026-07-28'
fixed_on: '2026-08-01'
owner: root
created: '2026-07-28'
updated: '2026-07-28'
related_notes:
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]]'
  - '[[05_Sessions/2026-07-28-204323-complete-responsive-accessibility-and-theme-behavior-codex|SESSION-2026-07-28-204323 Codex session for Complete Responsive Accessibility and Theme Behavior]]'
tags:
  - agent-vault
  - bug
---

# BUG-0069 - Reports navigation is permanently disabled and notebook is undiscoverable

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Reports navigation is permanently disabled and notebook is undiscoverable.
- Related notes: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]], [[05_Sessions/2026-07-28-204323-complete-responsive-accessibility-and-theme-behavior-codex|SESSION-2026-07-28-204323 Codex session for Complete Responsive Accessibility and Theme Behavior]].
- **Observed:** Every project route renders Reports as a disabled button. No user-facing link reaches `/projects/:projectId/notebook`; inventory confirms the route is direct-link/programmatic only.
- **Expected:** Provide an enabled Reports deep link with an empty state, or explain the exact prerequisite and enable it when satisfied.
- **Reproduction:** Open any project route and inspect every navigation destination.
- **Evidence:** `.local/ui-audit/inventory.md` §3.2 and project screenshots in light/dark reports.

## Observed Behavior

- Project navigation rendered Reports as a disabled button, although `/projects/:projectId/notebook` was a valid route with empty, loading, and error states.

## Expected Behavior

- Project navigation exposes Reports as an enabled link to the project notebook.

## Reproduction Steps

1. Open a project route.
2. Inspect Workspace navigation's Project section.
3. Reports is disabled instead of linking to the notebook.

## Scope / Blast Radius

- Every project workspace navigation; direct notebook URLs remained functional.

## Suspected Root Cause

- The navigation item was a placeholder never replaced after the notebook route was added.

## Confirmed Root Cause

- `WorkspaceShell` rendered `<button disabled>Reports</button>` while `index.tsx` already registered `/projects/:projectId/notebook`.

## Workaround

- Navigate directly to the notebook URL.

## Permanent Fix Plan

- Replace the disabled button with the same base-path-aware project notebook anchor pattern used by the other project links.

## Regression Coverage Needed

- Workspace shell rendering must assert the notebook href and the absence of a disabled project-navigation button.

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
