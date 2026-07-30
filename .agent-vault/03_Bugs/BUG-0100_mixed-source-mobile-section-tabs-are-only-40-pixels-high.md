---
note_type: bug
template_version: 2
contract_version: 1
title: Mixed source mobile section tabs are only 40 pixels high
bug_id: BUG-0100
status: new
severity: sev-3
category: accessibility
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

# BUG-0100 - Mixed source mobile section tabs are only 40 pixels high

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Mixed source mobile section tabs are only 40 pixels high.
- Related notes: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]], [[05_Sessions/2026-07-28-204323-complete-responsive-accessibility-and-theme-behavior-codex|SESSION-2026-07-28-204323 Codex session for Complete Responsive Accessibility and Theme Behavior]].
- **Observed:** Sources, Synthesis, and Evidence mobile report tabs each measure 121×40px at 390px viewport, below the 44px touch baseline.
- **Expected:** Each tab has at least 44px height and adequate separation while retaining `aria-pressed` state.
- **Reproduction:** Open any mixed-source demo state at 390×844 and measure `nav[aria-label="Mixed-source report sections"] button`.
- **Evidence:** `.local/ui-audit/demo/screenshots/mobile-light-complete.png` and lead bounding-box capture.

## Observed Behavior

- Sources, Synthesis, and Evidence mobile report tabs each render at 121×40px in the 390×844 mobile viewport (screenshot `mobile-light-complete.png`).
- 40px tab height is below the 44px touch-target baseline.
- Tab labels and `aria-pressed` state are otherwise correct; only the target height is defective (audit `report.md` item 5).

## Expected Behavior

- Each mobile section tab has at least 44px height while retaining `aria-pressed` state and labels.
- Tabs keep adequate separation and the 3-column `grid` layout at 390px viewport.

## Reproduction Steps

1. Open any mixed-source demo state (e.g. `?demo=mixed-source&state=complete`) at 390×844 viewport.
2. Measure `nav[aria-label="Mixed-source report sections"] button` (the `.mixed-mobile-tabs .tab` elements).
3. Observed result: each tab is 121×40px, below the 44px touch baseline.

## Scope / Blast Radius

- Affected component: `apps/web/src/components/MixedSourceReport.tsx` — the `.mixed-mobile-tabs` nav rendered only at mobile widths (`sm:hidden`).
- Impact: mobile touch targets on the mixed-source report; accessibility (category: accessibility, sev-3).
- Desktop tab/section layout is unaffected (tabs are mobile-only).

## Suspected Root Cause

- Record current theories and assumptions.

## Confirmed Root Cause

- `MixedSourceReport.tsx` renders each tab button as `class="tab h-10"`; `h-10` (Tailwind) = 2.5rem = 40px, below the 44px baseline.
- Audit `report.md` confirms tabs measure 40px high and that only the target height (not labels/`aria-pressed`) is defective.

## Workaround

- No user-facing workaround; touch target remains undersized until the `h-10` class is raised to a ≥44px height (e.g. `h-11`).

## Permanent Fix Plan

- In `MixedSourceReport.tsx`, change the mobile tab button class from `tab h-10` to a height ≥44px (e.g. `tab h-11` = 2.75rem = 44px), preserving `aria-pressed`, `tab-active`, and the 3-column `grid` layout.

## Regression Coverage Needed

- Add a browser/e2e assertion that `nav[aria-label="Mixed-source report sections"] button` bounding-box height is ≥44px at 390px viewport.
- Re-capture `mobile-light-complete.png` / `mobile-dark-complete.png` to confirm the raised tab height.

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
