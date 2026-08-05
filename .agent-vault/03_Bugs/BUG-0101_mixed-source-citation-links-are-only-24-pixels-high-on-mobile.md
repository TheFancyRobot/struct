---
note_type: bug
template_version: 2
contract_version: 1
title: Mixed source citation links are only 24 pixels high on mobile
bug_id: BUG-0101
status: fixed
severity: sev-3
category: accessibility
reported_on: '2026-07-28'
fixed_on: '2026-08-04'
owner: bug0101_attempt1
created: '2026-07-28'
updated: '2026-08-04'
related_notes:
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]]'
  - '[[05_Sessions/2026-07-28-204323-complete-responsive-accessibility-and-theme-behavior-codex|SESSION-2026-07-28-204323 Codex session for Complete Responsive Accessibility and Theme Behavior]]'
tags:
  - agent-vault
  - bug
---

# BUG-0101 - Mixed source citation links are only 24 pixels high on mobile

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Mixed source citation links are only 24 pixels high on mobile.
- Related notes: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]], [[05_Sessions/2026-07-28-204323-complete-responsive-accessibility-and-theme-behavior-codex|SESSION-2026-07-28-204323 Codex session for Complete Responsive Accessibility and Theme Behavior]].
- **Observed:** Inline `[D1]`, `[Q1]`, and `[M1]` citation badges measure roughly 50×24px on mobile, leaving a vertical target almost half the 44px baseline.
- **Expected:** Expand each citation link hit area to at least 44px without increasing visual clutter.
- **Reproduction:** Open complete mixed-source demo at 390×844, view Synthesis, and measure visible citation anchors.
- **Evidence:** `.local/ui-audit/demo/screenshots/mobile-light-complete.png` and lead bounding-box capture.

## Observed Behavior

- Inline `[D1]`, `[Q1]`, and `[M1]` citation badges measure roughly 50×24px on mobile.
- Vertical target is almost half the 44px baseline.

## Expected Behavior

- Each citation link hit area is at least 44px.
- Visual clutter is not increased.

## Reproduction Steps

1. Open the complete mixed-source demo at 390×844.
2. View the Synthesis section.
3. Measure the visible citation anchors.

## Scope / Blast Radius

- Mobile viewport at 390×844.
- Inline `[D1]`, `[Q1]`, and `[M1]` citation badges in the mixed-source Synthesis view.

## Suspected Root Cause

- Record current theories and assumptions.

## Confirmed Root Cause

- Decisive evidence: `.local/ui-audit/demo/screenshots/mobile-light-complete.png` and lead bounding-box capture confirm the ~50×24px citation hit area on mobile.
- No code-level cause is documented.
- Confirmed 2026-08-05: the mobile citation anchors exposed only the compact badge’s roughly 24px height and did not provide a 44px minimum interactive hit area.

## Workaround

- No temporary workaround is documented; mitigation is the permanent fix plan.

## Permanent Fix Plan

- Expand each citation link hit area to at least 44px without increasing visual clutter.

## Regression Coverage Needed

- Re-measure visible citation anchors on the mixed-source demo at 390×844 after the fix.
- Confirm each hit area is at least 44px without added clutter.

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
- 2026-08-04 - Fixed: kept the compact visible citation badges inside 44px minimum-height link targets, using negative vertical margins to preserve the existing visual density. Verified with `bun test --timeout 30000 apps/web/src/components/mixed-source-report.test.tsx`, `bun test --timeout 60000 --max-concurrency 1 apps/web/e2e/mixed-source-report.spec.ts` (including a 390×844 measurement for [D1], [Q1], and [M1]), web TypeScript check, targeted ESLint, and production web build.
- 2026-08-04: Automated review follow-up: citation touch-target E2E coverage now explicitly waits for each citation link and its nested `.badge` to be visible before bounding-box measurement. Focused validation passed: `bun test --timeout 60000 --max-concurrency 1 apps/web/e2e/mixed-source-report.spec.ts` (7 passing, 0 failing, 200 assertions).
- 2026-08-04 - Re-verified the permanent fix in the shared tree: `MixedSourceReport` retains compact badges inside 44px minimum-height citation anchors with negative vertical margins; the 390×844 browser scenario measured `[D1]`, `[Q1]`, and `[M1]` at ≥44px. Re-run with `bun test --timeout 60000 --max-concurrency 1 apps/web/e2e/mixed-source-report.spec.ts` and `node /Users/dino/.agent-vault/.runtime/node_modules/@fancyrobot/agent-vault/dist/cli.mjs vault validate-all`.
