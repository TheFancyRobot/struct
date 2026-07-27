---
note_type: bug
template_version: 2
contract_version: 1
title: Add source view shows only error and no fields or options
bug_id: BUG-0055
status: fixed
severity: sev-3
category: logic
reported_on: '2026-07-27'
fixed_on: '2026-07-27'
owner: bug0055-a3
created: '2026-07-27'
updated: '2026-07-27'
related_notes:
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Phase|PHASE-10 v1 Usable Research Workspace]]'
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_02_build-unified-three-pane-workspace-shell|STEP-10-02 Build Unified Three Pane Workspace Shell]]'
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_03_deliver-source-catalog-and-non-blocking-import|STEP-10-03 Deliver Source Catalog and Non-Blocking Import]]'
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]]'
  - '[[03_Bugs/BUG-0042_center-workspace-is-fragmented-by-redundant-title-chrome-and-card-framing|BUG-0042 Center workspace is fragmented by redundant title chrome and card framing]]'
  - '[[01_Architecture/System_Overview|System Overview]]'
  - '[[01_Architecture/Integration_Map|Integration Map]]'
  - '[[04_Decisions/DEC-0013_use-tailwind-css-and-daisyui-with-a-custom-theme-for-frontend-styling|DEC-0013 Use Tailwind CSS and DaisyUI with a Custom Theme for Frontend Styling]]'
  - '[[04_Decisions/DEC-0014_use-solidjs-vite-8-and-solid-router-for-frontend-runtime|DEC-0014 Use SolidJS, Vite 8, and Solid Router for Frontend Runtime]]'
tags:
  - agent-vault
  - bug
---

# BUG-0055 - Add source view shows only error and no fields or options

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Add source view shows only error and no fields or options.
- Related notes: none linked yet.

## Observed Behavior

- On the "Add source" view, only an error toast/banner is rendered. All expected fields, options, and UI elements (source type selection, file upload, URL input, metadata controls) are absent.
- The view appears to be stuck in an error state, showing the error but not the form.

## Expected Behavior

- The "Add source" view renders the full source-creation form with all fields and options. Any error should be displayed inline or as a dismissible banner without suppressing the underlying form.

## Reproduction Steps

1. Start the app with the API/catalog endpoint returning an error (e.g. `SourceCatalogRepo.list` failing, so `GET /api/projects/:id/sources` or `GET /api/sources` responds 503 `SourceCatalogUnavailable`).
2. Open the Add source view (`/sources` or `/projects/:id/sources`).
3. Observed: only the "Sources could not be loaded." error banner renders; the source-type selection, file upload, and metadata controls are absent.

## Scope / Blast Radius

- Affects `apps/web` source-registration UI, the `Add source` page, and the central workspace pane rendering. Related to the workspace shell layout, responsive behavior, and the source catalog step.

## Suspected Root Cause

- The `Add source` page may be rendering a top-level error section that obscures or replaces the form content. Could be a layout issue (similar to BUG-0042's center workspace fragmentation), a conditional render bug, or an error boundary swallowing the form. The workspace shell or the page component may be rendering the error in a way that collapses the remaining content.

## Confirmed Root Cause

- `apps/web/src/pages/SourcesPage.tsx` gated the entire source view behind `<Show when={catalog.error === undefined} fallback={...}>`. When the source-catalog fetch failed (the API returns 503 `SourceCatalogUnavailable` when `SourceCatalogRepo.list` fails), that `Show` rendered its standalone "Sources could not be loaded." fallback and replaced *all* of its children — including `SourceImportPanel` (the Add-source form with source-type selection, file upload, and metadata controls). So the user saw only the error banner and none of the fields/options.
- Note: the catalog-error gate must stay wrapping the `catalog()` read (SolidJS `resource()` throws the stored error when the resource is errored), so `catalog()` is never evaluated in the errored state. The fix preserves that gate for catalog-dependent content only.

## Workaround

- None. The form was unreachable whenever the catalog endpoint returned an error.

## Permanent Fix Plan

- Hoist `SourceImportPanel` and the library-mode attachment notice out of the catalog-error `Show` in `SourcesPage.tsx` so the Add-source form always renders, regardless of catalog state.
- Keep the `catalog.error === undefined` gate around only the catalog-dependent content (activity stream, background tray, source list) so `catalog()` is never read while errored and the "Sources could not be loaded." banner renders as a non-blocking alert with a Retry action instead of replacing the form.
- Implemented in this fix.

## Regression Coverage Needed

- Added e2e coverage in `apps/web/e2e/source-import.spec.ts`: "renders the add-source form fields and options even when the source catalog cannot be loaded" mocks a 503 catalog response and asserts the form (file input, Files/Paste/Dataset mode buttons, Add sources submit button) and the non-blocking "Sources could not be loaded." banner with Retry all render together.

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- Phase: [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|PHASE-10 v1 Usable Research Workspace]]
- Workspace shell: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_02_build-unified-three-pane-workspace-shell|STEP-10-02 Build Unified Three Pane Workspace Shell]]
- Source catalog/import: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_03_deliver-source-catalog-and-non-blocking-import|STEP-10-03 Deliver Source Catalog and Non-Blocking Import]]
- Responsive/accessibility: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]]
- Related bug: [[03_Bugs/BUG-0042_center-workspace-is-fragmented-by-redundant-title-chrome-and-card-framing|BUG-0042 Center workspace is fragmented by redundant title chrome and card framing]]
- Architecture: [[01_Architecture/System_Overview|System Overview]] and [[01_Architecture/Integration_Map|Integration Map]]
- Frontend design/runtime: [[04_Decisions/DEC-0013_use-tailwind-css-and-daisyui-with-a-custom-theme-for-frontend-styling|DEC-0013 Use Tailwind CSS and DaisyUI with a Custom Theme for Frontend Styling]] and [[04_Decisions/DEC-0014_use-solidjs-vite-8-and-solid-router-for-frontend-runtime|DEC-0014 Use SolidJS, Vite 8, and Solid Router for Frontend Runtime]]
<!-- AGENT-END:bug-related-notes -->

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-07-27 - Reported with screenshots showing error-only rendering.
- 2026-07-27 - Root cause confirmed in `SourcesPage.tsx`: the catalog-error `Show` replaced the Add-source form. Fixed by hoisting `SourceImportPanel` and the library notice out of the catalog-error gate while keeping `catalog()` gated so the resource error is never thrown into the render. Added e2e regression coverage; web typecheck, lint, unit tests, and the source-import/workspace-responsive/workspace-accessibility e2e specs all pass.
<!-- AGENT-END:bug-timeline -->
