---
note_type: bug
template_version: 2
contract_version: 1
title: Source-import E2E suite shares an unstable server lifecycle
bug_id: BUG-0114
status: fixed
severity: sev-3
category: logic
reported_on: '2026-08-05'
fixed_on: '2026-08-05'
owner: bug0114_attempt1
created: '2026-08-05'
updated: '2026-08-05'
related_notes:
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_08_gate-v1-on-the-complete-browser-journey|STEP-10-08 Gate v1 on the Complete Browser Journey]]'
tags:
  - agent-vault
  - bug
---

# BUG-0114 - Source-import E2E suite shares an unstable server lifecycle

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Source-import E2E suite shares an unstable server lifecycle.
- Related notes: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_08_gate-v1-on-the-complete-browser-journey|STEP-10-08 Gate v1 on the Complete Browser Journey]].

## Observed Behavior

- Running the source-import Playwright suite allowed cases to share one browser and Vite server. A degraded server lifecycle or state from an earlier case could carry into later cases, producing intermittent source-import failures.

## Expected Behavior

- Every source-import test case starts from an independent application-server and browser lifecycle, so one case cannot affect another.

## Reproduction Steps

1. Run `bun run --filter @struct/web test:e2e -- source-import.spec.ts` repeatedly or as part of the complete E2E suite.
2. Let a preceding case leave the shared server/browser lifecycle degraded.
3. Observe that a later source-import case can fail even though its own setup and assertions are valid.

## Scope / Blast Radius

- Affected: `apps/web/e2e/source-import.spec.ts` and the source-import browser coverage executed by `bun run test:e2e`.
- Impact: unreliable E2E validation for source upload, source-library, duplicate-source, and error-state behavior; production runtime behavior is not affected.

## Suspected Root Cause

- The suite-level `beforeAll`/`afterAll` lifecycle was suspected to be coupling otherwise independent tests through one Vite server and Chromium process.

## Confirmed Root Cause

- Confirmed: `source-import.spec.ts` created one app server and one browser for the complete suite. The shared lifecycle permitted both browser state and a degraded server process to leak from one case to another; moving creation and teardown to `beforeEach`/`afterEach` removes that coupling.

## Workaround

- Before the fix, rerun the affected E2E suite after a failure. This did not remove the shared-lifecycle risk and was not suitable as a validation gate.

## Permanent Fix Plan

- Create the app server on port 4201 and launch Chromium in `beforeEach`; close the browser and stop that server in `afterEach`. Keep the explicit port so existing source-import URLs remain stable.

## Regression Coverage Needed

- The source-import specification itself now exercises all seven cases with isolated setup and teardown.
- Evidence retained: `bun run test:e2e` passed across web E2E support and application specs (source-import 7/7), and `bun run --filter @struct/web typecheck` passed.

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- Phase: [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|Phase 10 v1 usable research workspace]]
- Step: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_08_gate-v1-on-the-complete-browser-journey|STEP-10-08 Gate v1 on the Complete Browser Journey]]
<!-- AGENT-END:bug-related-notes -->

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-08-05 - Reported.
<!-- AGENT-END:bug-timeline -->
- 2026-08-05 - Confirmed root cause: the source-import spec started one Vite production server and one Chromium browser for the whole suite, allowing state and a degraded server lifecycle to leak between independent cases.
- 2026-08-05 - Fixed by creating and closing a fresh app server and browser in `beforeEach`/`afterEach`, so every source-import case has an isolated lifecycle on the same explicit port.
- 2026-08-05 - Regression coverage: full `bun run test:e2e` passed (all web E2E specs plus support tests; source-import 7/7) and `bun run --filter @struct/web typecheck` passed.
