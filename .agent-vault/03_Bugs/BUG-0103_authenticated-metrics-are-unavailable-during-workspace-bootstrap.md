---
note_type: bug
template_version: 2
contract_version: 1
title: Authenticated metrics are unavailable during workspace bootstrap
bug_id: BUG-0103
status: fixed
severity: sev-3
category: logic
reported_on: '2026-07-29'
fixed_on: '2026-07-29'
owner: bug-0103-attempt-1
created: '2026-07-29'
updated: '2026-07-29'
related_notes: '[[02_Phases/Phase_10_v1_usable_research_workspace/Phase|PHASE-10 v1 usable research workspace]]'
tags:
  - agent-vault
  - bug
---

# BUG-0103 - Authenticated metrics are unavailable during workspace bootstrap

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Authenticated metrics are unavailable during workspace bootstrap.
- Related notes: [[03_Bugs/BUG-0102_authenticated-api-mutations-can-race-workspace-bootstrap|BUG-0102 Authenticated API mutations can race workspace bootstrap]]
- **Observed:** BUG-0102's unconditional post-auth workspace readiness gate returns `503 ServiceUnavailable` for authenticated `GET /metrics` while bootstrap is incomplete.
- **Expected:** `/metrics` remains authenticated but is available during bootstrap because it renders only process-local observability data and performs no workspace/database operation.
- **Confirmed cause:** In `apps/api/src/main.ts`, the readiness gate precedes the later `/metrics` dispatch.
- **Scope:** Dispatch authenticated `/metrics` after auth but before the readiness gate; preserve the gate for workspace-backed routes and add regression coverage.

## Observed Behavior

- An authenticated `GET /metrics` returned `503 ServiceUnavailable` while `workspaceBootstrapLoop` was incomplete.
- The unreachable-database API test reproduced this with a valid bearer token.

## Expected Behavior

- `GET /metrics` remains authenticated but returns its Prometheus exposition during bootstrap because it only reads in-memory counters.
- Other workspace-backed routes remain behind the BUG-0102 readiness boundary.

## Reproduction Steps

1. Start the API with an unreachable database so bootstrap remains incomplete.
2. Request `/metrics` with a valid bearer token.
3. Verify it returns `200 text/plain; version=0.0.4`, not the bootstrap 503.

## Scope / Blast Radius

- `apps/api/src/main.ts`: authenticated `GET /metrics` was unavailable during startup and database outages.

## Suspected Root Cause

- Record current theories and assumptions.

## Confirmed Root Cause

- `handleRequest` applied the BUG-0102 readiness gate before its later `/metrics` dispatch, although metrics has no workspace or database dependency.

## Workaround

- Do not disable the shared gate; that would reintroduce BUG-0102.

## Permanent Fix Plan

- Dispatch authenticated `/metrics` immediately after authentication and before the workspace readiness gate; retain the gate for every workspace-backed route.

## Regression Coverage Needed

- `apps/api/src/auth-boundary.test.ts` verifies authenticated `/metrics` remains available during blocked bootstrap while the BUG-0102 mutation gate still holds.

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- Phase: [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|PHASE-10 v1 usable research workspace]]
- Related bug: [[03_Bugs/BUG-0102_authenticated-api-mutations-can-race-workspace-bootstrap|BUG-0102 Authenticated API mutations can race workspace bootstrap]]
<!-- AGENT-END:bug-related-notes -->

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-07-29 - Reported and fixed: moved authenticated `/metrics` ahead of the workspace readiness gate and added regression coverage.
<!-- AGENT-END:bug-timeline -->
