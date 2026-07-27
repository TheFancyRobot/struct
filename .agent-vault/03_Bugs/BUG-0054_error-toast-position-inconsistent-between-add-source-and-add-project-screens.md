---
note_type: bug
template_version: 2
contract_version: 1
title: Error toast position inconsistent between add source and add project screens
bug_id: BUG-0054
status: fixed
severity: sev-3
category: frontend
reported_on: '2026-07-27'
fixed_on: '2026-07-27'
owner: bug-0054-worker-attempt-2
created: '2026-07-27'
updated: '2026-07-27'
related_notes: |-
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_03_deliver-source-catalog-and-non-blocking-import|STEP-10-03 Deliver Source Catalog and Non-Blocking Import]]'
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_01_establish-workspace-and-project-lifecycle|STEP-10-01 Establish Workspace and Project Lifecycle]]'
  - '[[04_Decisions/DEC-0013_use-tailwind-css-and-daisyui-with-a-custom-theme-for-frontend-styling|DEC-0013 Use Tailwind CSS and DaisyUI with a Custom Theme for Frontend Styling]]'
  - '[[04_Decisions/DEC-0014_use-solidjs-vite-8-and-solid-router-for-frontend-runtime|DEC-0014 Use SolidJS Vite 8 and Solid Router for Frontend Runtime]]'
tags:
  - agent-vault
  - bug
---

# BUG-0054 - Error toast position inconsistent between add source and add project screens

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- The add-source screen (`SourceImportPanel`) rendered its error/rejected feedback *below* the submit button and outside the `<form>`, while the add-project screen (`ProjectSwitcher`) and the canonical conversation composer (`ConversationPanel`) render feedback *above* the submit button and inside the `<form>`. The two creation screens therefore showed the same kind of failure toast in two different positions.

## Observed Behavior

- On the add-project screen, a failed create renders `<p class="alert alert-error text-sm">` inside `<form class="space-y-3">`, above the `Create project` button.
- On the add-source screen, a failed import rendered `<p class="alert alert-error mt-3 text-sm">` *after* the closing `</form>`, below the `Add sources` button; the `rejected` list likewise rendered below the form.

## Expected Behavior

- Both creation screens place error/rejected feedback in the same canonical position: inside the form, above the submit button, so the feedback precedes the retry action and the two screens stay visually consistent.

## Reproduction Steps

1. Open `/projects/<id>/sources` (or `/sources`).
2. Choose a file and submit `Add sources` against a failing import (e.g. HTTP 500).
3. Observe the error toast render below the submit button, outside the form.
4. Compare with the add-project screen (`/#project-create`): a failed create shows the toast above the `Create project` button, inside the form.

## Scope / Blast Radius

- `apps/web/src/components/SourceImportPanel.tsx` — the only affected component. Workspace and project-scoped source import, files/paste/dataset/folder modes.

## Suspected Root Cause

- The `SourceImportPanel` error and rejected `Show` blocks were placed as siblings *after* the `<form>` instead of inside it, diverging from the established `ProjectSwitcher` / `ConversationPanel` convention.

## Confirmed Root Cause

- In `SourceImportPanel.tsx` the `error()` and `rejected()` `Show` blocks were rendered after `</form>`, each with its own `mt-3`, so they sat below the submit button and outside the form's `space-y-3` flow. `ProjectSwitcher.tsx` (and `ConversationPanel.tsx`) keep equivalent feedback inside the form, above the action. The `SourceImportPanel` was the sole outlier.

## Workaround

- None; the inconsistency was purely positional and did not block the action.

## Permanent Fix Plan

- Move the `error()` and `rejected()` `Show` blocks inside the `<form>`, immediately before the submit button, and drop their now-redundant `mt-3` (the form's existing `space-y-3` provides the spacing). This matches `ProjectSwitcher` exactly: `<p class="alert alert-error text-sm" role="alert">` above the primary action, inside the form.

## Regression Coverage Needed

- Added an e2e test in `apps/web/e2e/source-import.spec.ts` that triggers a real HTTP 500 import failure and asserts the error toast is inside the form and its bottom edge is at or above the submit button's top edge — the same canonical position as the add-project screen. The page is closed in `finally` so failed assertions cannot leak browser resources.
- Validation: `bun test --preload ./apps/web/test/solid-test-preload.ts --max-concurrency 1 ./apps/web/src/components/source-import-panel.test.tsx ./apps/web/src/components/project-switcher.test.tsx` — 7 pass, 0 fail.
- Validation: `bun test --timeout 180000 --max-concurrency 1 ./apps/web/e2e/source-import.spec.ts` — 5 pass, 0 fail (incl. new regression test).
- Validation: `bun test --timeout 180000 --max-concurrency 1 ./apps/web/e2e/project-lifecycle.spec.ts` — 11 pass, 0 fail (add-project error path unaffected).
- Validation: `bun test --timeout 180000 --max-concurrency 1 ./apps/web/e2e/workspace-responsive.spec.ts` — 7 pass, 0 fail.
- Validation: `bun --bun tsc --noEmit --project apps/web/tsconfig.json` — passed.
- Validation: `bunx eslint` on the three changed files — passed.

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- Step: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_03_deliver-source-catalog-and-non-blocking-import|STEP-10-03 Deliver Source Catalog and Non-Blocking Import]]
- Step: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_01_establish-workspace-and-project-lifecycle|STEP-10-01 Establish Workspace and Project Lifecycle]]
- Styling decision: [[04_Decisions/DEC-0013_use-tailwind-css-and-daisyui-with-a-custom-theme-for-frontend-styling|DEC-0013 Use Tailwind CSS and DaisyUI with a Custom Theme for Frontend Styling]]
- Runtime decision: [[04_Decisions/DEC-0014_use-solidjs-vite-8-and-solid-router-for-frontend-runtime|DEC-0014 Use SolidJS Vite 8 and Solid Router for Frontend Runtime]]
<!-- AGENT-END:bug-related-notes -->

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-07-27 - Reported.
- 2026-07-27 - Root cause confirmed: `SourceImportPanel` rendered error/rejected feedback after the form, diverging from the `ProjectSwitcher`/`ConversationPanel` above-action convention.
- 2026-07-27 - Fixed by moving the feedback `Show` blocks inside the form, above the submit button; added e2e regression coverage; all focused validation passed.
<!-- AGENT-END:bug-timeline -->
