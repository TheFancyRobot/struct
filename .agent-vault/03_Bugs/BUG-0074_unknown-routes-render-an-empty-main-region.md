---
note_type: bug
template_version: 2
contract_version: 1
title: Unknown routes render an empty main region
bug_id: BUG-0074
status: fixed
severity: sev-3
category: navigation
reported_on: '2026-07-28'
fixed_on: '2026-08-03'
owner: bug_0074
created: '2026-07-28'
updated: '2026-08-03'
related_notes:
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]]'
  - '[[05_Sessions/2026-07-28-204323-complete-responsive-accessibility-and-theme-behavior-codex|SESSION-2026-07-28-204323 Codex session for Complete Responsive Accessibility and Theme Behavior]]'
tags:
  - agent-vault
  - bug
---

# BUG-0074 - Unknown routes render an empty main region

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Unknown routes render an empty main region.
- Related notes: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]], [[05_Sessions/2026-07-28-204323-complete-responsive-accessibility-and-theme-behavior-codex|SESSION-2026-07-28-204323 Codex session for Complete Responsive Accessibility and Theme Behavior]].
- **Observed:** An unmatched path renders workspace and evidence chrome around an empty `<main>` with no heading, error, or recovery action.
- **Expected:** Render a 404/not-found state with home/back navigation and a route-specific title.
- **Reproduction:** Open `/does-not-exist`.
- **Evidence:** `.local/ui-audit/lead/screenshots/unknown-route-empty-main.png`.

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
- The client router defined only known workspace routes. Its unmatched-route result left `App` and `WorkspaceShell` mounted with no child page, so `<main>` was empty.

## Workaround

- Describe any temporary mitigation and remaining risk.

## Permanent Fix Plan

- Describe the intended durable fix.
- Added a terminal Solid Router wildcard route (`*404`) that renders `NotFoundPage` inside the normal workspace shell.
- The page supplies an accessible `h1`, concise explanation, and base-path-aware recovery links to Projects and Sources.
- Unknown in-app paths now use the `Page Not Found — Struct` document title.

## Regression Coverage Needed

- List tests, fixtures, reproductions, alerts, or docs updates needed.
- Added SSR coverage for the 404 heading and recovery navigation, and page-title coverage for an unmatched workspace path.
- Verified with focused Bun tests and `bun run --filter @struct/web typecheck`.
- Added a Playwright route-level regression that loads an unknown base-path route and verifies the `h1`, document title, and both recovery-link targets.

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- Phase: [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|Phase 10 v1 usable research workspace]]
- Step: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]]
- Session: [[05_Sessions/2026-07-28-204323-complete-responsive-accessibility-and-theme-behavior-codex|SESSION-2026-07-28-204323 Codex session for Complete Responsive Accessibility and Theme Behavior]]
<!-- AGENT-END:bug-related-notes -->

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-07-28 - Reported.
<!-- AGENT-END:bug-timeline -->
- 2026-08-03 - Fixed: unmatched paths now render an accessible recovery page with a route-specific title; focused tests and web typecheck pass.
