---
note_type: bug
template_version: 2
contract_version: 1
title: light-dark-mode-switch-positioned-awkwardly-and-covered-by-error-toast
bug_id: BUG-0056
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
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]]'
  - '[[03_Bugs/BUG-0055_add-source-view-shows-only-error-and-no-fields-or-options|BUG-0055]]'
  - '[[01_Architecture/System_Overview|System Overview]]'
  - '[[04_Decisions/DEC-0013_use-tailwind-css-and-daisyui-with-a-custom-theme-for-frontend-styling|DEC-0013]]'
  - '[[04_Decisions/DEC-0014_use-solidjs-vite-8-and-solid-router-for-frontend-runtime|DEC-0014]]'
tags:
  - agent-vault
  - bug
---

# BUG-0056 - light-dark-mode-switch-positioned-awkwardly-and-covered-by-error-toast

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- The light/dark mode toggle button is positioned in the ConversationWorkspace top bar, right-aligned alongside primary navigation controls (Menu, Navigation, Evidence). The toggle feels disconnected from the rest of the UI — "living in its own world" — and is visually crowded by the error toast/alert when one is rendered.
- Related notes: PHASE-10 workspace shell, STEP-10-02 workspace shell build, STEP-10-07 theme behavior, BUG-0055 (error toast positioning), System Overview, DEC-0013 (Tailwind/DaisyUI theming), DEC-0014 (SolidJS/Vite runtime).

## Observed Behavior

- The theme toggle button (`Dark`/`Light`) sits in the `ConversationWorkspace` top bar, right-aligned next to the Evidence button, sharing horizontal space with primary navigation toggles (Menu, Navigation).
- The top bar is `md:absolute md:inset-x-0 md:top-0 md:pointer-events-none` with `z-20`, floating above the scrollable content.
- When an error alert (e.g., `alert alert-error` section for "Projects could not be loaded" or "Sources could not be loaded") renders at the top of the content, the absolute top bar overlaps the alert. The error toast appears to cover or compete with the theme toggle.
- The toggle is the only "settings" element and feels orphaned — it doesn't belong with primary navigation controls but is forced to share that row.

## Expected Behavior

- The theme toggle should be positioned where it doesn't compete with primary navigation or overlap with content-level alerts/toasts.
- Recommended placement: **bottom of the sidebar (WorkspaceNavigation)**, above the footer tagline. This follows the common pattern of putting appearance/theme controls in the secondary navigation area, separating them from primary nav controls.
- Alternatively, if a user profile/settings area exists or is planned, the toggle should live there.
- The top bar should have sufficient z-index or the content should have compensating padding so that error alerts never overlap fixed chrome.

## Reproduction Steps

1. Open the web app.
2. Navigate to the home page or sources page.
3. Observe the theme toggle button in the top bar — it sits alongside navigation controls, with no clear visual grouping.
4. Trigger an error state (e.g., disconnect network, or navigate to a scenario where projects/sources fail to load).
5. Observe the error alert rendering at the top of the content area, partially obscured by the absolute-positioned top bar. The toggle button appears to be covered or competing with the error toast.

## Scope / Blast Radius

- `apps/web/src/components/workspace/WorkspaceShell.tsx` — `ConversationWorkspace` top bar layout and `z-20` absolute positioning.
- `apps/web/src/App.tsx` — theme state management.
- Error alerts rendered inside page content (`ProjectPage.tsx`, `SourcesPage.tsx`) that start at the top of the scrollable content area.
- Affects all pages within the workspace shell.

## Suspected Root Cause

- The theme toggle was placed in the top bar as a convenience button without a dedicated settings area. It shares the top bar with primary navigation toggles, creating visual crowding.
- The top bar uses `md:absolute md:top-0` without adding compensating `pt-` padding to the content area below it, causing the absolute bar to overlap content elements (including error alerts) when they render at the top.
- No z-index scale was defined — the top bar uses `z-20` but error alerts don't set z-index, creating an implicit stacking conflict.

## Confirmed Root Cause

- Pending code review of the top bar layout and content padding strategy.

## Workaround

- None. The toggle is the only theme control available; users cannot change theme if the top bar is obscured.

## Permanent Fix Plan

- Move the theme toggle to the bottom of the sidebar (`WorkspaceNavigation`), above the footer tagline "Source-grounded research with inspectable evidence." This separates utility settings from primary navigation and avoids overlap with content-level alerts.
- Add compensating padding-top to the scrollable content area equal to the top bar height, or adjust the z-index hierarchy so fixed chrome never obscures interactive content elements.

## Regression Coverage Needed

- Verify theme toggle remains accessible when error alerts are displayed.
- Verify no layout shift when moving toggle from top bar to sidebar.
- Check responsive breakpoints: mobile (toggle should still be reachable when sidebar is a sheet), tablet, desktop.
- Ensure z-index hierarchy is documented and consistent across all fixed/absolute elements.

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- Phase: [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|PHASE-10 v1 Usable Research Workspace]]
- Workspace shell build: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_02_build-unified-three-pane-workspace-shell|STEP-10-02 Build Unified Three Pane Workspace Shell]]
- Theme/responsive behavior: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]]
- Related bug: [[03_Bugs/BUG-0055_add-source-view-shows-only-error-and-no-fields-or-options|BUG-0055]]
- Architecture: [[01_Architecture/System_Overview|System Overview]]
- Theming decision: [[04_Decisions/DEC-0013_use-tailwind-css-and-daisyui-with-a-custom-theme-for-frontend-styling|DEC-0013]]
- Runtime decision: [[04_Decisions/DEC-0014_use-solidjs-vite-8-and-solid-router-for-frontend-runtime|DEC-0014]]
<!-- AGENT-END:bug-related-notes -->

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-07-27 - Reported: theme toggle awkwardly positioned in top bar, overlapped by error toast. UI/UX guidelines recommend moving to sidebar bottom and fixing z-index/padding conflict.
<!-- AGENT-END:bug-timeline -->
