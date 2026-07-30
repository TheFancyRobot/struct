---
note_type: bug
template_version: 2
contract_version: 1
title: Mixed source live demo state lacks an explicit browser regression
bug_id: BUG-0090
status: new
severity: sev-3
category: testing
reported_on: '2026-07-28'
fixed_on: ''
owner: unassigned
created: '2026-07-28'
updated: '2026-07-28'
related_notes:
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]]'
  - '[[05_Sessions/2026-07-28-204323-complete-responsive-accessibility-and-theme-behavior-codex|SESSION-2026-07-28-204323 Codex session for Complete Responsive Accessibility and Theme Behavior]]'
tags:
  - agent-vault
  - bug
---

# BUG-0090 - Mixed source live demo state lacks an explicit browser regression

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Mixed-source live demo state lacks an explicit browser regression.
- Related notes: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]], [[05_Sessions/2026-07-28-204323-complete-responsive-accessibility-and-theme-behavior-codex|SESSION-2026-07-28-204323 Codex session for Complete Responsive Accessibility and Theme Behavior]].
- **Gap:** The MixedSourceReport screenshot/state loop covers loading, reconnecting, cancelled, empty, error, and complete but does not explicitly assert `live`.
- **Expected regression:** Add `state=live` to the browser state matrix in both themes and responsive widths.
- **Evidence:** `.local/ui-audit/inventory.md` demo-only state table.

## Observed Behavior

- The MixedSourceReport screenshot/state loop covers loading, reconnecting, cancelled, empty, error, and complete states.
- The `live` state is not explicitly asserted.
- Evidence: `.local/ui-audit/inventory.md` demo-only state table.

## Expected Behavior

- `state=live` is asserted in the browser state matrix.
- Coverage spans both themes and responsive widths.

## Reproduction Steps

1. Open `.local/ui-audit/inventory.md` demo-only state table.
2. Review the MixedSourceReport screenshot/state loop covered states: loading, reconnecting, cancelled, empty, error, complete.
3. Confirm `live` is not explicitly asserted.

## Scope / Blast Radius

- MixedSourceReport demo state coverage.
- Browser state matrix (both themes, responsive widths).
- Phase 10, Step 10-07 (responsive accessibility and theme behavior).

## Suspected Root Cause

- Record current theories and assumptions.

## Confirmed Root Cause

- The screenshot/state loop enumerates loading, reconnecting, cancelled, empty, error, and complete but omits `live`.
- Evidence: `.local/ui-audit/inventory.md` demo-only state table.

## Workaround

- None documented; the `live` state remains unasserted in the browser matrix.

## Permanent Fix Plan

- Add `state=live` to the browser state matrix.
- Cover `live` in both themes and responsive widths.

## Regression Coverage Needed

- Browser regression asserting `state=live` across both themes and responsive widths.
- Update `.local/ui-audit/inventory.md` demo-only state table to reflect `live`.

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
