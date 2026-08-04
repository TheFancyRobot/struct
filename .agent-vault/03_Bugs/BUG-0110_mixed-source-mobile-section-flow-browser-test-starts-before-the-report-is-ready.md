---
note_type: bug
template_version: 2
contract_version: 1
title: Mixed-source mobile section-flow browser test starts before the report is ready
bug_id: BUG-0110
status: fixed
severity: sev-3
category: logic
reported_on: '2026-08-04'
fixed_on: '2026-08-04'
owner: bug0110_attempt1
created: '2026-08-04'
updated: '2026-08-04'
related_notes:
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]]'
  - '[[05_Sessions/2026-07-28-204323-complete-responsive-accessibility-and-theme-behavior-codex|SESSION-2026-07-28-204323 Codex session for Complete Responsive Accessibility and Theme Behavior]]'
tags:
  - agent-vault
  - bug
---

# BUG-0110 - Mixed-source mobile section-flow browser test starts before the report is ready

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Mixed-source mobile section-flow browser test starts before the report is ready.
- Related notes: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]], [[05_Sessions/2026-07-28-204323-complete-responsive-accessibility-and-theme-behavior-codex|SESSION-2026-07-28-204323 Codex session for Complete Responsive Accessibility and Theme Behavior]].

## Observed Behavior

- Describe what actually happens.
- Reproduced twice on 2026-08-04 with `cd apps/web && bun test --timeout 60000 --max-concurrency 1 ./e2e/mixed-source-report.spec.ts`: the `provides a focused keyboard-operable mobile section flow` test observes zero `Mixed-source report sections` buttons immediately after `openDemo`, while the other five tests pass.
- This is independent of BUG-0100's 44px tab-height change and blocks its merge under the zero-defect gate.

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
- `openDemo` used Playwright's `waitUntil: 'commit'`, which only waits for the navigation response to begin. The mobile scenario queried the client-rendered controls before Solid had mounted the report shell, intermittently observing zero tabs.

## Workaround

- Describe any temporary mitigation and remaining risk.

## Permanent Fix Plan

- Describe the intended durable fix.
- Implemented: `openDemo` now waits for the rendered `Renewal risk synthesis` heading after the successful response. All mixed-source browser scenarios therefore begin only after the shared Solid report shell is mounted.

## Regression Coverage Needed

- List tests, fixtures, reproductions, alerts, or docs updates needed.
- Covered by the shared `openDemo` readiness boundary used by the focused mobile section-flow browser scenario and every other mixed-source report state. The focused spec passed three consecutive runs (6 tests each; 18 total passing test executions).

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
- 2026-08-04 — Fixed and verified with `cd apps/web && bun test --timeout 60000 --max-concurrency 1 ./e2e/mixed-source-report.spec.ts` (three consecutive 6/6 passes) and `bun run typecheck`.
