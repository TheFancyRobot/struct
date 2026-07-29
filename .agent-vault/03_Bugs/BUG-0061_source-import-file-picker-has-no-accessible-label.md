---
note_type: bug
template_version: 2
contract_version: 1
title: Source import file picker has no accessible label
bug_id: BUG-0061
status: fixed
severity: sev-1
category: accessibility
reported_on: '2026-07-28'
fixed_on: '2026-07-29'
owner: bug-0061-attempt-1
created: '2026-07-28'
updated: '2026-07-29'
related_notes:
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]]'
  - '[[05_Sessions/2026-07-28-204323-complete-responsive-accessibility-and-theme-behavior-codex|SESSION-2026-07-28-204323 Codex session for Complete Responsive Accessibility and Theme Behavior]]'
tags:
  - agent-vault
  - bug
---

# BUG-0061 - Source import file picker has no accessible label

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Source import file picker has no accessible label.
- Related notes: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]], [[05_Sessions/2026-07-28-204323-complete-responsive-accessibility-and-theme-behavior-codex|SESSION-2026-07-28-204323 Codex session for Complete Responsive Accessibility and Theme Behavior]].
- **Observed:** Axe reports critical `label` violations for the required `.file-input` in Files, Dataset, and Folder modes on global and project Sources views. The input has no label, `aria-label`, `aria-labelledby`, title, or placeholder.
- **Expected:** A visible associated label identifies the picker and accepted content for the selected mode.
- **Reproduction:** Open `/sources` or `/projects/:projectId/sources` in either theme and run `agent-browser a11y --tags wcag2a,wcag2aa`.
- **Evidence:** `.local/ui-audit/dark/project-sources-dark-a11y.json`, `.local/ui-audit/dark/global-sources-dark-a11y.json`, and light/mobile screenshots.
- **Standards:** WCAG 1.3.1, 3.3.2, and 4.1.2.

## Observed Behavior

- Describe what actually happens.
Axe reports a critical `label` violation for the required `.file-input` element rendered by `SourceImportPanel` in Files, Dataset, and Folder modes on both `/sources` and `/projects/:projectId/sources` (light and dark themes). The `<input type="file">` had no `<label>`, `aria-label`, `aria-labelledby`, `title`, or `placeholder`. This fails WCAG 1.3.1, 3.3.2, and 4.1.2.

## Expected Behavior

- Describe what should happen instead.
A visible `<label>` element wraps the file input, identifying the picker and its accepted content for the selected mode. The label text adapts: "Select files to import" (Files), "Select a dataset to import (.csv, .tsv, .json, .jsonl, .parquet)" (Dataset), "Select a folder to import" (Folder). Implicit labeling satisfies axe `label`, WCAG 1.3.1, 3.3.2, and 4.1.2.

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
The file `<input type="file">` was rendered standalone with no associated label. The paste-mode fields in the same component already used `<label class="form-control block">` wrapping, but the file/folder/dataset branch rendered a bare `<input class="file-input ...">`. Axe's `label` rule fires whenever a form control has neither an implicit (wrapping `<label>`) nor explicit (`for`/`aria-label`/`aria-labelledby`) label association. Decisive evidence: `.local/ui-audit/dark/global-sources-files-dark-a11y.json` violation `id: label`, target `.file-input`, html `<input class="file-input file-input-bordered w-full" type="file" multiple="" required="">`.

## Workaround

- Describe any temporary mitigation and remaining risk.

## Permanent Fix Plan

- Describe the intended durable fix.
Wrapped the file `<input>` in `<label class="form-control block">` with a visible `<span class="label-text">` whose text derives from a `pickerLabel()` helper that switches on the active import mode (files / dataset / folder). This mirrors the existing paste-mode label pattern in the same component and provides implicit label association. Files changed: `apps/web/src/components/SourceImportPanel.tsx`.

## Regression Coverage Needed

- List tests, fixtures, reproductions, alerts, or docs updates needed.
Added SSR regression test in `apps/web/src/components/source-import-panel.test.tsx`: "provides a visible accessible label for the file picker in the default files mode" — asserts the label text "Select files to import" is present and that a `<label>` wraps the `file-input` (implicit labeling). The e2e suite (`e2e/source-import.spec.ts`) covers mode switching and the remaining modes in a real browser.

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
- 2026-07-29 - Root cause confirmed (bare input, no label). Fix applied in `SourceImportPanel.tsx`: wrapped file input in a `<label>` with mode-specific visible text. Regression test added. Typecheck clean; 77/77 component/unit tests pass. The real-browser e2e suite requires a running app server, Chromium, and database stack, so it was not part of this focused validation.
