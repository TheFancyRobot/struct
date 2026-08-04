---
note_type: bug
template_version: 2
contract_version: 1
title: Active source import mode has insufficient visual contrast
bug_id: BUG-0079
status: fixed
severity: sev-3
category: accessibility
reported_on: '2026-07-28'
fixed_on: '2026-08-04'
owner: bug_0079
created: '2026-07-28'
updated: '2026-07-28'
related_notes:
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]]'
  - '[[05_Sessions/2026-07-28-204323-complete-responsive-accessibility-and-theme-behavior-codex|SESSION-2026-07-28-204323 Codex session for Complete Responsive Accessibility and Theme Behavior]]'
tags:
  - agent-vault
  - bug
---

# BUG-0079 - Active source import mode has insufficient visual contrast

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Active source import mode has insufficient visual contrast.
- Related notes: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]], [[05_Sessions/2026-07-28-204323-complete-responsive-accessibility-and-theme-behavior-codex|SESSION-2026-07-28-204323 Codex session for Complete Responsive Accessibility and Theme Behavior]].
- **Observed:** Active and inactive Files/Paste/Dataset/Folder buttons use very similar light-mode backgrounds, leaving the selected mode difficult to distinguish. Computed-style checks reproduce with multiple active modes.
- **Expected:** Selected state has clear non-color-reliant emphasis and at least 3:1 UI-state contrast where color conveys state.
- **Evidence:** `.local/ui-audit/light/report.md` L-06 and source-mode screenshots.

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
The import-mode buttons relied on DaisyUI's `btn-active` styling, which primarily changes color. The selected mode had no persistent shape, text, or icon treatment that distinguished it in low-color or monochrome viewing conditions.

## Workaround

- Describe any temporary mitigation and remaining risk.

## Permanent Fix Plan

- Describe the intended durable fix.
Give the active import-mode button a high-contrast base-content outline, semibold weight, and a visible checkmark, while retaining the existing pressed-state semantics.

## Regression Coverage Needed

- List tests, fixtures, reproductions, alerts, or docs updates needed.
`source-import-panel.test.tsx` renders the default selected mode and asserts its pressed state, visible checkmark, semibold treatment, and base-content outline.

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
- 2026-08-04 - Fixed: selected import modes now have a visible checkmark and high-contrast outline in addition to color; focused component tests and web typecheck pass.
