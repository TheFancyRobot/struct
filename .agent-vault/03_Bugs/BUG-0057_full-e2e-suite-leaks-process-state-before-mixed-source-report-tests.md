---
note_type: bug
template_version: 2
contract_version: 1
title: full e2e suite leaks process state before mixed-source report tests
bug_id: BUG-0057
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

# BUG-0057 - full e2e suite leaks process state before mixed-source report tests

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- full e2e suite leaks process state before mixed-source report tests.
- Related notes: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]].

## Observed Behavior

- The historical single-process E2E command reliably hung when `mixed-source-report.spec.ts` followed earlier specs; the first or second mixed-source test timed out and later tests cascaded.
- The exact failing mixed-source test and complete mixed-source spec passed when run alone.
- Failing runs logged `killed 1 dangling process`; Chromium disappeared while the application server remained alive, and the next `browser.newPage()` waited until timeout.

## Expected Behavior

- The complete E2E suite must run every browser workflow without one spec's subprocess cleanup terminating a later spec's browser.
- A failure must terminate the command promptly rather than cascade through unrelated tests.

## Reproduction Steps

1. Build the web application and install Playwright Chromium.
2. Run notebook-report, workspace-responsive, source-import, and mixed-source-report specs in one Bun test process.
3. Observe `killed 1 dangling process`, Chromium termination, and a later mixed-source browser operation timing out.
4. Run `mixed-source-report.spec.ts` alone and observe all five tests pass.

## Scope / Blast Radius

- Affected the root `test:e2e` command, Playwright browser lifecycle, and local/CI release validation.
- Did not affect production application behavior or browser sessions outside Bun's test runner.

## Suspected Root Cause

- Cross-file Bun test-runner state or incomplete child-process cleanup was suspected because the failure depended on spec ordering and disappeared when the affected spec ran alone.

## Confirmed Root Cause
- bun's test runner (default, single-process mode) tracks child processes spawned via `child_process.spawn` and reaps them as `killed 1 dangling process` between/within test files.
- Playwright launches chromium through `child_process.spawn` (with `detached: true`, its own process group). bun still tracks the `ChildProcess` handle because it implements Node's `child_process.spawn` internally.
- When the reaper kills chromium mid-suite, subsequent `browser.newPage()` calls hang indefinitely (Playwright waits on a dead browser), hitting the 60s per-test timeout. The cascade kills the rest of the suite.
- Decisive evidence: process monitor showed `chrome-headless-shell` count drop to 0 after 1–3 mixed-source tests passed; the `bun src/server.ts` (port 4176) stayed alive; the next `browser.newPage()` hung to the 60s timeout. `--isolate` and `--parallel=1` changed the failure mode (port collision / afterAll timeout) but did not eliminate it; the probe run with `child.unref()` on every `spawn` passed reliably (9/9 across three experiment batches).

## Workaround

- Before the permanent fix, running each affected spec in a separate Bun command avoided the shared-process failure. No workaround remains necessary.

## Permanent Fix Plan

- `test:e2e` executes every browser spec and support test in a fresh `bun test` process.
- OS/process isolation prevents Bun's dangling-process reaper and retained runner state from affecting a later spec while preserving Playwright coverage and the Bun-only host-runtime policy.
- A broad `child_process.spawn`/`child.unref()` preload was evaluated and removed as a superseded experiment; it is not part of the operational fix.

## Regression Coverage Needed

- `bun run test:e2e` is the regression contract: it must launch every browser spec and E2E support test in an independent Bun process and pass the complete suite.
- Validation on 2026-07-28 passed all 72/72 E2E tests, including the prior four-spec mixed-source reproduction and the real-stack workspace-release journey.
- The removed preload and implementation-specific preload test are intentionally not part of the final fix.

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- Phase: [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|Phase 10 v1 usable research workspace]]
- Step: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]]
<!-- AGENT-END:bug-related-notes -->

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-07-27 - Reported.
<!-- AGENT-END:bug-timeline -->
- 2026-07-27 - Root caused: bun test reaper kills tracked Playwright chromium mid-suite; `browser.newPage()` then hangs to the 60s timeout. Fixed by adding `apps/web/test/e2e-process-preload.ts` (unrefs every `child_process.spawn` child) wired into `test:e2e` via `--preload`. Regression test added in `apps/web/e2e/process-preload.test.ts`. Validated: 4-spec repro 23/23 across 9 runs; full suite 71/72 (the 1 fail is a pre-existing heavy-docker workspace-release timeout, unrelated).
- 2026-07-28 - Replaced the broad child-process preload with per-file Bun process isolation. Full E2E validation passed 72/72, including BUG-0058's real-stack release journey.
