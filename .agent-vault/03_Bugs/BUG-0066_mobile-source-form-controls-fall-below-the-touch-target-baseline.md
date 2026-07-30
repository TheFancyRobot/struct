---
note_type: bug
template_version: 2
contract_version: 1
title: Mobile source form controls fall below the touch target baseline
bug_id: BUG-0066
status: fixed
severity: sev-2
category: accessibility
reported_on: '2026-07-28'
fixed_on: '2026-07-30'
owner: bug-0066-attempt-1
created: '2026-07-28'
updated: '2026-07-30'
related_notes:
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]]'
  - '[[05_Sessions/2026-07-28-204323-complete-responsive-accessibility-and-theme-behavior-codex|SESSION-2026-07-28-204323 Codex session for Complete Responsive Accessibility and Theme Behavior]]'
tags:
  - agent-vault
  - bug
---

# BUG-0066 - Mobile source form controls fall below the touch target baseline

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Mobile source form controls fall below the touch target baseline.
- Related notes: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]], [[05_Sessions/2026-07-28-204323-complete-responsive-accessibility-and-theme-behavior-codex|SESSION-2026-07-28-204323 Codex session for Complete Responsive Accessibility and Theme Behavior]].
- **Observed:** At 375×812, workspace search inputs are 30px high inside 32px wrappers; the project select and file input are 40px high. Shared buttons and checkbox label hit areas correctly reach 44px.
- **Expected:** Every mobile form control has a minimum 44px interactive height.
- **Reproduction:** Open `/sources` at 375×812, open navigation, and measure visible input/select bounding boxes.
- **Evidence:** `.local/ui-audit/lead/screenshots/mobile-form-controls-under-44.png` and LEAD-018.

## Observed Behavior

- Describe what actually happens.
- At 375×812 on `/sources`, the workspace navigation search inputs (`.input.input-sm` wrappers) render 32px tall with the inner `<input>` at 30px.
- The library-mode Project `<select class="select select-bordered">` renders 40px tall.
- The SourceImportPanel file `<input class="file-input file-input-bordered">` renders 40px tall.
- The paste-mode source-name `.input` and `.textarea` share the same undersized DaisyUI defaults.
- Shared `.btn` and `.menu a` controls already reach 44px via the existing `.app-shell` min-height rules, so only form fields fell below the baseline.

## Expected Behavior

- Describe what should happen instead.
- Every interactive mobile form control (input, select, file-input, textarea) within `.app-shell` has a minimum 44px (2.75rem) interactive height, matching the existing button and menu-link touch-target policy.

## Reproduction Steps

1. List the exact setup state.
2. List the user or developer actions.
3. Record the observed result.
1. Start the web app and open `/sources` (source library mode) at a 375×812 viewport.
2. Open the workspace navigation sheet so the project/source search inputs are visible.
3. With at least one project loaded, measure the bounding-box height of every visible `.app-shell .input`, `.app-shell .select`, `.app-shell .file-input`, and `.app-shell .textarea`.
4. Observed before fix: search inputs 32px, Project select 40px, file input 40px — all below 44px.
5. After fix: every measured control is ≥44px.

## Scope / Blast Radius

- List affected packages, commands, integrations, environments, or users.
- `apps/web/src/index.css` — the single shared stylesheet; it already enforced 44px on `.app-shell .btn` and `.app-shell .menu a` but had no equivalent rule for DaisyUI form controls.
- Affected components (no code change required, fixed by the shared CSS): `WorkspaceShell.tsx` (nav search inputs), `SourcesPage.tsx` (Project select), `SourceImportPanel.tsx` (file input, paste name input, textarea).
- Blast radius: all workspace routes, since the controls are shared; impact is mobile touch usability (WCAG 2.5.5 / 2.5.8 target size).

## Suspected Root Cause

- Record current theories and assumptions.

## Confirmed Root Cause

- Record the proven cause and decisive evidence.
- DaisyUI v5 form-control sizing defaults render below 44px: `.input-sm` wrappers are 32px and the md `.select`/`.file-input` are 40px. The existing `.app-shell .btn`/`.app-shell .menu a` min-height rules covered buttons and links but no rule covered form fields, so inputs/selects/file-inputs/textareas fell below the 44px touch-target baseline. Confirmed by the RED regression run reproducing the exact LEAD-018 measurements (32px/40px/40px).

## Workaround

- Describe any temporary mitigation and remaining risk.
- None needed. The fix is a shared CSS rule; no per-component workaround remains.

## Permanent Fix Plan

- Describe the intended durable fix.
- Added unlayered CSS rules in `apps/web/src/index.css` enforcing `min-height: 2.75rem` (44px) on `.app-shell .input`, `.app-shell .select`, `.app-shell .file-input`, and `.app-shell .textarea`. These mirror the existing `.app-shell .btn`/`.app-shell .menu a` touch-target policy. Being unlayered, they override DaisyUI's layered sizing defaults (including `.input-sm`) at all viewports, consistent with the codebase's global 44px button policy. No component changes were needed — one shared rule fixes every affected control and any future form field.

## Regression Coverage Needed

- List tests, fixtures, reproductions, alerts, or docs updates needed.
- Added e2e regression `keeps every visible source form control at or above the 44px touch target on mobile` in `apps/web/e2e/source-import.spec.ts`. It opens `/sources` at 375×812 with one project mocked, opens the navigation sheet, and asserts every visible `.app-shell .input/.select/.file-input/.textarea` has height ≥44px. Verified RED (32px/40px/40px) before the fix and GREEN after.

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
- 2026-07-30 - Root cause confirmed (DaisyUI form-control defaults below 44px; no shared rule covered fields). Fix: unlayered `.app-shell` min-height 2.75rem for input/select/file-input/textarea in `apps/web/src/index.css`. Regression test added to `apps/web/e2e/source-import.spec.ts` (RED→GREEN). Full e2e suite, web unit tests, lint, and web typecheck all green.
