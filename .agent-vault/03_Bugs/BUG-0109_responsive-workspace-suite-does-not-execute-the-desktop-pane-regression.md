---
note_type: bug
template_version: 2
contract_version: 1
title: Responsive workspace suite does not execute the desktop-pane regression
bug_id: BUG-0109
status: fixed
severity: sev-3
category: logic
reported_on: '2026-08-04'
fixed_on: '2026-08-04'
owner: bug0109_attempt1
created: '2026-08-04'
updated: '2026-08-04'
related_notes:
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]]'
  - '[[05_Sessions/2026-07-28-204323-complete-responsive-accessibility-and-theme-behavior-codex|SESSION-2026-07-28-204323 Codex session for Complete Responsive Accessibility and Theme Behavior]]'
tags:
  - agent-vault
  - bug
---

# BUG-0109 - Responsive workspace suite does not execute the desktop-pane regression

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Responsive workspace suite does not execute the desktop-pane regression.
- Related notes: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]], [[05_Sessions/2026-07-28-204323-complete-responsive-accessibility-and-theme-behavior-codex|SESSION-2026-07-28-204323 Codex session for Complete Responsive Accessibility and Theme Behavior]].

## Observed Behavior

- Describe what actually happens.
- On 2026-08-04, `bun test --timeout 60000 --max-concurrency 1 ./e2e/workspace-responsive.spec.ts` did not complete the `collapses and restores desktop panes independently` regression. The worker reproduced an isolated failure at the project-list error alert wait (`workspace-responsive.spec.ts:502`); the root orchestrator also observed the named-test run terminate without reporting a passing assertion.
- This is independent of BUG-0096's touch-target change and blocks the zero-defect gate.

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
- The test correctly received its routed `503` response, but persistent workspace consumers invoked the shared Solid `projects` resource after rejection. Solid throws when an errored resource is invoked; that interrupted reactive rendering while it still displayed the loading state, so the project-list error alert never appeared and the desktop-pane assertions never ran.

## Workaround

- Describe any temporary mitigation and remaining risk.

## Permanent Fix Plan

- Use guarded, empty project-item accessors in the workspace navigation and project pages when `projects.error` is set, allowing the existing alert and retry control to render.
- Make the browser regression assert that the reload actually receives the routed `503` response before checking the alert and independent desktop panes.

## Regression Coverage Needed

- Covered by the named desktop-pane browser regression, which now verifies both the unavailable-list alert and the navigation/evidence collapse-and-restore behavior.

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- Phase: [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|Phase 10 v1 usable research workspace]]
- Step: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]]
- Session: [[05_Sessions/2026-07-28-204323-complete-responsive-accessibility-and-theme-behavior-codex|SESSION-2026-07-28-204323 Codex session for Complete Responsive Accessibility and Theme Behavior]]
<!-- AGENT-END:bug-related-notes -->

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-08-04 - Reported.
<!-- AGENT-END:bug-timeline -->
- 2026-08-04 - Fixed: guarded errored project-resource reads in the workspace navigation and project pages; added a response-status synchronization point to the desktop-pane browser regression.
- 2026-08-04 - Verified: `bun test --timeout 60000 --max-concurrency 1 ./e2e/workspace-responsive.spec.ts` (9 pass, 144 assertions); `bun --bun tsc --noEmit --project tsconfig.json` passed.
- 2026-08-04 review remediation: removed the remaining unguarded `projects()` reads from `SourcesPage` by deriving all project controls from a guarded project-item memo; changed project-page loading state to use `projects.loading`; and removed the direct resource read from workspace search readiness. This preserves the existing rejected-project-list browser regression while preventing persistent consumers from throwing after a resource rejection. Verified with `bun test --preload ./test/solid-test-preload.ts --max-concurrency 1 src/pages/sources-page.test.tsx`, `bun --bun tsc --noEmit --project apps/web/tsconfig.json`, and `bun test --timeout 60000 --max-concurrency 1 ./e2e/workspace-responsive.spec.ts` (9 passing).
