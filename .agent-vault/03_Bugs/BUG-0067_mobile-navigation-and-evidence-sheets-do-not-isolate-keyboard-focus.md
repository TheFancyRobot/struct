---
note_type: bug
template_version: 2
contract_version: 1
title: Mobile navigation and evidence sheets do not isolate keyboard focus
bug_id: BUG-0067
status: fixed
severity: sev-2
category: accessibility
reported_on: '2026-07-28'
fixed_on: '2026-07-30'
owner: bug-0067-attempt-1
created: '2026-07-28'
updated: '2026-07-30'
related_notes:
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]]'
  - '[[05_Sessions/2026-07-28-204323-complete-responsive-accessibility-and-theme-behavior-codex|SESSION-2026-07-28-204323 Codex session for Complete Responsive Accessibility and Theme Behavior]]'
tags:
  - agent-vault
  - bug
---

# BUG-0067 - Mobile navigation and evidence sheets do not isolate keyboard focus

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Mobile navigation and evidence sheets do not isolate keyboard focus.
- Related notes: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]], [[05_Sessions/2026-07-28-204323-complete-responsive-accessibility-and-theme-behavior-codex|SESSION-2026-07-28-204323 Codex session for Complete Responsive Accessibility and Theme Behavior]].
- **Observed:** With either mobile sheet open, underlying top-bar and main-content controls remain in the accessibility tree and Tab order. Neither surface has dialog/modal semantics or an inert background; focus can leave the sheet.
- **Expected:** Move focus inside, trap Tab/Shift+Tab, make the background inert, support Escape/backdrop dismissal, and restore the opener.
- **Reproduction:** At 375×812 open Navigation or Evidence, enumerate visible focusables, and Tab past the final sheet control.
- **Evidence:** `.local/ui-audit/lead/screenshots/mobile-form-controls-under-44.png` and LEAD-019.

## Observed Behavior

- At mobile widths (<768px for navigation, <1024px for evidence) the navigation `<section>` and evidence `<aside>` slide in as overlays but render as plain landmark containers: no `role="dialog"`, no `aria-modal`, and no `inert` on the underlying `<main>` top bar or sibling sheet.
- Tab/Shift+Tab from the sheet's controls escapes into the top bar (Menu, Evidence, theme toggle) and main content instead of wrapping inside the sheet.
- Focus is moved into the sheet on open and Escape/backdrop dismissal restores the opener (already present), but the background stays in the tab order and accessibility tree.

## Expected Behavior

- Each open mobile sheet is announced as a modal dialog (`role="dialog"`, `aria-modal="true"`) with an accessible name.
- The background (`<main>` and the other sheet) is `inert` so its controls are removed from the tab order and accessibility tree.
- Tab/Shift+Tab wrap inside the open sheet (focus trap); focus cannot leave the sheet.
- Escape and backdrop click dismiss the sheet and restore focus to the opener.

## Reproduction Steps

1. At 375×812 (mobile), open the workspace navigation sheet via the "Open workspace navigation" button.
2. Press Tab repeatedly past the final sheet control.
3. Observed (before fix): focus leaves the sheet into the top bar / main content. Expected: focus wraps to the first sheet control.
4. Repeat for the evidence sheet via "Open evidence".

## Scope / Blast Radius

- `apps/web/src/components/workspace/WorkspaceShell.tsx` (navigation section, evidence aside, main content) — mobile overlay sheet behavior only. Desktop static panes are unaffected (sheet-open signals stay false at/above their breakpoints).
- No backend, persistence, or routing impact.

## Suspected Root Cause

- The sheets reuse the always-rendered static pane containers and were never given modal semantics; only focus-move-on-open and Escape handling existed.
- The background was never made `inert`, so its focusables stayed in the tab order.

## Confirmed Root Cause

- The navigation `<section>` and evidence `<aside>` lacked `role="dialog"`/`aria-modal`, the `<main>` content and sibling sheet were not `inert` while a sheet was open, and no Tab/Shift+Tab key handler wrapped focus inside the sheet. Verified against `WorkspaceShell.tsx` before the fix and reproduced via the new e2e test failing on `getByRole('dialog')` / `main[inert]`.

## Workaround

- None applied. Users could press Escape to close and reopen, but focus isolation was absent.

## Permanent Fix Plan

- Added a module-scope `trapSheetFocus` helper in `WorkspaceShell.tsx` that, on Tab/Shift+Tab inside an open sheet, wraps focus from the last visible focusable to the first (and vice versa), correctly handling the initially-focused `tabindex="-1"` heading via `compareDocumentPosition`.
- The navigation `<section>` now exposes `role="dialog"`, `aria-modal="true"`, `aria-label="Workspace navigation"` (only while `navigationSheetOpen()`), plus an `onKeyDown` focus trap.
- The evidence `<aside>` now exposes `role="dialog"`/`aria-modal="true"` (only while `evidenceSheetOpen()`, labeled via the existing `aria-labelledby="evidence-heading"`) plus an `onKeyDown` focus trap.
- `<main>` (in `ConversationWorkspace`) is `inert` while either sheet is open; each sheet is `inert` while the other sheet is open, so the open sheet stays interactive.
- Backdrop buttons gained `tabindex="-1"` so they remain click-to-close but are never tab targets.
- Desktop static panes are unchanged: the sheet-open signals stay false at/above their breakpoints, so no dialog role or `inert` is applied.

## Regression Coverage Needed

- e2e: `apps/web/e2e/workspace-responsive.spec.ts` "isolates keyboard focus inside mobile sheets with dialog semantics and an inert background" — asserts dialog role/aria-modal, inert background, Tab and Shift+Tab wrap inside each sheet, and Escape restores the opener.
- Existing "moves focus into mobile sheets and restores it on Escape" and accessibility/responsive specs remain green.

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
- 2026-07-30 - Fixed by bug-0067-attempt-1: added dialog semantics (role/aria-modal), inert background, and Tab/Shift+Tab focus trap to the mobile navigation and evidence sheets in WorkspaceShell.tsx; added e2e regression coverage; validated via responsive/accessibility/release e2e specs and web unit tests.
- 2026-07-30 - Follow-up fix by bug-0067-disabled-focus-trap-retry3: `SHEET_FOCUSABLE_SELECTOR` excluded disabled `button` but not disabled `input`/`select`/`textarea`. Disabled form controls are skipped by the native tab order, so a disabled control at a sheet boundary was selected as the trap endpoint; the wrap guard (`active === last`/`first`) never matched at the real enabled boundary and the trap stopped intercepting Tab/Shift+Tab, deferring to the native order. Root cause confirmed by grep of the selector feeding `trapSheetFocus`. Fix: extend `:not([disabled])` to `textarea`, `input`, and `select`. Verified RED/GREEN: with the old selector restored, the new e2e test "treats disabled input/select/textarea as non-endpoints of the sheet focus trap" FAILS (forward Tab at `trap-marker-last` not prevented, `expect(true).toBe(true)` → received `false`); with the fix, all 9 responsive specs PASS (136 expect calls). Web typecheck clean. Files: `apps/web/src/components/workspace/WorkspaceShell.tsx`, `apps/web/e2e/workspace-responsive.spec.ts`.
