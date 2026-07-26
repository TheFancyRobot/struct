---
note_type: bug
template_version: 2
contract_version: 1
title: Project creation controls overlap when the name field is focused
bug_id: BUG-0041
status: fixed
severity: sev-3
category: logic
reported_on: '2026-07-26'
fixed_on: '2026-07-26'
owner: bug0041_fix
created: '2026-07-26'
updated: '2026-07-26'
related_notes: |-
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Phase|PHASE-10 v1 Usable Research Workspace]]'
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_01_establish-workspace-and-project-lifecycle|STEP-10-01 Establish Workspace and Project Lifecycle]]'
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]]'
  - '[[01_Architecture/System_Overview|System Overview]]'
  - '[[04_Decisions/DEC-0013_use-tailwind-css-and-daisyui-with-a-custom-theme-for-frontend-styling|DEC-0013 Use Tailwind CSS and DaisyUI with a Custom Theme for Frontend Styling]]'
  - '[[04_Decisions/DEC-0014_use-solidjs-vite-8-and-solid-router-for-frontend-runtime|DEC-0014 Use SolidJS, Vite 8, and Solid Router for Frontend Runtime]]'
  - '[[02_Phases/Phase_11_v1_1_research_usability/Phase|PHASE-11 v1.1 Research Usability]]'
tags:
  - agent-vault
  - bug
---

# BUG-0041 - Project creation controls overlap when the name field is focused

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Project creation controls overlap when the name field is focused.
- Related notes: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_01_establish-workspace-and-project-lifecycle|STEP-10-01 Establish Workspace and Project Lifecycle]].

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
- DaisyUI 5 no longer gives the legacy `form-control` class a flex layout. The label therefore did not contain its full-width input, so the form's existing `space-y-3` spacing could not reliably separate the following submit button; the focused outline visibly collided with the action.

## Workaround

- Describe any temporary mitigation and remaining risk.

## Permanent Fix Plan

- Describe the intended durable fix.
- Fixed `ProjectSwitcher` by replacing the ineffective `form-control` class with existing Tailwind `flex flex-col` utilities. This makes the label contain the input and lets the existing 12px form spacing separate the controls without new CSS or dependencies.

## Regression Coverage Needed

- List tests, fixtures, reproductions, alerts, or docs updates needed.
- Added a focused Playwright assertion at the 375px viewport that requires at least 8px between the project-name input and Create project button.
- Validation: `bun test --preload ./test/solid-test-preload.ts --max-concurrency 1 ./src/components/project-switcher.test.tsx ./e2e/workspace-responsive.spec.ts` — 8 pass, 0 fail.
- Validation: `bun run typecheck` — passed.

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- Phase: [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|Phase 10 v1 usable research workspace]]
- Step: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_01_establish-workspace-and-project-lifecycle|STEP-10-01 Establish Workspace and Project Lifecycle]]
- Architecture: [[01_Architecture/System_Overview|System Overview]]
- Styling decision: [[04_Decisions/DEC-0013_use-tailwind-css-and-daisyui-with-a-custom-theme-for-frontend-styling|DEC-0013 Use Tailwind CSS and DaisyUI with a Custom Theme for Frontend Styling]]
- Runtime decision: [[04_Decisions/DEC-0014_use-solidjs-vite-8-and-solid-router-for-frontend-runtime|DEC-0014 Use SolidJS, Vite 8, and Solid Router for Frontend Runtime]]
- Accessibility step: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]]
- Follow-on phase: [[02_Phases/Phase_11_v1_1_research_usability/Phase|PHASE-11 v1.1 Research Usability]]
<!-- AGENT-END:bug-related-notes -->

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-07-26 - Reported.
<!-- AGENT-END:bug-timeline -->
- 2026-07-26: Confirmed the removed DaisyUI `form-control` layout behavior, applied the explicit flex-column fix, and passed focused component, responsive browser, and typecheck validation.
