---
note_type: bug
template_version: 2
contract_version: 1
title: Mobile project navigation drawer makes theme switching unreachable
bug_id: BUG-0095
status: fixed
severity: sev-3
category: ux
reported_on: '2026-07-28'
fixed_on: '2026-08-04'
owner: bug0095_attempt1
created: '2026-07-28'
updated: '2026-08-05'
related_notes:
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]]'
  - '[[05_Sessions/2026-07-28-204323-complete-responsive-accessibility-and-theme-behavior-codex|SESSION-2026-07-28-204323 Codex session for Complete Responsive Accessibility and Theme Behavior]]'
  - '[[05_Sessions/2026-08-05-035906-complete-responsive-accessibility-and-theme-behavior-bug-0095|SESSION-2026-08-05-035906 bug_0095 session for Complete Responsive Accessibility and Theme Behavior]]'
tags:
  - agent-vault
  - bug
---

# BUG-0095 - Mobile project navigation drawer makes theme switching unreachable

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Mobile project navigation drawer makes theme switching unreachable.
- Related notes: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]], [[05_Sessions/2026-07-28-204323-complete-responsive-accessibility-and-theme-behavior-codex|SESSION-2026-07-28-204323 Codex session for Complete Responsive Accessibility and Theme Behavior]].
- **Observed:** On mobile project routes, opening workspace navigation covers the only visible theme toggle with the backdrop, while the drawer itself has no mobile theme control. The same action is available inside the home drawer.
- **Expected:** Global theme switching remains consistently discoverable from the open drawer, or product behavior explicitly standardizes closing the drawer first.
- **Reproduction:** At 375×812 open a project, open Menu, and attempt the theme toggle; the backdrop intercepts the click.
- **Evidence:** `.local/ui-audit/accessibility/screenshots/16-drawer-theme-check-dark-375.png` and `videos/evidence-focus-return.webm`.
- **Related:** Distinct from focus isolation BUG-0067 and fixed toast-overlap BUG-0056.

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
- Confirmed 2026-08-04: `ConversationWorkspace` rendered the only mobile theme control in the underlying top bar. Opening the mobile navigation sheet adds a full-screen backdrop and makes the main region inert, so that control could neither receive pointer nor keyboard activation. `WorkspaceNavigation` contained only a desktop (`md:flex`) theme control.

## Workaround

- Describe any temporary mitigation and remaining risk.

## Permanent Fix Plan

- Describe the intended durable fix.
- Implemented 2026-08-04: added an `md:hidden` global theme button to the navigation drawer footer, sharing the existing theme state and toggle handler. The desktop sidebar control remains unchanged, and the normal mobile top-bar control remains available when the drawer is closed.

## Regression Coverage Needed

- List tests, fixtures, reproductions, alerts, or docs updates needed.
- Implemented focused coverage in `apps/web/src/components/workspace/workspace-shell.test.tsx` for the breakpoint-specific controls and `apps/web/e2e/workspace-responsive.spec.ts` for opening a mobile project navigation sheet, activating its theme toggle, and observing `html[data-theme="struct-dark"]`.

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- Phase: [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|Phase 10 v1 usable research workspace]]
- Step: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]]
- Session: [[05_Sessions/2026-07-28-204323-complete-responsive-accessibility-and-theme-behavior-codex|SESSION-2026-07-28-204323 Codex session for Complete Responsive Accessibility and Theme Behavior]]
<!-- AGENT-END:bug-related-notes -->

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-07-28 - Reported.
- 2026-08-04 - Fixed: added a reachable mobile drawer theme action and validated focused component plus responsive Playwright coverage.
- 2026-08-05 - Re-validated in the shared tree: focused Solid render coverage and the Chromium mobile navigation dialog theme toggle both pass.
<!-- AGENT-END:bug-timeline -->
