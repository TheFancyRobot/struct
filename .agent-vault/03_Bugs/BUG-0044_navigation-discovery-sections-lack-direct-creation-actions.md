---
note_type: bug
template_version: 2
contract_version: 1
title: Navigation discovery sections lack direct creation actions
bug_id: BUG-0044
status: fixed
severity: sev-3
category: logic
reported_on: '2026-07-26'
fixed_on: '2026-07-26'
owner: bug0044_fix
created: '2026-07-26'
updated: '2026-07-26'
related_notes: |-
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Phase|PHASE-10 v1 Usable Research Workspace]]'
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_01_establish-workspace-and-project-lifecycle|STEP-10-01 Establish Workspace and Project Lifecycle]]'
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_02_build-unified-three-pane-workspace-shell|STEP-10-02 Build Unified Three Pane Workspace Shell]]'
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_03_deliver-source-catalog-and-non-blocking-import|STEP-10-03 Deliver Source Catalog and Non-Blocking Import]]'
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]]'
  - '[[01_Architecture/System_Overview|System Overview]]'
  - '[[01_Architecture/Integration_Map|Integration Map]]'
  - '[[04_Decisions/DEC-0013_use-tailwind-css-and-daisyui-with-a-custom-theme-for-frontend-styling|DEC-0013 Use Tailwind CSS and DaisyUI with a Custom Theme for Frontend Styling]]'
  - '[[04_Decisions/DEC-0014_use-solidjs-vite-8-and-solid-router-for-frontend-runtime|DEC-0014 Use SolidJS, Vite 8, and Solid Router for Frontend Runtime]]'
  - '[[02_Phases/Phase_11_v1_1_research_usability/Phase|PHASE-11 v1.1 Research Usability]]'
tags:
  - agent-vault
  - bug
---

# BUG-0044 - Navigation discovery sections lack direct creation actions

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Navigation discovery sections lack direct creation actions.
- Related notes: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_02_build-unified-three-pane-workspace-shell|STEP-10-02 Build Unified Three Pane Workspace Shell]].

## Observed Behavior

- The Projects and Sources navigation sections offered filtering and discovery only; creating a project required navigating to the root independently, while importing a source required locating the project Sources page.
- At the root, the navigation gave no indication that source creation depends on opening a project.

## Expected Behavior

- Projects exposes a direct, labeled action that opens the existing project-creation form.
- Sources exposes a direct, labeled action that opens the current project's existing source-import form; before a project is open, the action remains visibly disabled and explains the prerequisite.

## Reproduction Steps

1. Open the workspace root and inspect the Projects and Sources sidebar section headers.
2. Search either list, then look for a creation action within its section.
3. Observe that no action leads to the existing project-creation or source-import flow, and source creation's project prerequisite is not communicated.

## Scope / Blast Radius

- Affects the web workspace navigation on desktop and its mobile navigation sheet.
- Affects users creating notebooks or adding source documents, but does not change project or source API contracts, persistence, or existing creation forms.

## Suspected Root Cause

- The discovery navigation was added as a read-only list projection and was not connected to the established route-based project creation and source import entry points.

## Confirmed Root Cause

- Record the proven cause and decisive evidence.
- `WorkspaceNavigation` rendered section headings and searchable lists but no action affordances, even though project creation already existed at the workspace root and source import already existed on the project Sources page.

## Workaround

- Navigate to the workspace root to use the project form, or open a project and visit its Sources route to use the import form. This adds navigation overhead and leaves the source prerequisite undiscoverable at the root.

## Permanent Fix Plan

- Describe the intended durable fix.
- Implemented text-labeled `Add project` and `Add source` actions in the existing section headers. The actions deep-link to the existing forms; `Add source` remains visible and disabled with prerequisite guidance until a project is loaded. No modal, API, dependency, or duplicate creation flow was added.

## Regression Coverage Needed

- List tests, fixtures, reproductions, alerts, or docs updates needed.
- Added component coverage for both deep links and browser coverage for root disabled state, loaded-project source routing, mobile visibility, and 44px minimum target height. Validation: `bun test apps/web/src/components/workspace/workspace-shell.test.tsx` (1 pass), `bun run --filter @struct/web typecheck` (pass), `bun test apps/web/e2e/workspace-responsive.spec.ts` (7 pass), and `bun run lint` (pass).
- Follow-up correction: a loaded project with `struct:last-project-id` could briefly reach `/#project-create` and then automatically reopen the cached project. `HomePage` now treats Solid Router's `#project-create` location as explicit creation intent, skips only that cached reopen, and focuses the existing project-name input; ordinary root visits still reopen automatically.
- Follow-up validation: `bun test --timeout 30000 apps/web/e2e/workspace-responsive.spec.ts` (7 pass, 110 expectations), `bun run --filter @struct/web typecheck` (pass), and focused lint (pass).
- Accessibility correction: the root-state disabled `Add source` button now references the existing visible prerequisite helper with `aria-describedby="add-source-requirement"`; the tooltip-only `title` was removed. The loaded-project action remains a link to the source import heading and both controls retain their 44px minimum height. Validation: `bun test apps/web/e2e/workspace-responsive.spec.ts` (7 pass, including the accessible association assertion) and `bun run --cwd apps/web typecheck` (pass).

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- Phase: [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|Phase 10 v1 usable research workspace]]
- Step: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_02_build-unified-three-pane-workspace-shell|STEP-10-02 Build Unified Three Pane Workspace Shell]]
- Lifecycle: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_01_establish-workspace-and-project-lifecycle|STEP-10-01 Establish Workspace and Project Lifecycle]]
- Source catalog: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_03_deliver-source-catalog-and-non-blocking-import|STEP-10-03 Deliver Source Catalog and Non-Blocking Import]]
- Architecture: [[01_Architecture/System_Overview|System Overview]] and [[01_Architecture/Integration_Map|Integration Map]]
- Styling decision: [[04_Decisions/DEC-0013_use-tailwind-css-and-daisyui-with-a-custom-theme-for-frontend-styling|DEC-0013 Use Tailwind CSS and DaisyUI with a Custom Theme for Frontend Styling]]
- Runtime decision: [[04_Decisions/DEC-0014_use-solidjs-vite-8-and-solid-router-for-frontend-runtime|DEC-0014 Use SolidJS, Vite 8, and Solid Router for Frontend Runtime]]
- Responsive behavior: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]]
- Follow-on phase: [[02_Phases/Phase_11_v1_1_research_usability/Phase|PHASE-11 v1.1 Research Usability]]
<!-- AGENT-END:bug-related-notes -->

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-07-26 - Reported.
<!-- AGENT-END:bug-timeline -->
