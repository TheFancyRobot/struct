---
note_type: bug
template_version: 2
contract_version: 1
title: Mobile project name input falls below the touch target baseline
bug_id: BUG-0096
status: fixed
severity: sev-3
category: accessibility
reported_on: '2026-07-28'
fixed_on: '2026-08-04'
owner: bug0096_attempt1
created: '2026-07-28'
updated: '2026-08-04'
related_notes:
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]]'
  - '[[05_Sessions/2026-07-28-204323-complete-responsive-accessibility-and-theme-behavior-codex|SESSION-2026-07-28-204323 Codex session for Complete Responsive Accessibility and Theme Behavior]]'
tags:
  - agent-vault
  - bug
---

# BUG-0096 - Mobile project name input falls below the touch target baseline

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Mobile project name input falls below the touch target baseline.
- Related notes: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]], [[05_Sessions/2026-07-28-204323-complete-responsive-accessibility-and-theme-behavior-codex|SESSION-2026-07-28-204323 Codex session for Complete Responsive Accessibility and Theme Behavior]].
- **Observed:** Project name inputs measure about 40px high on mobile, below the 44px touch baseline used by adjacent buttons.
- **Expected:** The Project name field has a minimum 44px interactive height at mobile widths.
- **Reproduction:** Open `/` or a project view at 375×812 and measure the visible Project name input.
- **Evidence:** `.local/ui-audit/accessibility/report.md` ISSUE-007.
- **Related:** BUG-0066 covers workspace/source search, select, and file controls; BUG-0083 covers the conversation source checkbox.

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
The project-name control used only DaisyUI's default `input input-bordered` sizing, which renders at approximately 40px high. Unlike adjacent mobile controls, it did not opt into the repository's `min-h-11` (44px) touch-target convention.

## Workaround

- Describe any temporary mitigation and remaining risk.

## Permanent Fix Plan

- Describe the intended durable fix.
Applied `min-h-11` directly to the ProjectSwitcher project-name input so its interactive height is at least 44px at every viewport without changing its existing input styling or width behavior.

## Regression Coverage Needed

- List tests, fixtures, reproductions, alerts, or docs updates needed.
Added a mobile Playwright assertion at a 375px viewport that measures the labelled Project name input and requires a height of at least 44px, while retaining the existing 8px separation assertion from the create action. Verified with `bun test --preload ./test/solid-test-preload.ts --max-concurrency 1 --test-name-pattern 'touch-target baseline' e2e/workspace-responsive.spec.ts` (1 pass), `bun test --preload ./test/solid-test-preload.ts --max-concurrency 1 src/components/project-switcher.test.tsx` (4 pass), and `bun --bun tsc --noEmit --project apps/web/tsconfig.json` (pass).

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
- 2026-08-04 - Fixed: set the Project name input to `min-h-11` and added a 375px browser measurement regression test; focused browser test, component tests, and web typecheck passed.
