---
note_type: bug
template_version: 2
contract_version: 1
title: workspace release e2e times out under full-suite docker cold-start contention
bug_id: BUG-0058
status: fixed
severity: sev-3
category: logic
reported_on: '2026-07-27'
fixed_on: '2026-07-28'
owner: Codex
created: '2026-07-27'
updated: '2026-07-28'
related_notes:
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]]'
tags:
  - agent-vault
  - bug
---

# BUG-0058 - workspace release e2e times out under full-suite docker cold-start contention

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- workspace release e2e times out under full-suite docker cold-start contention.
- Related notes: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]].

## Observed Behavior

- Describe what actually happens.
- After BUG-0057 fixed Bun reaping Playwright Chromium, the full E2E suite passed 71/72 tests.
- `workspace-release.spec.ts` real-stack journey at line 249 timed out at its 120-second test budget under full-suite Docker cold-start contention.
- The same workspace-release spec passes in isolation (2/2, ~30.8 seconds).
- Root cause and fix the lifecycle/readiness/per-test budget issue without skipping coverage or merely inflating a global timeout.

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

- The timeout was not Docker cold-start contention or application failure. Bun's single `bun test ./apps/web/e2e` process retained and reaped Playwright/application subprocess state across spec files. `workspace-accessibility.spec.ts` followed by `workspace-release.spec.ts` reproduced `killed 1 dangling process`; the real-stack journey then stalled although ingestion, indexing, and persistence completed successfully.
- Running those exact specs in separate Bun processes passed: accessibility 2/2 in 2.99s and workspace-release 2/2 in 31.47s. Running without the BUG-0057 preload also passed, proving the broad `spawn().unref()` monkeypatch was unnecessary under process isolation.

## Workaround

- Describe any temporary mitigation and remaining risk.

## Permanent Fix Plan

- Keep Playwright for browser automation, but run each `*.spec.ts` and support `*.test.ts` file in its own `bun test` process from `test:e2e`.
- Remove the global E2E process preload and its implementation-specific regression test. Fresh processes provide deterministic lifecycle isolation without weakening coverage, increasing timeouts, adding another runtime, or monkeypatching all child processes.

## Regression Coverage Needed

- List tests, fixtures, reproductions, alerts, or docs updates needed.
- `bun run test:e2e` is the regression: all 72 E2E tests across browser specs and support tests must pass when each file is launched in a fresh Bun process.
- Validation on 2026-07-28: 72/72 passed, including mixed-source-report 5/5 and workspace-release 2/2 in 30.62s.

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- Phase: [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|Phase 10 v1 usable research workspace]]
- Step: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]]
<!-- AGENT-END:bug-related-notes -->

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-07-27 - Reported.
- 2026-07-28 - Corrected the initial Docker-contention hypothesis. Isolated every E2E file in a fresh Bun process, removed the global child-process preload, and validated the complete 72/72 suite.
<!-- AGENT-END:bug-timeline -->
