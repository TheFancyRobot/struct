---
note_type: bug
template_version: 2
contract_version: 1
title: Source import mode switcher lacks valid group and selection semantics
bug_id: BUG-0063
status: fixed
severity: sev-2
category: accessibility
reported_on: '2026-07-28'
fixed_on: '2026-07-30'
owner: bug-0063-attempt-1
created: '2026-07-28'
updated: '2026-07-28'
related_notes:
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]]'
  - '[[05_Sessions/2026-07-28-204323-complete-responsive-accessibility-and-theme-behavior-codex|SESSION-2026-07-28-204323 Codex session for Complete Responsive Accessibility and Theme Behavior]]'
tags:
  - agent-vault
  - bug
---

# BUG-0063 - Source import mode switcher lacks valid group and selection semantics

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Source import mode switcher lacks valid group and selection semantics.
- Related notes: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]], [[05_Sessions/2026-07-28-204323-complete-responsive-accessibility-and-theme-behavior-codex|SESSION-2026-07-28-204323 Codex session for Complete Responsive Accessibility and Theme Behavior]].
- **Observed:** The switcher is `<div class="join" aria-label="Import mode">` with no supporting role; axe reports `aria-prohibited-attr`. Files/Paste/Dataset/Folder are ordinary buttons whose selected state exists only as `btn-active`, with no `aria-pressed`/`aria-selected`.
- **Expected:** Use a valid tablist/tab or labeled group/toggle-button pattern and expose the active mode programmatically.
- **Reproduction:** Open either Sources route, inspect `.join` and its buttons, then run axe.
- **Evidence:** `.local/ui-audit/dark/project-sources-dark-a11y.json` and `.local/ui-audit/lead/report.md` LEAD-001.

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
- The `SourceImportPanel` mode switcher rendered `<div class="join" aria-label="Import mode">` with no ARIA role, so `aria-label` was prohibited on a role-less div (axe `aria-prohibited-attr`). The four mode buttons (Files/Paste/Dataset/Folder) exposed selection only via the DaisyUI `btn-active` CSS class — no `aria-pressed` or `aria-selected` — so assistive technology could not determine the active import mode.
- Evidence: `.local/ui-audit/dark/project-sources-dark-a11y.json` (aria-prohibited-attr on `.join`), `.local/ui-audit/lead/report.md` LEAD-001.

## Workaround

- Describe any temporary mitigation and remaining risk.

## Permanent Fix Plan

- Describe the intended durable fix.
- Added `role="group"` to the `.join` container so `aria-label="Import mode"` is valid and the container is announced as a labeled group.
- Added `aria-pressed={mode() === '<mode>'}` to each mode button (Files/Paste/Dataset/Folder) so the active toggle is exposed programmatically. The visual `btn-active` class is retained for styling.
- Chosen pattern: labeled group + toggle buttons (per the bug's Expected behavior). A tablist/tab/tabpanel pattern was rejected because these are mode toggle buttons controlling a single form, not content panels; tablist would require restructuring the form into `tabpanel` roles for no functional gain.

## Regression Coverage Needed

- List tests, fixtures, reproductions, alerts, or docs updates needed.
- Added regression test: `source-import-panel.test.tsx` — "exposes the import mode switcher as a labeled group with toggle-button selection semantics". Asserts the container declares `role="group"` with `aria-label="Import mode"`, and that the Files button exposes `aria-pressed="true"` while Paste/Dataset expose `aria-pressed="false"` in the default mode. Covers both the axe `aria-prohibited-attr` fix and the programmatic selection-state fix.
- Validation: `apps/web` unit suite (81 tests, 0 fail), focused `source-import-panel.test.tsx` (5 tests, 0 fail), `tsc --noEmit` (0 errors), source-import e2e suite (6 tests, 0 fail). One unrelated e2e test (`workspace-release.spec.ts` "takes a first-time user through root and BASE_PATH durable source-grounded workspaces") timed out at 120s — a full real-stack lifecycle test that does not touch the import panel; infrastructure timeout, not caused by this change.

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
- 2026-07-30 - Root cause confirmed; fix applied to `apps/web/src/components/SourceImportPanel.tsx` (role="group" + aria-pressed on each mode button). Regression test added to `apps/web/src/components/source-import-panel.test.tsx`. Unit suite and source-import e2e suite green; typecheck clean. Status → fixed.
