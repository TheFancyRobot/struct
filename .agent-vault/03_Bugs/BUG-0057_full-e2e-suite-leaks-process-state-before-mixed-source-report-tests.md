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
fixed_on: '2026-07-27'
owner: bug0057-a1
created: '2026-07-27'
updated: '2026-07-27'
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

- Describe what actually happens.
- `bun run test:e2e` reliably hangs when `mixed-source-report.spec.ts` follows earlier specs; the first or second mixed-source test times out and later tests cascade.
- The exact failing mixed-source test passes alone, and the complete mixed-source spec passes alone (5/5 in ~4s).
- Latest clean full-suite run passed notebook-report, workspace-responsive, and source-import, then logged `killed 1 dangling process` and timed out the first mixed-source test after 60s.
- Investigate cross-spec server/process cleanup or shared-resource leakage. Do not weaken or skip coverage.

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
- bun's test runner (default, single-process mode) tracks child processes spawned via `child_process.spawn` and reaps them as `killed 1 dangling process` between/within test files.
- Playwright launches chromium through `child_process.spawn` (with `detached: true`, its own process group). bun still tracks the `ChildProcess` handle because it implements Node's `child_process.spawn` internally.
- When the reaper kills chromium mid-suite, subsequent `browser.newPage()` calls hang indefinitely (Playwright waits on a dead browser), hitting the 60s per-test timeout. The cascade kills the rest of the suite.
- Decisive evidence: process monitor showed `chrome-headless-shell` count drop to 0 after 1–3 mixed-source tests passed; the `bun src/server.ts` (port 4176) stayed alive; the next `browser.newPage()` hung to the 60s timeout. `--isolate` and `--parallel=1` changed the failure mode (port collision / afterAll timeout) but did not eliminate it; the probe run with `child.unref()` on every `spawn` passed reliably (9/9 across three experiment batches).

## Workaround

- Describe any temporary mitigation and remaining risk.

## Permanent Fix Plan

- Describe the intended durable fix.
- Run `bun run test:e2e`. The `test:e2e` script now loads `apps/web/test/e2e-process-preload.ts` via `--preload`. The preload wraps `child_process.spawn` to call `child.unref()` on every spawned child, removing it from bun's tracked subprocess set so the reaper leaves Playwright's chromium alone. Playwright still owns the browser lifecycle (its `process.on('exit')` handler kills chromium), so this does not leak the browser.
- Reliably passes the 4-spec repro (notebook-report → workspace-responsive → source-import → mixed-source-report): 23/23 in ~14s across 9 consecutive runs (3 batches). Before the fix the same 4-spec combo hung at mixed-source test 2–4 with `killed 1 dangling process` then a 60s timeout.
- Full e2e suite (all 11 specs, 72 tests): 71 pass, 1 fail. The single failure is `workspace-release > takes a first-time user through root and BASE_PATH durable source-grounded workspaces`, a heavy real-stack docker journey that times out at its own 120s budget under docker cold-start contention. That test passes in isolation (2/2, 30.8s) and is a pre-existing docker-performance flake, not the cross-spec process leak fixed here.
- Superseding correction: the global `child_process.spawn`/`unref()` preload was removed. It addressed Chromium reaping incompletely and left the suite vulnerable to other cross-file Bun test-runner process state.
- `test:e2e` now executes every browser spec and support test in a fresh `bun test` process. OS/process isolation prevents Bun's per-test-file dangling-process reaper from killing a later spec's browser while preserving the existing Playwright coverage and Bun-only runtime policy.

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
