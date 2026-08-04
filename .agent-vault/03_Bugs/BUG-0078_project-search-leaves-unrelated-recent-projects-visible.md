---
note_type: bug
template_version: 2
contract_version: 1
title: Project search leaves unrelated recent projects visible
bug_id: BUG-0078
status: fixed
severity: sev-3
category: ux
reported_on: '2026-07-28'
fixed_on: '2026-08-04'
owner: Codex
created: '2026-07-28'
updated: '2026-08-04'
related_notes:
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]]'
  - '[[05_Sessions/2026-07-28-204323-complete-responsive-accessibility-and-theme-behavior-codex|SESSION-2026-07-28-204323 Codex session for Complete Responsive Accessibility and Theme Behavior]]'
tags:
  - agent-vault
  - bug
---

# BUG-0078 - Project search leaves unrelated recent projects visible

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Project search leaves unrelated recent projects visible.
- Related notes: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]], [[05_Sessions/2026-07-28-204323-complete-responsive-accessibility-and-theme-behavior-codex|SESSION-2026-07-28-204323 Codex session for Complete Responsive Accessibility and Theme Behavior]].
- **Observed:** A nonmatching project query empties Projects but leaves unrelated entries visible under Recents, making search scope contradictory.
- **Expected:** Filter all project collections or explicitly label the input as subsection-only.
- **Reproduction:** With recent projects present, search `zzzz-no-project`.
- **Evidence:** `.local/ui-audit/lead/screenshots/sidebar-search-no-results-blank.png`.

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
- `filteredProjects` applied the search term only to the Projects collection. `recentProjects` independently resolved local-storage IDs against the unfiltered list, so nonmatching Recents remained visible for the same search.

## Workaround

- Describe any temporary mitigation and remaining risk.

## Permanent Fix Plan

- Describe the intended durable fix.
- Extracted the shared case-insensitive project-query filter and applied it to both Projects and Recents. The Recents section now disappears when none of its entries match.

## Regression Coverage Needed

- List tests, fixtures, reproductions, alerts, or docs updates needed.
- Added unit coverage for the shared project-query filter and browser coverage that searches `beta` while Alpha is recent, asserting neither the Recents heading nor Alpha remains visible.

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
- 2026-08-04 - Fixed: applied project search consistently to Projects and Recents; focused component tests, web typecheck, production build, and responsive browser coverage passed.
