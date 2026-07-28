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

- After the initial BUG-0057 preload experiment, the historical single-process full E2E run passed 71/72 tests.
- `workspace-release.spec.ts` timed out during its real-stack journey only after preceding E2E files; the same spec passed alone in about 31 seconds.
- Application evidence showed ingestion, indexing, and persistence had completed before the browser journey stalled.

## Expected Behavior

- The real-stack root and BASE_PATH workspace journey must pass in the complete E2E command as reliably as it does alone.
- Harness lifecycle state from earlier specs must not consume the release journey's test budget or terminate its browser.

## Reproduction Steps

1. Build the web application and ensure the release-test Docker dependencies are available.
2. Run `workspace-accessibility.spec.ts` followed by `workspace-release.spec.ts` in one Bun test process.
3. Observe `killed 1 dangling process` and the workspace-release journey timing out despite successful application-side ingestion and persistence.
4. Run the two files in separate Bun processes and observe accessibility pass 2/2 and workspace-release pass 2/2 in about 31 seconds.

## Scope / Blast Radius

- Affected the root E2E release gate and its real-stack browser journey in local/CI validation.
- Did not indicate a production ingestion, indexing, persistence, Docker readiness, or application workflow defect.

## Suspected Root Cause

- Docker cold-start contention and a too-small journey budget were initially suspected because the failure appeared late in the full suite. Timing and application instrumentation disproved that hypothesis and redirected investigation to cross-file process lifecycle state.

## Confirmed Root Cause

- The timeout was not Docker cold-start contention or application failure. Bun's single `bun test ./apps/web/e2e` process retained and reaped Playwright/application subprocess state across spec files. `workspace-accessibility.spec.ts` followed by `workspace-release.spec.ts` reproduced `killed 1 dangling process`; the real-stack journey then stalled although ingestion, indexing, and persistence completed successfully.
- Running those exact specs in separate Bun processes passed: accessibility 2/2 in 2.99s and workspace-release 2/2 in 31.47s. Running without the BUG-0057 preload also passed, proving the broad `spawn().unref()` monkeypatch was unnecessary under process isolation.

## Workaround

- Running `workspace-release.spec.ts` alone or launching it in a fresh Bun process after earlier specs avoided the timeout. The permanent test command now applies that isolation automatically.

## Permanent Fix Plan

- Keep Playwright for browser automation, but run each `*.spec.ts` and support `*.test.ts` file in its own `bun test` process from `test:e2e`.
- Remove the global E2E process preload and its implementation-specific regression test. Fresh processes provide deterministic lifecycle isolation without weakening coverage, increasing timeouts, adding another runtime, or monkeypatching all child processes.

## Regression Coverage Needed

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
