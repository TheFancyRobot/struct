---
note_type: bug
template_version: 2
contract_version: 1
title: Conversation source checkbox touch target is only 25 pixels high
bug_id: BUG-0083
status: fixed
severity: sev-3
category: accessibility
reported_on: '2026-07-28'
fixed_on: '2026-08-04'
owner: bug_0083
created: '2026-07-28'
updated: '2026-08-04'
related_notes:
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]]'
  - '[[05_Sessions/2026-07-28-204323-complete-responsive-accessibility-and-theme-behavior-codex|SESSION-2026-07-28-204323 Codex session for Complete Responsive Accessibility and Theme Behavior]]'
tags:
  - agent-vault
  - bug
---

# BUG-0083 - Conversation source checkbox touch target is only 25 pixels high

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Conversation source checkbox touch target is only 25 pixels high.
- Related notes: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]], [[05_Sessions/2026-07-28-204323-complete-responsive-accessibility-and-theme-behavior-codex|SESSION-2026-07-28-204323 Codex session for Complete Responsive Accessibility and Theme Behavior]].
- **Observed:** On mobile Conversation, the source checkbox wrapper measures about 145×25px and the checkbox itself 20×20px; horizontal width is generous but vertical target size is below 44px.
- **Expected:** The complete label hit area is at least 44px high with adequate separation from adjacent controls.
- **Reproduction:** Open a project with a ready source at 375×812 and measure the source-selection label.
- **Evidence:** `.local/ui-audit/accessibility/report.md` Touch target summary.

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
The ready-source checkbox used DaisyUI's compact `label` styling around a 20px checkbox, with no minimum-height constraint on the clickable label.

## Workaround

- Describe any temporary mitigation and remaining risk.

## Permanent Fix Plan

- Describe the intended durable fix.
Replaced the compact label styling with an explicit flex label that has Tailwind's `min-h-11` (44px) touch-target baseline, horizontal padding, and existing wrapped-list spacing.

## Regression Coverage Needed

- List tests, fixtures, reproductions, alerts, or docs updates needed.
Added a focused component-source regression test that asserts the ready-source labels retain the 44px `min-h-11` target and the wrapped list retains `gap-3` separation.

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
- 2026-08-04 - Fixed: ready-source labels now use a 44px minimum touch target with 12px wrapped-list separation. Focused regression test and `bun run --filter @struct/web typecheck` passed; vault validation passed.
