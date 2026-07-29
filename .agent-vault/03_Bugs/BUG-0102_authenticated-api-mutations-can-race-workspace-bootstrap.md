---
note_type: bug
template_version: 2
contract_version: 1
title: Authenticated API mutations can race workspace bootstrap
bug_id: BUG-0102
status: fixed
severity: sev-3
category: logic
reported_on: '2026-07-29'
fixed_on: '2026-07-29'
owner: bug-0102-attempt-1
created: '2026-07-29'
updated: '2026-07-29'
related_notes: '[[02_Phases/Phase_10_v1_usable_research_workspace/Phase|PHASE-10 v1 usable research workspace]]'
tags:
  - agent-vault
  - bug
---

# BUG-0102 - Authenticated API mutations can race workspace bootstrap

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Authenticated API mutations can race workspace bootstrap.
- Related notes: none linked yet.
- **Observed:** BUG-0060 gates only `POST /api/projects`; every other authenticated mutation remains callable while `workspaceBootstrapLoop` is still creating `API_WORKSPACE_ID`.
- **Expected:** No authenticated route attempts persistence for the configured workspace before bootstrap completes.
- **Confirmed cause:** `apps/api/src/main.ts` authenticates a request, then invokes route handlers immediately. For example, `POST /api/sources` can call `prepareSourceRegistration` with `projectId: null`, whose persistence transaction inserts `sources.workspace_id`; on an empty `workspaces` table this races the bootstrap row and fails its foreign-key constraint.
- **Scope:** Apply the readiness boundary once after authentication, rather than separately to each workspace-backed route.

## Observed Behavior

- Before the fix, an authenticated request was dispatched while workspace bootstrap was incomplete; `POST /api/sources` reached its route handler and returned `400 SourceRegistrationFailed` instead of being rejected at the readiness boundary.

## Expected Behavior

- Every authenticated request returns `503 {"error":"ServiceUnavailable"}` until `ensureApiWorkspace` has completed; no route handler or persistence call runs first.

## Reproduction Steps

1. Start the API with an unreachable database so workspace bootstrap remains incomplete.
2. Send an authenticated `POST /api/sources` request.
3. Before the fix it reached source registration; after the fix it returns `503 ServiceUnavailable` before dispatch.

## Scope / Blast Radius

- All authenticated API routes could race `API_WORKSPACE_ID` creation on a clean or unavailable stack; public health and readiness probes are unaffected.

## Suspected Root Cause

- Record current theories and assumptions.

## Confirmed Root Cause

- `handleRequest` authenticated a request and then invoked route handlers immediately. BUG-0060 guarded only project creation, leaving routes such as source registration able to insert a `workspace_id` before `workspaceBootstrapLoop` created its parent workspace row. The red regression test observed route-specific 400 responses while bootstrap was blocked.

## Workaround

- Describe any temporary mitigation and remaining risk.

## Permanent Fix Plan

- Describe the intended durable fix.
Apply the readiness boundary **once after authentication**, before any route
dispatch, rather than separately to each workspace-backed route. A fail-fast
`if (!ready) return 503 ServiceUnavailable` check in `handleRequest` (right
after `const identity = authenticated.value`) closes the race: `ready` is
monotonic false→true, set only by `workspaceBootstrapLoop`'s `markReady` after
`ensureApiWorkspace` succeeds, so once `ready` is true the `API_WORKSPACE_ID`
row exists for the process lifetime. The redundant per-route
`Deferred.await(workspaceReady)` gate on `createWithIdempotency` was removed
(now a plain `ProjectRepo.createWithIdempotency` call), and the now-unused
`workspaceReady` `Deferred` plus `Duration` timeout machinery were removed from
`main.ts`. Public liveness/readiness probes (`/healthz`, `/readyz`) are handled
before authentication and remain unaffected.

## Regression Coverage Needed

- `apps/api/src/auth-boundary.test.ts` verifies seven authenticated mutation routes return `503 ServiceUnavailable` while bootstrap is blocked, proving they do not dispatch to persistence.

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- Phase: [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|PHASE-10 v1 usable research workspace]]
- Related bug: [[03_Bugs/BUG-0060_clean-real-stack-omits-workspace-bootstrap-and-blocks-first-project-creation|BUG-0060 Clean real stack omits workspace bootstrap and blocks first project creation]]
<!-- AGENT-END:bug-related-notes -->

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-07-29 - Reported.
<!-- AGENT-END:bug-timeline -->
- 2026-07-29 - Root cause confirmed; readiness boundary moved to after auth in `apps/api/src/main.ts`; per-route `createWithIdempotency` gate removed; `workspaceReady` deferred and `Duration` timeout removed as dead code. Regression test added; typecheck, lint, and full API suite green (113 pass, 0 fail).
