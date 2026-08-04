---
note_type: bug
template_version: 2
contract_version: 1
title: Add Source leaves focus in workspace navigation after route change
bug_id: BUG-0071
status: fixed
severity: sev-3
category: accessibility
reported_on: '2026-07-28'
fixed_on: '2026-08-03'
owner: bug_0071
created: '2026-07-28'
updated: '2026-08-03'
related_notes:
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]]'
  - '[[05_Sessions/2026-07-28-204323-complete-responsive-accessibility-and-theme-behavior-codex|SESSION-2026-07-28-204323 Codex session for Complete Responsive Accessibility and Theme Behavior]]'
tags:
  - agent-vault
  - bug
---

# BUG-0071 - Add Source leaves focus in workspace navigation after route change

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Add Source leaves focus in workspace navigation after route change.
- Related notes: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]], [[05_Sessions/2026-07-28-204323-complete-responsive-accessibility-and-theme-behavior-codex|SESSION-2026-07-28-204323 Codex session for Complete Responsive Accessibility and Theme Behavior]].
- **Observed:** Activating Add Source navigates to `/sources#source-import-heading` but focus remains on the sidebar link. Add Project correctly focuses Project name.
- **Expected:** Parallel creation workflows move focus consistently to the target heading or first actionable field.
- **Reproduction:** Activate Add Source twice and inspect `document.activeElement` after navigation.
- **Evidence:** `.local/ui-audit/lead/screenshots/add-source-focus-stays-navigation.png`.

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
The workspace sidebar navigates to `/sources#source-import-heading`, but the Sources route had no reactive route-focus behavior. Browser focus therefore remained on the activating sidebar link after the route transition.

## Workaround

- Describe any temporary mitigation and remaining risk.

## Permanent Fix Plan

- Describe the intended durable fix.
Implemented: SourcesPage now reacts to the router hash and, after the source-import route renders, focuses the fragment target. The Add sources heading has `tabindex="-1"`, allowing programmatic focus without adding a tab stop.

## Regression Coverage Needed

- List tests, fixtures, reproductions, alerts, or docs updates needed.
Covered the desktop workspace navigation path in `apps/web/e2e/workspace-responsive.spec.ts`: activating Add source waits for `/sources#source-import-heading` and asserts that the Add sources heading owns focus.

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- Phase: [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|Phase 10 v1 usable research workspace]]
- Step: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]]
- Session: [[05_Sessions/2026-07-28-204323-complete-responsive-accessibility-and-theme-behavior-codex|SESSION-2026-07-28-204323 Codex session for Complete Responsive Accessibility and Theme Behavior]]
<!-- AGENT-END:bug-related-notes -->

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-07-28 - Reported.
- 2026-08-03 - Fixed: routed hash-target focus through SourcesPage and added browser regression coverage. Focused browser contract, source page/component tests, and web typecheck passed.
<!-- AGENT-END:bug-timeline -->
