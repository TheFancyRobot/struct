---
note_type: bug
template_version: 2
contract_version: 1
title: Project chat UI lacks recognizable conversation layout and collapsible columns
bug_id: BUG-0118
status: fixed
severity: sev-3
category: frontend
reported_on: '2026-08-05'
fixed_on: '2026-08-05'
owner: bug_0118_attempt_1
created: '2026-08-05'
updated: '2026-08-05'
related_notes: |2-
    - '[[02_Phases/Phase_10_v1_usable_research_workspace/Phase|PHASE-10 v1 Usable Research Workspace]]'
    - '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_02_build-unified-three-pane-workspace-shell|STEP-10-02 Build Unified Three Pane Workspace Shell]]'
    - '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_04_deliver-source-grounded-conversation|STEP-10-04 Deliver Source Grounded Conversation]]'
    - '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]]'
    - '[[02_Phases/Phase_10B_brand_implementation/Phase|PHASE-10B Brand Implementation]]'
    - '[[01_Architecture/System_Overview|System Overview]]'
    - '[[04_Decisions/DEC-0013_use-tailwind-css-and-daisyui-with-a-custom-theme-for-frontend-styling|DEC-0013 Use Tailwind CSS and DaisyUI with a Custom Theme for Frontend Styling]]'
    - '[[04_Decisions/DEC-0014_use-solidjs-vite-8-and-solid-router-for-frontend-runtime|DEC-0014 Use SolidJS Vite 8 and Solid Router for Frontend Runtime]]'
    - '[[04_Decisions/DEC-0024_require-full-browser-coverage-and-design-consistency-audit-before-phase-11|DEC-0024 Require Full Browser Coverage and Design Consistency Audit Before Phase 11]]'
tags:
  - agent-vault
  - bug
---

# BUG-0118 - Project chat UI lacks recognizable conversation layout and collapsible columns

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Project chat UI lacks recognizable conversation layout and collapsible columns.
- The project view does not present persisted turns as a recognizable chat, the composer spacing makes it look detached from the conversation, and desktop workspace columns cannot be collapsed independently.
- The requested visual/interaction target is the attached Open Notebook project view while retaining Struct's own theme, semantics, and accessibility requirements.

## Observed Behavior

- Conversation history is rendered as undifferentiated text inside a generic `Conversations` card; sender identity, turn boundaries, alignment, and message hierarchy are not visually apparent.
- The research composer is an oversized textarea with excessive internal padding and too little surrounding margin, so it appears misplaced rather than anchored to the chat.
- Desktop project columns remain fixed instead of exposing independent collapse/restore controls.
- Evidence: [current Struct project view](/Users/dino/Desktop/Screenshot 2026-08-05 at 10.22.10 AM.png), [Open Notebook expanded reference](/Users/dino/Desktop/Screenshot 2026-08-05 at 10.22.31 AM.png), and [Open Notebook collapsed-column reference](/Users/dino/Desktop/Screenshot 2026-08-05 at 10.25.51 AM.png).

## Expected Behavior

- Render conversation turns as a conventional, scrollable chat history with clear user/assistant distinction, message grouping, readable measure, and accessible sender semantics.
- Anchor a compact composer to the chat footer with balanced external margin and restrained control padding.
- Match the attached Open Notebook project-view structure as closely as the existing Struct design system permits: distinct workspace columns, each independently collapsible, a visible collapsed rail/restore control, and automatic expansion of the remaining workspace.
- Preserve keyboard order, focus restoration, touch targets, light/dark themes, responsive mobile-sheet behavior, source selection, citations, drafts, and SSE reconnect state.

## Reproduction Steps

1. Open a project containing at least one ready source.
2. Submit two or more research questions so persisted conversation history is visible.
3. Inspect the desktop project view and compare the history and composer with the attached current-state screenshot.
4. Attempt to collapse each visible workspace column independently.
5. Observe plain undifferentiated history text, an over-padded/mis-spaced composer, and missing per-column collapse controls.

## Scope / Blast Radius

- Affects the desktop project workspace in `apps/web`, especially the conversation renderer/composer and shared workspace pane layout.
- Any pane-state change must preserve existing tablet/mobile sheet behavior, accessibility, evidence navigation, notes, conversation drafts, and route state.
- This is a presentation and interaction defect; no API, persistence, or research-domain contract change is currently indicated.

## Suspected Root Cause

- The project route appears to reuse generic card/form presentation instead of the existing workspace shell as a chat-specific layout: turns lack role-aware visual treatment, the composer participates in document flow instead of a bounded chat footer, and desktop pane widths have no independent collapsed state.
- This remains a theory until the owning components and every caller are traced.

## Confirmed Root Cause

- Not yet confirmed. Reproduce in the running app and inspect the shared workspace/conversation components before implementation.

## Workaround

- None. The conversation remains usable only by reading raw turn text; there is no equivalent workaround for collapsing columns.

## Permanent Fix Plan

- Reuse the existing SolidJS workspace and shared DaisyUI/theme primitives.
- Give the conversation region an accessible message-list structure with role-aware user/assistant presentation and a compact footer composer.
- Add the minimum shared pane state needed for independent desktop collapse/restore controls; do not duplicate mobile sheet state or create a second layout system.
- Treat the Open Notebook screenshots as the interaction/layout reference while preserving Struct branding and existing research behavior.

## Regression Coverage Needed

- Add one focused component check for role-aware chat turns and composer spacing/layout classes.
- Add one browser regression covering independent collapse and restore of every desktop workspace column, retained conversation state, keyboard focus restoration, and remaining-pane expansion.
- Capture approved desktop light/dark screenshots and confirm existing tablet/mobile, accessibility, source-selection, evidence, notes, draft, and reconnect tests remain green.

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|PHASE-10 v1 Usable Research Workspace]]
- [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_02_build-unified-three-pane-workspace-shell|STEP-10-02 Build Unified Three Pane Workspace Shell]]
- [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_04_deliver-source-grounded-conversation|STEP-10-04 Deliver Source Grounded Conversation]]
- [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]]
- [[02_Phases/Phase_10B_brand_implementation/Phase|PHASE-10B Brand Implementation]]
- [[01_Architecture/System_Overview|System Overview]]
- [[04_Decisions/DEC-0013_use-tailwind-css-and-daisyui-with-a-custom-theme-for-frontend-styling|DEC-0013 Use Tailwind CSS and DaisyUI with a Custom Theme for Frontend Styling]]
- [[04_Decisions/DEC-0014_use-solidjs-vite-8-and-solid-router-for-frontend-runtime|DEC-0014 Use SolidJS Vite 8 and Solid Router for Frontend Runtime]]
- [[04_Decisions/DEC-0024_require-full-browser-coverage-and-design-consistency-audit-before-phase-11|DEC-0024 Require Full Browser Coverage and Design Consistency Audit Before Phase 11]]
<!-- AGENT-END:bug-related-notes -->

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-08-05 - Reported.
- 2026-08-05 - User supplied current-state and Open Notebook reference screenshots; defect scope expanded to include independently collapsible project columns.
<!-- AGENT-END:bug-timeline -->
- 2026-08-05 - Fixed: traced the persisted conversation renderer to its raw question/status list; replaced it with role-aware user/Struct message bubbles and a compact footer composer. Existing shared workspace state already supplied independent navigation/evidence collapse, restore, and focus behavior. Verified with the focused component check, web typecheck/build, and `workspace-responsive.spec.ts` (9/9).
- 2026-08-05: Retry attempt 2 fixed the remaining lint warning in `conversation-layout.test.tsx` by adding the existing Solid JSX ESLint exemption. Verified with focused ESLint, web typecheck, and the conversation layout regression test.
