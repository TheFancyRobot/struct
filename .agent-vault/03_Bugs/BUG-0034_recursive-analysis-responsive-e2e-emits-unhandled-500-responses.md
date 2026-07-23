---
note_type: bug
template_version: 2
contract_version: 1
title: Recursive analysis responsive E2E emits unhandled 500 responses
bug_id: BUG-0034
status: fixed
severity: sev-3
category: logic
reported_on: '2026-07-23'
fixed_on: '2026-07-23'
owner: ''
created: '2026-07-23'
updated: '2026-07-23'
related_notes:
  - '[[02_Phases/Phase_06_recursive_research_planning_and_execution/Phase|PHASE-06 Recursive Research Planning and Execution]]'
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Phase|PHASE-10 v1 Usable Research Workspace]]'
tags:
  - agent-vault
  - bug
---

# BUG-0034 - Recursive analysis responsive E2E emits unhandled 500 responses

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Recursive analysis responsive E2E emits unhandled 500 responses.
- Related notes: [[02_Phases/Phase_06_recursive_research_planning_and_execution/Phase|PHASE-06 Recursive Research Planning and Execution]], [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|PHASE-10 v1 Usable Research Workspace]].

## Observed Behavior

- `bun run test:e2e` now fails in the recursive-analysis browser suite because the responsive coverage test records two unexpected browser-console 500s before it asserts `consoleErrors === []`.
- Focused reproduction with `bun test --timeout 60000 apps/web/e2e/recursive-analysis.spec.ts` fails the first case at `apps/web/e2e/recursive-analysis.spec.ts:253` with `Received  + 4` / two `Failed to load resource: the server responded with a status of 500 (Internal Server Error)` entries, while the other five specs still pass.

## Expected Behavior

- The responsive recursive-analysis journey should complete at desktop, tablet, and mobile widths without unexpected console errors, page errors, failed requests, or HTTP 5xx responses.
- `bun run test:e2e` and the focused recursive-analysis command should stay green without relying on tolerated console noise.

## Reproduction Steps

1. From the repository root, run `bun test --timeout 60000 apps/web/e2e/recursive-analysis.spec.ts`.
2. Observe the first case, `renders responsive light and dark workbenches without overflow`, while the harness iterates width/theme pairs after `routeProgress(page)`.
3. The run fails at line 253 because `consoleErrors` contains two `500 (Internal Server Error)` entries; Bun reports `5 pass, 1 fail` in 3.32s.
4. Canonical confirmation: `bun run test:e2e` also fails on the same recursive-analysis responsive path, and the lead independently observed the failure twice.

## Scope / Blast Radius

- Affects `apps/web/e2e/recursive-analysis.spec.ts`, especially the responsive regression that is part of the browser evidence for recursive research work.
- Breaks the canonical `bun run test:e2e` gate, so PR validation and release-readiness evidence cannot pass cleanly.
- Leaves the repository in a zero-defect-blocked state even though the other recursive-analysis specs continue to pass.

## Suspected Root Cause

- The spec assumes its page-level route stubs fully isolate the recursive-analysis screen, but the live EventSource/proxy path still emits real 500 responses during the responsive journey.
- Because the first test treats any console error as fatal, even recoverable SSE/proxy failures surface as a deterministic suite failure.

## Confirmed Root Cause

- `apps/web/e2e/recursive-analysis.spec.ts` uses `routeProgress(page)` to fulfill `**/api/projects/${projectId}/runs/${runId}/events*` with a heartbeat stream, then asserts `consoleErrors` is empty in the responsive test (`apps/web/e2e/recursive-analysis.spec.ts:180-190,224-253`).
- The same file separately encodes the product's reconnect/error path by fulfilling `/events` with HTTP 500 in `shows loading, reconnect, and recoverable read-error states` (`apps/web/e2e/recursive-analysis.spec.ts:353-377`), which matches the exact console symptom now appearing in the responsive run.
- The built web server proxies `/api/.../events` requests upstream with a server-only bearer token (`apps/web/src/server.ts`, `proxyApiRequest`), but `startAppServer` only boots the built web app and no API backend (`apps/web/e2e/support/app-server.ts:54-88`). The decisive evidence is the focused failing command output: the responsive test receives two real `500 (Internal Server Error)` resource failures and stops at the zero-console-error assertion even though the other five specs pass.
- 2026-07-23 remediation confirmed the leak was broader than `/runs/:runId/events`: `ConversationPanel` always fetched `/api/projects/${projectId}/sources`, opened `/api/projects/${projectId}/source-activity?cursor=0`, and loaded `/api/projects/${projectId}/research/${threadId}` before the recursive panel settled. The responsive spec only stubbed `/recursive-analysis` and `/events`, so the built web server proxied those unstubbed requests to the absent API backend and emitted deterministic 500 responses.
- The fix stayed in the harness: `apps/web/e2e/recursive-analysis.spec.ts` now stubs the source catalog, source-activity SSE heartbeat, and thread history alongside the recursive-analysis routes, and the responsive assertion now records origin-local API 5xx responses explicitly via `serverErrors` before checking console/page/request failures.

## Workaround

- There is no acceptable release workaround. Developers can reproduce or debug with the focused recursive-analysis command instead of the full E2E suite, but the canonical gate must stay red until the unexpected 500s are removed or the harness is corrected.
- Ignoring the console errors would hide a real browser/network defect and violate the zero-defect release gate.
- **Fix landed 2026-07-23:** The workaround is no longer needed. The harness now stubs all API dependencies (sources, source-activity SSE, research thread history, recursive-analysis, events), and the canonical gate is green.

## Permanent Fix Plan

- Trace the recursive-analysis responsive run end to end, identify which `/events` request bypasses or outlives the intended test stub, and make the harness deterministic for every viewport/theme iteration.
- Either provide a real bounded backend for the recursive-analysis SSE path or switch the browser hook/test seam so the responsive spec does not depend on a half-live proxy route.
- Keep the `consoleErrors === []`, `pageErrors === []`, and `failedRequests === []` assertions once the source of the 500s is fixed.
- **Completed 2026-07-23:** The harness now stubs the source catalog (`/api/projects/${projectId}/sources`), source-activity SSE heartbeat (`/api/projects/${projectId}/source-activity?cursor=0`), and thread history (`/api/projects/${projectId}/research/${threadId}`) alongside the recursive-analysis routes. Assertions for `consoleErrors`, `pageErrors`, `failedRequests`, and `serverErrors` are all in place.

## Regression Coverage Needed

- Red: `bun test --timeout 60000 apps/web/e2e/recursive-analysis.spec.ts` must reproduce the two-console-500 failure until the fix lands.
- Green: the same command must return `6 pass, 0 fail` with no unexpected console or request failures.
- Green: `bun run test:e2e` must pass after the focused fix so the canonical browser gate is restored.
- **Green result achieved:** `bun test --timeout 60000 apps/web/e2e/recursive-analysis.spec.ts` returned `6 pass, 0 fail` with no unexpected console or request failures, and `bun run test:e2e` passed.

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- [[02_Phases/Phase_06_recursive_research_planning_and_execution/Phase|PHASE-06 Recursive Research Planning and Execution]]
- [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|PHASE-10 v1 Usable Research Workspace]]
<!-- AGENT-END:bug-related-notes -->

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-07-23 - Reported.
- 2026-07-23 - Reproduced with `bun test --timeout 60000 apps/web/e2e/recursive-analysis.spec.ts`: first case failed at `apps/web/e2e/recursive-analysis.spec.ts:253` because `consoleErrors` contained two `Failed to load resource: the server responded with a status of 500 (Internal Server Error)` entries; Bun summary: `5 pass, 1 fail`.
- 2026-07-23 - Canonical evidence remained blocked: lead confirmed `bun run test:e2e` failed twice on the same recursive-analysis responsive path.
- 2026-07-23 - A pre-fix verification re-run hit `TimeoutError: reload: Timeout 30000ms exceeded` plus a follow-on timed-out hook before the harness fix landed.
- 2026-07-23 - Fixed: recursive-analysis.spec.ts now stubs all API dependencies (sources, source-activity, research thread, recursive-analysis, events); `bun test --timeout 60000 apps/web/e2e/recursive-analysis.spec.ts` returned 6 pass, 0 fail, and `bun run test:e2e` passed.
<!-- AGENT-END:bug-timeline -->
