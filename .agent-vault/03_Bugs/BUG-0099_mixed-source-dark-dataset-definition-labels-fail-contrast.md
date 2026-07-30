---
note_type: bug
template_version: 2
contract_version: 1
title: Mixed source dark dataset definition labels fail contrast
bug_id: BUG-0099
status: new
severity: sev-2
category: accessibility
reported_on: '2026-07-28'
fixed_on: ''
owner: unassigned
created: '2026-07-28'
updated: '2026-07-30'
related_notes:
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]]'
  - '[[05_Sessions/2026-07-28-204323-complete-responsive-accessibility-and-theme-behavior-codex|SESSION-2026-07-28-204323 Codex session for Complete Responsive Accessibility and Theme Behavior]]'
tags:
  - agent-vault
  - bug
---

# BUG-0099 - Mixed source dark dataset definition labels fail contrast

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Mixed source dark dataset definition labels fail contrast.
- Related notes: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]], [[05_Sessions/2026-07-28-204323-complete-responsive-accessibility-and-theme-behavior-codex|SESSION-2026-07-28-204323 Codex session for Complete Responsive Accessibility and Theme Behavior]].
- **Observed:** Dark-mode dataset definition terms (`Unit`, `Window`, `Cohort`, `Denominator`) use `text-base-content/50` at 12px and measure 4.44:1, below 4.5:1.
- **Expected:** Definition labels meet WCAG AA without relying on rounding tolerance.
- **Reproduction:** Open the complete mixed-source demo in dark mode and run axe.
- **Evidence:** `.local/ui-audit/demo/a11y/desktop-dark-complete.json` and `contrast-unique.json`.

## Observed Behavior

- In dark mode, the mixed-source report's dataset definition `<dl class="semantics-list">` renders four `<dt class="text-xs text-base-content/50">` labels (`Unit`, `Window`, `Cohort`, `Denominator`) at 12px / normal weight.
- axe reports each at **4.44:1** (foreground `#797f8d` on background `#0f172a`), below the WCAG AA 4.5:1 threshold for normal-weight text < 18pt (rule `color-contrast`, impact serious, tags `wcag2aa`/`wcag143`).
- Evidence: `desktop-dark-complete.json` `violations[0].nodes` targeting `.p-2.bg-base-100:nth-child(1..4) > dt`; same four nodes also flagged across `desktop-dark-cancelled.json`, `desktop-dark-reconnecting.json`, `desktop-dark-live.json` in `contrast-unique.json`.

## Expected Behavior

- Dataset definition labels meet WCAG AA (≥ 4.5:1 for 12px normal-weight text) without relying on rounding tolerance.

## Reproduction Steps

1. Run the web demo server (audit targeted `http://127.0.0.1:4173/projects/.../runs/...?demo=mixed-source&state=complete`, axe 4.12.1 / Chrome).
2. Open the complete mixed-source demo in **dark** mode.
3. Run axe against the page.
4. Result: 4 `color-contrast` violations on `.p-2.bg-base-100:nth-child(N) > dt` (`Unit`, `Window`, `Cohort`, `Denominator`), each measuring 4.44:1.

## Scope / Blast Radius

- Component: `apps/web/src/components/MixedSourceReport.tsx:433` — `<dt class="text-xs text-base-content/50">` rendering `evidence.semantics` labels.
- Renders only when a mixed-source run result has dataset definition `semantics` (the four-label definition grid).
- Theme: dark mode only (the same labels are not flagged in light-mode audits).
- States affected per `contrast-unique.json`: dark `complete`, `live`, `cancelled`, `reconnecting`.
- Users: low-vision / dark-mode readers cannot read the definition labels.

## Suspected Root Cause

- Record current theories and assumptions.

## Confirmed Root Cause

- The `<dt>` label at `MixedSourceReport.tsx:433` uses Tailwind opacity modifier `text-base-content/50` (50% alpha of base-content). In dark mode this resolves to foreground `#797f8d` on the `bg-base-100` (`#0f172a`) card, yielding 4.44:1 — just under the 4.5:1 AA threshold for 12px normal-weight non-large text.
- Decisive evidence: `desktop-dark-complete.json` `violations[0].nodes` (4 `dt` nodes, ratio 4.44) and `contrast-unique.json` (same four targets across 4 dark states).

## Workaround

- None in product. A user could force a custom stylesheet / OS contrast override, but no built-in toggle exists.
- Remaining risk: dark-mode users with low vision cannot read dataset definition labels until the fix ships.

## Permanent Fix Plan

- Raise the `text-base-content` opacity on the `<dt>` definition labels at `MixedSourceReport.tsx:433` from `/50` to a value that clears 4.5:1 in dark mode (e.g., `/60`–`/65`), or switch to a dedicated muted token meeting AA in both themes.
- Re-run the `.local/ui-audit/demo/a11y/` axe suite across all dark demo states and confirm the four `dt` nodes pass `color-contrast`.
- (No code change in this task — contract fill only.)

## Regression Coverage Needed

- Add an axe `color-contrast` assertion (or `contrast-unique.json` snapshot gate) over the mixed-source dark `complete`, `live`, `cancelled`, and `reconnecting` states, asserting the four `.p-2.bg-base-100 > dt` labels measure ≥ 4.5:1.
- Extend the existing `.local/ui-audit` run to fail on regressions of the dataset definition `dt` contrast.
- Add a component test asserting the `<dt>` no longer uses `/50` (or asserts computed contrast ≥ 4.5:1).

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
