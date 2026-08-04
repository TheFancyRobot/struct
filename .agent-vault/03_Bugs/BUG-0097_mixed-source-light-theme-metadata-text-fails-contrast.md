---
note_type: bug
template_version: 2
contract_version: 1
title: Mixed source light theme metadata text fails contrast
bug_id: BUG-0097
status: fixed
severity: sev-2
category: accessibility
reported_on: '2026-07-28'
fixed_on: '2026-08-03'
owner: codex
created: '2026-07-28'
updated: '2026-08-03'
related_notes:
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]]'
  - '[[05_Sessions/2026-07-28-204323-complete-responsive-accessibility-and-theme-behavior-codex|SESSION-2026-07-28-204323 Codex session for Complete Responsive Accessibility and Theme Behavior]]'
tags:
  - agent-vault
  - bug
---

# BUG-0097 - Mixed source light theme metadata text fails contrast

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Mixed source light theme metadata text fails contrast.
- Related notes: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]], [[05_Sessions/2026-07-28-204323-complete-responsive-accessibility-and-theme-behavior-codex|SESSION-2026-07-28-204323 Codex session for Complete Responsive Accessibility and Theme Behavior]].
- **Observed:** MixedSourceReport `text-base-content/55` metadata renders at 4.0:1 on white, below 4.5:1. Affected text includes Documents/Datasets group labels, line locators, dataset version/hash, evidence metadata, and table caption.
- **Expected:** All 12px metadata text reaches 4.5:1 in light mode.
- **Reproduction:** Open `?demo=mixed-source&state=complete` in light mode and run axe.
- **Evidence:** `.local/ui-audit/demo/a11y/desktop-light-complete.json` and `contrast-unique.json`.

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
- `MixedSourceReport` used `text-base-content/55` for seven 12px metadata elements. On the light base surface that resolves to 4.0:1, below WCAG AA’s 4.5:1 minimum.

## Workaround

- Describe any temporary mitigation and remaining risk.

## Permanent Fix Plan

- Describe the intended durable fix.
- Replaced the seven affected metadata utilities with `text-base-content/65`, which meets the light-theme AA contrast target without changing the report structure or semantics.

## Regression Coverage Needed

- List tests, fixtures, reproductions, alerts, or docs updates needed.
- Added targeted SSR assertions for every affected metadata node and a guard against the former low-contrast `text-base-content/55` utility.
- Verified the focused component test and web typecheck.

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- Phase: [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|Phase 10 v1 usable research workspace]]
- Step: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]]
- Session: [[05_Sessions/2026-07-28-204323-complete-responsive-accessibility-and-theme-behavior-codex|SESSION-2026-07-28-204323 Codex session for Complete Responsive Accessibility and Theme Behavior]]
<!-- AGENT-END:bug-related-notes -->

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-07-28 - Reported.
- 2026-08-03 - Fixed: changed all affected mixed-source metadata to `text-base-content/65`; focused component test and web typecheck pass.
<!-- AGENT-END:bug-timeline -->
