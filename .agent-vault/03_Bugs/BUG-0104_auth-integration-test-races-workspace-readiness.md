---
note_type: bug
template_version: 2
contract_version: 1
title: Auth integration test races workspace readiness
bug_id: BUG-0104
status: fixed
severity: sev-3
category: logic
reported_on: '2026-07-29'
fixed_on: '2026-07-29'
owner: bug-0104-attempt-1
created: '2026-07-29'
updated: '2026-07-29'
related_notes: '[[02_Phases/Phase_10_v1_usable_research_workspace/Phase|PHASE-10 v1 usable research workspace]]'
tags:
  - agent-vault
  - bug
---

# BUG-0104 - Auth integration test races workspace readiness

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Auth integration test races workspace readiness.
- Related notes: none linked yet.
- **Observed:** `apps/api/src/auth-boundary.integration.test.ts` waits only for `/healthz`, then expects authenticated workspace-scoped requests to return `404`; the post-auth bootstrap gate can correctly return `503 ServiceUnavailable` before bootstrap completes.
- **Expected:** The integration fixture waits for `/readyz` before asserting authenticated workspace behavior.
- **Confirmed cause:** `/healthz` proves the listener is bound, not that `workspaceBootstrapLoop` has completed. The test is timing-dependent and failed in root validation with expected 404 / received 503.
- **Scope:** Fix the integration setup readiness condition and add bounded coverage without weakening the runtime gate.

## Observed Behavior

- Describe what actually happens.
- The `apps/api/src/auth-boundary.integration.test.ts` `beforeAll` fixture polled `/healthz` and returned as soon as it was `ok`. `/healthz` only proves the HTTP listener is bound — it returns `200 { status: 'alive' }` unconditionally. The test then issued authenticated workspace-scoped requests (e.g. `POST /api/projects/{id}/research`, `GET /api/projects/{id}/dataset-queries`) that require the BUG-0102 readiness gate (`ready === true`) to have opened. While `workspaceBootstrapLoop` was still running `ensureApiWorkspace`, `ready` was `false`, so `handleRequest` returned `503 { error: 'ServiceUnavailable' }` instead of the expected `404 ResourceNotFound`. Under full-suite load the bootstrap had not yet completed when the assertions ran, producing `expected 404 / received 503`.

## Expected Behavior

- The integration fixture must not assert authenticated workspace-scoped behavior until workspace readiness is established. `/readyz` returns `200 { status: 'ready', failures: [] }` only once `workspaceBootstrapLoop` has completed (`ready === true`) and the database readiness check passes; the fixture should poll `/readyz` instead of `/healthz`.


## Reproduction Steps

1. List the exact setup state.
2. List the user or developer actions.
3. Record the observed result.
1. `DATABASE_URL` set to a reachable test database (`struct-postgres` on `localhost:5432`).
2. `bun test --timeout 30000 src/auth-boundary.integration.test.ts` from `apps/api`.
3. Before the fix: the two assertion tests failed with `Expected: 404 / Received: 503` because `ready` was still `false` when they ran. After the fix: all tests pass.

## Scope / Blast Radius

- Test fixture only: `apps/api/src/auth-boundary.integration.test.ts`. No production code changed. The BUG-0102 runtime readiness gate and the BUG-0103 `/metrics` exemption in `apps/api/src/main.ts` are untouched.

## Suspected Root Cause

- The fixture waited for liveness (`/healthz`) rather than readiness (`/readyz`), so it proceeded before `workspaceBootstrapLoop` completed.

## Confirmed Root Cause

- `/healthz` (`healthResponse`) returns `200 { status: 'alive' }` as soon as the listener is bound; it is independent of the `ready` flag. `/readyz` (`readinessResponse`) returns `200` only when both the `api` readiness check (`ready`) and the `database` check pass. The fixture polled `/healthz`, so under full-suite load it advanced while `ready` was still `false` and the authenticated requests hit the BUG-0102 `if (!ready) return 503` gate. Decisive evidence: reverting the fixture to `/healthz` and adding an explicit `/readyz` readiness assertion (run first) reproduces `503 not-ready` deterministically across repeated runs, while the `/readyz` wait is green across repeated runs.




## Workaround

- Describe any temporary mitigation and remaining risk.
- None in production (test-fixture-only bug). The runtime gate is correct; the test was asserting workspace-scoped behavior before the workspace was ready.

## Permanent Fix Plan

- In `apps/api/src/auth-boundary.integration.test.ts` `beforeAll`, poll `/readyz` (return on `.ok`) instead of `/healthz`. Doubled the attempt budget (40→80 × 50 ms) to accommodate the additional time `workspaceBootstrapLoop` needs to complete on a cold/reachable database. Renamed the timeout error to `did not become ready`. This is the smallest test-fixture root-cause fix; the production BUG-0102 gate and BUG-0103 `/metrics` exemption are unchanged.

## Regression Coverage Needed

- Added `reaches workspace readiness before asserting workspace-scoped behavior (BUG-0104)` as the first assertion in the integration suite: it fetches `/readyz` and asserts `200` with `{ status: 'ready', failures: [] }`. Placed first, it deterministically catches a regression to a liveness-only wait (verified by temporarily reverting the fixture to `/healthz`: the new test fails `503` across 3/3 runs while the /readyz wait is green across 5/5 runs).

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- Related bug: [[03_Bugs/BUG-0102_authenticated-api-mutations-can-race-workspace-bootstrap|BUG-0102 Authenticated API mutations can race workspace bootstrap]]
- Related bug: [[03_Bugs/BUG-0103_authenticated-metrics-are-unavailable-during-workspace-bootstrap|BUG-0103 Authenticated metrics are unavailable during workspace bootstrap]]
<!-- AGENT-END:bug-related-notes -->

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-07-29 - Reported.
- 2026-07-29 - Root cause confirmed: fixture polled `/healthz` (liveness) instead of `/readyz` (readiness), racing the BUG-0102 bootstrap gate. Fixed fixture to poll `/readyz`; added BUG-0104 readiness regression test (first in suite). Verified: focused integration test 3/3 green across 5/5 runs; unit `auth-boundary.test.ts` 5/5 green; `apps/api` typecheck clean; full `apps/api` suite 144 pass / 0 fail. BUG-0103 working-tree changes in `main.ts`/`auth-boundary.test.ts` untouched.
<!-- AGENT-END:bug-timeline -->
