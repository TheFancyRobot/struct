---
note_type: bug
template_version: 2
contract_version: 1
title: Add source view shows only error and no fields or options
bug_id: BUG-0055
status: new
severity: sev-3
category: logic
reported_on: '2026-07-27'
fixed_on: ''
owner: ''
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

1. List the exact setup state.
2. List the user or developer actions.
3. Record the observed result.

## Scope / Blast Radius

- Affects `apps/web` source-registration UI, the `Add source` page, and the central workspace pane rendering. Related to the workspace shell layout, responsive behavior, and the source catalog step.

## Suspected Root Cause

- The `Add source` page may be rendering a top-level error section that obscures or replaces the form content. Could be a layout issue (similar to BUG-0042's center workspace fragmentation), a conditional render bug, or an error boundary swallowing the form. The workspace shell or the page component may be rendering the error in a way that collapses the remaining content.

## Confirmed Root Cause

- Pending inspection of the Add source page component and its error rendering path.

## Workaround

- None identified.

## Permanent Fix Plan

- Ensure the error banner/toast renders without suppressing the underlying form. Errors should be non-blocking or dismissible, and the form fields must always be visible.

## Regression Coverage Needed

- Add browser/e2e coverage verifying that the Add source view renders all expected fields and options even when an initial error state is triggered.

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
<!-- AGENT-END:bug-timeline -->
