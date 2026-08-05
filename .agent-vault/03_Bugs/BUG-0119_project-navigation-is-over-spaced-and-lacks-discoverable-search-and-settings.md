---
note_type: bug
template_version: 2
contract_version: 1
title: Project navigation is over-spaced and lacks discoverable search and settings
bug_id: BUG-0119
status: fixed
severity: sev-3
category: frontend
reported_on: '2026-08-05'
fixed_on: '2026-08-05'
owner: bug_0119_attempt_1
created: '2026-08-05'
updated: '2026-08-05'
related_notes: |2-
    - '[[02_Phases/Phase_10_v1_usable_research_workspace/Phase|PHASE-10 v1 Usable Research Workspace]]'
    - '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_02_build-unified-three-pane-workspace-shell|STEP-10-02 Build Unified Three Pane Workspace Shell]]'
    - '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]]'
    - '[[02_Phases/Phase_10B_brand_implementation/Phase|PHASE-10B Brand Implementation]]'
    - '[[01_Architecture/System_Overview|System Overview]]'
    - '[[04_Decisions/DEC-0013_use-tailwind-css-and-daisyui-with-a-custom-theme-for-frontend-styling|DEC-0013 Use Tailwind CSS and DaisyUI with a Custom Theme for Frontend Styling]]'
    - '[[04_Decisions/DEC-0014_use-solidjs-vite-8-and-solid-router-for-frontend-runtime|DEC-0014 Use SolidJS Vite 8 and Solid Router for Frontend Runtime]]'
    - '[[04_Decisions/DEC-0024_require-full-browser-coverage-and-design-consistency-audit-before-phase-11|DEC-0024 Require Full Browser Coverage and Design Consistency Audit Before Phase 11]]'
    - '[[03_Bugs/BUG-0043_workspace-navigation-lacks-project-source-and-recent-discovery-sections|BUG-0043 Workspace Navigation Lacks Project Source and Recent Discovery Sections]]'
    - '[[03_Bugs/BUG-0044_navigation-discovery-sections-lack-direct-creation-actions|BUG-0044 Navigation Discovery Sections Lack Direct Creation Actions]]'
    - '[[03_Bugs/BUG-0118_project-chat-ui-lacks-recognizable-conversation-layout-and-collapsible-columns|BUG-0118 Project Chat UI Lacks Recognizable Conversation Layout and Collapsible Columns]]'
tags:
  - agent-vault
  - bug
---

# BUG-0119 - Project navigation is over-spaced and lacks discoverable search and settings

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Project navigation is over-spaced and lacks discoverable search and settings.
- The project navigation consumes too much space, exposes search fields before they are needed, does not make Settings discoverable, and ends with unexplained low-value text/elements.
- Use the attached Open Notebook sidebar as the interaction and information-density reference, limited to destinations and utilities Struct actually supports.

## Observed Behavior

- Excessive vertical whitespace and low-value elements make the navigation feel sparse and awkward rather than scannable.
- Search inputs are persistently visible instead of being revealed on demand.
- Settings are not discoverable from the primary navigation.
- Unexplained text at the bottom of the sidebar has no clear action or relationship to the current route.
- Evidence: [Open Notebook navigation reference](/Users/dino/Desktop/Screenshot 2026-08-05 at 10.23.11 AM.png).

## Expected Behavior

- Present a compact, clearly grouped vertical menu with icons, labels, a strong active state, restrained spacing, and separators only where they clarify hierarchy.
- Show each search input only after the user activates a clearly labeled spyglass button; move focus into the revealed input, support Escape/close, and preserve accessible names and keyboard order.
- Include a clearly labeled Settings destination in a predictable management/utility location.
- Remove unexplained footer prose and unnecessary elements; retain only useful, interactive utilities supported by Struct.
- Follow the Open Notebook design philosophy without copying unsupported sections such as Podcasts, Models, Transformations, Language, or Sign Out unless Struct already needs them.

## Reproduction Steps

1. Open any project route on a desktop viewport.
2. Inspect the left navigation from top to bottom.
3. Observe the persistent search inputs, large unused gaps, missing Settings destination, and unexplained footer text/elements.
4. Compare the information density, grouping, active-state treatment, and utility placement with the attached Open Notebook reference.

## Scope / Blast Radius

- Affects the shared `apps/web` workspace navigation across project routes and any global/source navigation rendered by the same component.
- Search disclosure changes must preserve current filtering behavior, no-results feedback, route state, focus management, responsive drawer behavior, and 44px touch targets.
- This is a frontend information-architecture and interaction defect; no API or persistence change is currently indicated.

## Suspected Root Cause

- The navigation accumulated standalone search fields, explanatory copy, and route controls without a compact hierarchy or utility policy.
- Settings discovery and bottom-utility ownership appear absent from the shared navigation contract.
- This remains a theory until the shared navigation component and all route callers are traced.

## Confirmed Root Cause

- Not yet confirmed. Reproduce in the running app and inspect the shared navigation component, search state, route configuration, and responsive variants before implementation.
- Confirmed in `WorkspaceNavigation`: both search fields were unconditional and the shared footer contained non-actionable prose; the only supported user setting was an unlabeled theme action, and no Settings route exists.
- Fixed by making both existing filters on-demand disclosures with focus and Escape/close handling, tightening section spacing, removing the footer copy, and labeling the existing theme action as Settings rather than adding a dead route.
- Correction: `/settings` now exists through BUG-0120. The navigation fix links to that real route; theme controls remain theme controls.

## Workaround

- Users can use the visible search fields, but there is no discoverable navigation workaround for Settings or the unexplained footer content.

## Permanent Fix Plan

- Reuse the existing SolidJS navigation, router, icons, and shared DaisyUI/theme primitives.
- Collapse persistent search controls behind native buttons with `aria-expanded`/`aria-controls`, rendering the existing search inputs only while invoked.
- Reorganize supported destinations into the smallest useful groups, add the existing Settings destination, and delete non-actionable footer copy or duplicate controls.
- Keep pane-collapse behavior in BUG-0118 so this bug does not build a second sidebar state system.

## Regression Coverage Needed

- Add one focused component check for compact supported navigation, active-route state, Settings discovery, and conditional search rendering/focus.
- Add one browser regression covering spyglass open/close, keyboard/Escape behavior, filtering/no-results behavior, navigation at desktop and mobile widths, and removal of unexplained footer text.
- Capture approved light/dark desktop screenshots and verify existing focus, touch-target, routing, and responsive-drawer checks remain green.

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- Phase: [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|Phase 10 v1 usable research workspace]]
- Step: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_02_build-unified-three-pane-workspace-shell|STEP-10-02 Build Unified Three Pane Workspace Shell]]
- [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]]
- [[02_Phases/Phase_10B_brand_implementation/Phase|PHASE-10B Brand Implementation]]
- [[01_Architecture/System_Overview|System Overview]]
- [[04_Decisions/DEC-0013_use-tailwind-css-and-daisyui-with-a-custom-theme-for-frontend-styling|DEC-0013 Use Tailwind CSS and DaisyUI with a Custom Theme for Frontend Styling]]
- [[04_Decisions/DEC-0014_use-solidjs-vite-8-and-solid-router-for-frontend-runtime|DEC-0014 Use SolidJS Vite 8 and Solid Router for Frontend Runtime]]
- [[04_Decisions/DEC-0024_require-full-browser-coverage-and-design-consistency-audit-before-phase-11|DEC-0024 Require Full Browser Coverage and Design Consistency Audit Before Phase 11]]
- [[03_Bugs/BUG-0043_workspace-navigation-lacks-project-source-and-recent-discovery-sections|BUG-0043 Workspace Navigation Lacks Project Source and Recent Discovery Sections]]
- [[03_Bugs/BUG-0044_navigation-discovery-sections-lack-direct-creation-actions|BUG-0044 Navigation Discovery Sections Lack Direct Creation Actions]]
- [[03_Bugs/BUG-0118_project-chat-ui-lacks-recognizable-conversation-layout-and-collapsible-columns|BUG-0118 Project Chat UI Lacks Recognizable Conversation Layout and Collapsible Columns]]
<!-- AGENT-END:bug-related-notes -->

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-08-05 - Reported.
- 2026-08-05 - User supplied the Open Notebook sidebar screenshot as a compact-navigation reference and explicitly limited copying to Struct-relevant menu items.
<!-- AGENT-END:bug-timeline -->
- 2026-08-05 - Fixed: compacted `WorkspaceNavigation`, made project/source search on-demand with focus and Escape close, removed footer prose, and exposed the supported theme setting as Settings. Verified `workspace-shell.test.tsx`, `workspace-responsive.spec.ts`, `source-import.spec.ts`, and `@struct/web` typecheck.
- 2026-08-05 - Corrected the retry: Settings is now the real `/settings` navigation link; the theme buttons are labeled only for their theme action. Verified `workspace-shell.test.tsx` and the web TypeScript check.
