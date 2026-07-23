---
note_type: bug
template_version: 2
contract_version: 1
title: V1 browser journey gate stubs every API route instead of using the real stack
bug_id: BUG-0035
status: confirmed
severity: sev-3
category: logic
reported_on: '2026-07-23'
fixed_on: ''
owner: ''
created: '2026-07-23'
updated: '2026-07-23'
related_notes:
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_08_gate-v1-on-the-complete-browser-journey|STEP-10-08 Gate v1 on the Complete Browser Journey]]'
  - '[[03_Bugs/BUG-0013_v1-ui-lacks-core-research-workflows|BUG-0013 v1 UI lacks core research workflows]]'
tags:
  - agent-vault
  - bug
---

# BUG-0035 - V1 browser journey gate stubs every API route instead of using the real stack

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- V1 browser journey gate stubs every API route instead of using the real stack.
- Related notes: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_08_gate-v1-on-the-complete-browser-journey|STEP-10-08 Gate v1 on the Complete Browser Journey]], [[03_Bugs/BUG-0013_v1-ui-lacks-core-research-workflows|BUG-0013 v1 UI lacks core research workflows]].

## Observed Behavior

- `apps/web/e2e/workspace-release.spec.ts` passes while intercepting `page.route('**/api/**', ...)` and fulfilling every browser API response from in-memory fixtures instead of exercising the real web/API/worker/persistence stack.
- Focused validation with `bun test --timeout 120000 --max-concurrency 1 apps/web/e2e/workspace-release.spec.ts` reports `1 pass, 0 fail` in 3.81s, but that evidence is invalid for release because the journey never leaves the page-level mock boundary.

## Expected Behavior

- The STEP-10-08 release gate must drive the browser through a real stack: built web proxy, authenticated API routes, persistence, worker execution, SSE/events, evidence retrieval, and note durability.
- Per the Phase 10 execution brief, page-level `route.fulfill`, fixture injection, direct API setup, and other browser-side stubs cannot count as v1 release evidence.

## Reproduction Steps

1. Open `apps/web/e2e/workspace-release.spec.ts`.
2. Inspect the main test and find `await page.route('**/api/**', async (route) => { ... })` at line 110.
3. Follow the route handler: it fulfills project list/create, sources list/create, source activity SSE, research list/create, thread reads, run events, document evidence, notes list/create/read/update, and even a `recursive-analysis` 404 from hard-coded objects (`apps/web/e2e/workspace-release.spec.ts:119-228`).
4. Run `bun test --timeout 120000 --max-concurrency 1 apps/web/e2e/workspace-release.spec.ts` and observe the test pass despite never starting a real API, worker, database, or ingestion path.

## Scope / Blast Radius

- Affects the claimed release-closing browser evidence for BUG-0013 and STEP-10-08.
- Invalidates `apps/web/e2e/workspace-release.spec.ts` as v1 release proof because it can pass while the real backend stack is absent or broken.
- Keeps the release checklist blocked: a green mocked journey would otherwise falsely authorize Phase 10/v1 advancement.

## Suspected Root Cause

- The browser journey was written by extending earlier fixture-backed E2E patterns instead of replacing them with the real-stack harness required by the refined Phase 10 contract.
- Because the spec asserts only browser-visible effects against route-controlled fixtures, it can pass without proving any durable system integration.

## Confirmed Root Cause

- The release spec installs a catch-all `page.route('**/api/**', ...)` handler before any user action (`apps/web/e2e/workspace-release.spec.ts:110-230`). That handler fulfills all critical v1 endpoints from test-local constants: projects (`:119-128`), sources and source activity (`:129-143`), research create/read/follow-up (`:145-188`), evidence (`:190-208`), and notes (`:209-228`).
- The Phase 10 STEP-10-08 execution brief explicitly forbids exactly this strategy: "Page-level `route.fulfill`, fixture injection, direct SQL, and direct API commands cannot satisfy journey assertions" and "component demos, mocked fixtures, or direct API calls cannot substitute for the browser journey" (`.agent-vault/02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_08_gate-v1-on-the-complete-browser-journey/Execution_Brief.md`).
- Decisive evidence: the focused command `bun test --timeout 120000 --max-concurrency 1 apps/web/e2e/workspace-release.spec.ts` passed `1 pass, 0 fail` even though the test's own source proves every API interaction is stubbed in-process.

## Workaround

- Do not treat `workspace-release.spec.ts` as release evidence. At most it can remain a narrow UI smoke test until a real-stack journey exists.
- BUG-0013 cannot be considered fully closed, and the v1 release action must stay blocked, while this mocked gate is still the only browser journey.

## Permanent Fix Plan

- Replace the catch-all page-level API route with the real-stack support harness required by STEP-10-08: start the built web proxy plus API, worker, persistence, ingestion, and deterministic provider boundary.
- Keep any pure UI fixture test in a separate clearly non-release spec if it still provides value, but make the release gate itself create state only through visible browser controls against durable backend state.
- Re-record release evidence, screenshots, and checklist text only after the real-stack browser journey passes under the zero-defect gate.

## Regression Coverage Needed

- Red/static proof: `rg -n "page.route\('\*\*/api/\*\*'" apps/web/e2e/workspace-release.spec.ts` must stay empty for the release gate spec.
- Green: `bun test --timeout 120000 --max-concurrency 1 apps/web/e2e/workspace-release.spec.ts` must still pass after moving to the real-stack harness.
- Green: the final release-evidence run must exercise the full Phase 10 journey without page-level network stubs and with exact recorded command output.

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_08_gate-v1-on-the-complete-browser-journey|STEP-10-08 Gate v1 on the Complete Browser Journey]]
- [[03_Bugs/BUG-0013_v1-ui-lacks-core-research-workflows|BUG-0013 v1 UI lacks core research workflows]]
<!-- AGENT-END:bug-related-notes -->

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-07-23 - Reported.
- 2026-07-23 - Verified by source inspection: `apps/web/e2e/workspace-release.spec.ts` installs `page.route('**/api/**', ...)` at line 110 and fulfills every release-journey API from in-memory fixtures through line 228.
- 2026-07-23 - Focused validation: `bun test --timeout 120000 --max-concurrency 1 apps/web/e2e/workspace-release.spec.ts` passed `1 pass, 0 fail`, confirming the mocked journey can go green without proving the real stack.
<!-- AGENT-END:bug-timeline -->
