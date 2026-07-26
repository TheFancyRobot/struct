---
note_type: bug
template_version: 2
contract_version: 1
title: Source import notice ignores the source library content gutter
bug_id: BUG-0047
status: fixed
severity: sev-3
category: logic
reported_on: '2026-07-26'
fixed_on: '2026-07-26'
owner: bug-0047-attempt-1
created: '2026-07-26'
updated: '2026-07-26'
related_notes:
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Phase|PHASE-10 v1 Usable Research Workspace]]'
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_02_build-unified-three-pane-workspace-shell|STEP-10-02 Build Unified Three Pane Workspace Shell]]'
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_03_deliver-source-catalog-and-non-blocking-import|STEP-10-03 Deliver Source Catalog and Non-Blocking Import]]'
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]]'
  - '[[01_Architecture/System_Overview|System Overview]]'
  - '[[01_Architecture/Integration_Map|Integration Map]]'
  - '[[04_Decisions/DEC-0013_use-tailwind-css-and-daisyui-with-a-custom-theme-for-frontend-styling|DEC-0013 Use Tailwind CSS and DaisyUI with a Custom Theme for Frontend Styling]]'
  - '[[04_Decisions/DEC-0014_use-solidjs-vite-8-and-solid-router-for-frontend-runtime|DEC-0014 Use SolidJS, Vite 8, and Solid Router for Frontend Runtime]]'
  - '[[03_Bugs/BUG-0044_navigation-discovery-sections-lack-direct-creation-actions|BUG-0044 Navigation Discovery Sections Lack Direct Creation Actions]]'
  - '[[03_Bugs/BUG-0046_global-source-import-is-blocked-by-project-selection|BUG-0046 Global Source Import Is Blocked by Project Selection]]'
  - '[[02_Phases/Phase_11_v1_1_research_usability/Phase|PHASE-11 v1.1 Research Usability]]'
tags:
  - agent-vault
  - bug
---

# BUG-0047 - Source import notice ignores the source library content gutter

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Source import notice ignores the source library content gutter.
- Related notes: Phase 10 source catalog/import, workspace shell, responsive behavior, frontend styling, and related source navigation fixes.

## Observed Behavior

- On the global source-library screen, the “Create a project before importing sources” notice reaches the workspace edge while the heading and empty state are inset, making the feedback surface visually misaligned.

## Expected Behavior

- The notice uses the same responsive source-library content gutter as the heading and list: 24px on desktop, 16px on compact widths, with the existing 8px spacing rhythm between adjacent elements.

## Reproduction Steps

1. Open the source library without a selected project.
2. Inspect the prerequisite notice at the top of the central workspace.
3. Observe that its left and right edges do not align with the source-library heading and content.

## Scope / Blast Radius

- Affects the source-library empty state, import prerequisite feedback, responsive central workspace layout, visual consistency, and accessible reading flow.

## Suspected Root Cause

- The notice is rendered outside the source-library content wrapper or lacks the wrapper’s responsive horizontal padding.

## Confirmed Root Cause

- Pending code inspection. The supplied desktop screenshot shows the notice at the workspace edge while adjacent source-library content is inset.
- Confirmed 2026-07-26 (supersedes "Pending" above). The source-library content wrapper in `apps/web/src/pages/SourcesPage.tsx` was `<section class="mx-auto max-w-4xl space-y-4">` with no responsive horizontal padding. The import notice (`SourceImportPanel` card and the "Attach new sources to a project" card) and the bare "Source library" heading/list were all direct children of that unpadded wrapper, so on compact workspace widths they sat flush against the workspace edge with no shared content gutter. The bare heading/list lacked any inset, while the cards' content was visually inset by their own `p-4`, so the heading and the cards did not share a common left gutter. The root cause is the missing wrapper-level responsive horizontal padding, not a per-element defect.

## Workaround

- No functional workaround is required; the defect is visual. Users can continue, but the misalignment weakens hierarchy and makes the notice appear detached from its screen.

## Permanent Fix Plan

- Render the notice within the same max-width/content-gutter wrapper as the source-library content. Preserve semantic alert/accessible feedback behavior and avoid changing touch-target spacing.
- Completed 2026-07-26. Added the established responsive content gutter to the shared source-library wrapper, matching the existing outer `p-4 sm:p-6` content-gutter convention already used by `ProjectSwitcher`'s root `<section>` (`NotebookView`'s root `<section class="notebook-workspace space-y-5">` has no outer gutter; its `p-4 sm:p-6` is only on its internal hero header card, so it does not establish this outer convention). The wrapper is now `<section class="mx-auto max-w-4xl space-y-4 px-4 sm:px-6">`, giving a 16px gutter on compact widths and 24px at the `sm` (640px+) breakpoint. The import notice (cards) and the "Source library" heading/list now share the same left gutter, and neither touches the workspace edge. Vertical spacing (`space-y-4` between sections, `space-y-2` within the list) and accessible semantics are unchanged.
- Changed files:
  - `apps/web/src/pages/SourcesPage.tsx` — added `px-4 sm:px-6` to the source-library content wrapper (one-line class change).
  - `apps/web/e2e/source-import.spec.ts` — added browser regression coverage at desktop (1440px) and compact (375px) breakpoints.

## Regression Coverage Needed

- Add visual/browser coverage at desktop and compact breakpoints verifying the alert aligns to the source-library gutter, does not touch viewport/workspace edges, and retains readable contrast and accessible announcement semantics.
- Added 2026-07-26. New Playwright test "aligns the source-library notice and content to the shared responsive gutter at desktop and compact widths" in `apps/web/e2e/source-import.spec.ts`. It loads the global source library (`/sources`) with mocked empty workspace catalog at 1440px and 375px and asserts: (1) the import notice (`section[aria-labelledby="source-import-heading"]`) and the "Source library" heading share the same left edge (gutter alignment, `|Δx| ≤ 1`); (2) both are inset from the workspace scroll-container edge by at least the gutter (`≥ 12px`, failing at 0 when unpadded); (3) the import notice retains `aria-labelledby="source-import-heading"` (accessible feedback semantics preserved).
- Validation run 2026-07-26: `apps/web` typecheck clean (`tsc --noEmit` exit 0); web unit tests (excluding `e2e/`) 77 pass / 0 fail; `e2e/source-import.spec.ts` 4 pass / 0 fail including the new gutter test at both breakpoints. The new test was verified to fail without the fix (`importLeft - contentLeft` = 0) and pass with it, confirming it guards the regression.

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- Phase: [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|Phase 10 v1 usable research workspace]]
- Workspace shell: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_02_build-unified-three-pane-workspace-shell|STEP-10-02 Build Unified Three Pane Workspace Shell]]
- Source catalog/import: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_03_deliver-source-catalog-and-non-blocking-import|STEP-10-03 Deliver Source Catalog and Non-Blocking Import]]
- Responsive/accessibility: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]]
- Architecture: [[01_Architecture/System_Overview|System Overview]] and [[01_Architecture/Integration_Map|Integration Map]]
- Frontend design/runtime: [[04_Decisions/DEC-0013_use-tailwind-css-and-daisyui-with-a-custom-theme-for-frontend-styling|DEC-0013 Use Tailwind CSS and DaisyUI with a Custom Theme for Frontend Styling]] and [[04_Decisions/DEC-0014_use-solidjs-vite-8-and-solid-router-for-frontend-runtime|DEC-0014 Use SolidJS, Vite 8, and Solid Router for Frontend Runtime]]
- Related navigation/source-library fixes: [[03_Bugs/BUG-0044_navigation-discovery-sections-lack-direct-creation-actions|BUG-0044 Navigation Discovery Sections Lack Direct Creation Actions]] and [[03_Bugs/BUG-0046_global-source-import-is-blocked-by-project-selection|BUG-0046 Global Source Import Is Blocked by Project Selection]]
- Follow-on usability: [[02_Phases/Phase_11_v1_1_research_usability/Phase|PHASE-11 v1.1 Research Usability]]
<!-- AGENT-END:bug-related-notes -->

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-07-26 - Reported.
- 2026-07-26 - Screenshot evidence and UI/UX spacing recommendation recorded.
<!-- AGENT-END:bug-timeline -->
- 2026-07-26 — Fixed by adding the responsive `px-4 sm:px-6` content gutter to the source-library wrapper in `apps/web/src/pages/SourcesPage.tsx`, aligning the import notice and source-library heading/list to a shared 16px/24px gutter. Browser regression coverage added at 1440px and 375px; typecheck, unit tests, and the source-import e2e suite pass.
