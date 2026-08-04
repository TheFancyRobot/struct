---
note_type: bug
template_version: 2
contract_version: 1
title: Mixed source dataset type labels fail contrast in both themes
bug_id: BUG-0098
status: fixed
severity: sev-2
category: accessibility
reported_on: '2026-07-28'
fixed_on: '2026-08-03'
owner: bug_0098
created: '2026-07-28'
updated: '2026-07-28'
related_notes:
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]]'
  - '[[05_Sessions/2026-07-28-204323-complete-responsive-accessibility-and-theme-behavior-codex|SESSION-2026-07-28-204323 Codex session for Complete Responsive Accessibility and Theme Behavior]]'
tags:
  - agent-vault
  - bug
---

# BUG-0098 - Mixed source dataset type labels fail contrast in both themes

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Mixed source dataset type labels fail contrast in both themes.
- Related notes: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]], [[05_Sessions/2026-07-28-204323-complete-responsive-accessibility-and-theme-behavior-codex|SESSION-2026-07-28-204323 Codex session for Complete Responsive Accessibility and Theme Behavior]].
- **Observed:** Dataset table type labels such as `VARCHAR` and `BIGINT` use `text-base-content/45` at 11.2px, measuring 2.92:1 in light and 3.85:1 in dark, below 4.5:1.
- **Expected:** Small schema/type metadata meets 4.5:1 independently in both themes.
- **Reproduction:** Open the complete mixed-source demo and run axe in light/dark.
- **Evidence:** `.local/ui-audit/demo/contrast-unique.json` and complete-state axe JSON.

## Observed Behavior

- Dataset table type labels such as `VARCHAR` and `BIGINT` fail contrast in both themes.
- Labels use `text-base-content/45` at 11.2px.
- Contrast measures 2.92:1 in light and 3.85:1 in dark, below 4.5:1.

## Expected Behavior

- Small schema/type metadata meets 4.5:1 contrast.
- Independently in both light and dark themes.

## Reproduction Steps

- Open the complete mixed-source demo.
- Run axe in light and dark themes.
- Evidence: `.local/ui-audit/demo/contrast-unique.json` and complete-state axe JSON.

## Scope / Blast Radius

- Mixed-source dataset table type labels.
- Affects both light and dark themes.

## Suspected Root Cause

- Record current theories and assumptions.

## Confirmed Root Cause

- Type labels render with `text-base-content/45` at 11.2px, yielding 2.92:1 (light) / 3.85:1 (dark), below 4.5:1.

## Workaround

- None recorded in the summary evidence.

## Permanent Fix Plan

- Type labels must meet 4.5:1 independently in both themes.
- Current `text-base-content/45` at 11.2px is the cause to address.
- Implemented: dataset-table type labels now use `text-base-content/65`, matching the report's AA-safe compact metadata treatment.

## Regression Coverage Needed

- Re-run axe in light/dark on the complete mixed-source demo.
- Verify `.local/ui-audit/demo/contrast-unique.json` and complete-state axe JSON show type labels at >= 4.5:1.
- Added server-rendered coverage for `VARCHAR` and `BIGINT`, requiring `text-base-content/65` and rejecting the former `/45` class.

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
- 2026-08-03 - Fixed: raised compact dataset type-label opacity from `/45` to `/65` and added focused regression coverage.
