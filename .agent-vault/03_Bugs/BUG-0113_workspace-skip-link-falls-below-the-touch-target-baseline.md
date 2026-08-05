---
note_type: bug
template_version: 2
contract_version: 1
title: Workspace skip link falls below the touch-target baseline
bug_id: BUG-0113
status: fixed
severity: sev-3
category: accessibility
reported_on: '2026-08-05'
fixed_on: '2026-08-05'
owner: ''
created: '2026-08-05'
updated: '2026-08-05'
related_notes:
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]]'
  - '[[05_Sessions/2026-07-28-204323-complete-responsive-accessibility-and-theme-behavior-codex|SESSION-2026-07-28-204323 Codex session for Complete Responsive Accessibility and Theme Behavior]]'
  - '[[03_Bugs/BUG-0073_workspace-has-no-skip-link-past-repeated-navigation|BUG-0073 Workspace has no skip link past repeated navigation]]'
tags:
  - agent-vault
  - bug
---

# BUG-0113 - Workspace skip link falls below the touch-target baseline

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Mobile accessibility validation measured the visually hidden `Skip to main content` link in `WorkspaceShell` as a 1px × 1px focus target, below the 44px baseline.
- Related notes: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]], [[05_Sessions/2026-07-28-204323-complete-responsive-accessibility-and-theme-behavior-codex|SESSION-2026-07-28-204323 Codex session for Complete Responsive Accessibility and Theme Behavior]], and [[03_Bugs/BUG-0073_workspace-has-no-skip-link-past-repeated-navigation|BUG-0073 Workspace has no skip link past repeated navigation]].

## Observed Behavior

- On a 375px-wide workspace route, focusing `Skip to main content` left its off-screen hit box at 1px × 1px because the shared `sr-only` utility clipped it to that size. The browser accessibility contract flags both dimensions as below the 44px mobile touch-target baseline.

## Expected Behavior

- The skip link must remain visually hidden until focus, retain its `#workspace-main` destination, and provide at least a 44px × 44px focus target without clipping content at increased text size.

## Reproduction Steps

1. Start the workspace browser contract and open `/projects/<id>` at a 375px viewport.
2. Focus the `Skip to main content` link before any other workspace control.
3. Measure its `boundingBox`; before the fix it reports 1px × 1px, failing the 44px touch-target gate.

## Scope / Blast Radius

- List affected packages, commands, integrations, environments, or users.

## Suspected Root Cause

- Record current theories and assumptions.

## Confirmed Root Cause

- Record the proven cause and decisive evidence.
- Tailwind's `sr-only` utility reduced the skip link to a 1px × 1px off-screen box. The workspace mobile accessibility gate evaluates all in-document links, including this visually hidden link, and correctly reported it below the 44px touch-target baseline.

## Workaround

- Describe any temporary mitigation and remaining risk.

## Permanent Fix Plan

- Added the `workspace-skip-link` class with explicit 2.75rem minimum dimensions in the unlayered workspace stylesheet, overriding the `sr-only` 1px box while retaining the existing focus-visible skip-link presentation and `#workspace-main` destination. Minimum, rather than fixed, height preserves the baseline while allowing zoomed content to grow.

## Regression Coverage Needed

- List tests, fixtures, reproductions, alerts, or docs updates needed.
- Added browser coverage that focuses and measures both skip-link dimensions at the mobile baseline and verifies its `#workspace-main` destination. The existing full mobile accessibility audit also validates the hidden link's 44px × 44px box.

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]]
- [[05_Sessions/2026-07-28-204323-complete-responsive-accessibility-and-theme-behavior-codex|SESSION-2026-07-28-204323 Codex session for Complete Responsive Accessibility and Theme Behavior]]
- [[03_Bugs/BUG-0073_workspace-has-no-skip-link-past-repeated-navigation|BUG-0073 Workspace has no skip link past repeated navigation]]
<!-- AGENT-END:bug-related-notes -->

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-08-05 - Reported.
<!-- AGENT-END:bug-timeline -->
- 2026-08-05 - Confirmed the 1px `sr-only` hit box, implemented the 44px override, and verified the targeted browser regression.
- 2026-08-05 - Review remediation switched the override to minimum height, asserted both target dimensions, and linked the bug into the workspace-accessibility context.
- 2026-08-05 - Pending focused browser validation for the reviewed minimum-size behavior.
- 2026-08-05 - Focused browser contract passed (2 tests, 23 assertions) and `@struct/web` typecheck passed after the review remediation.
