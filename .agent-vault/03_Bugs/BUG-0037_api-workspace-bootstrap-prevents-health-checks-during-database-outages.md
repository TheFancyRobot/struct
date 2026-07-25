---
note_type: bug
template_version: 2
contract_version: 1
title: API workspace bootstrap prevents health checks during database outages
bug_id: BUG-0037
status: fixed
severity: sev-2
category: logic
reported_on: '2026-07-24'
fixed_on: '2026-07-25'
owner: ''
created: '2026-07-24'
updated: '2026-07-25'
related_notes:
  - '[[03_Bugs/BUG-0035_v1-browser-journey-gate-stubs-every-api-route-instead-of-using-the-real-stack|BUG-0035 V1 browser journey gate stubs every API route instead of using the real stack]]'
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_08_gate-v1-on-the-complete-browser-journey|STEP-10-08 Gate v1 on the Complete Browser Journey]]'
tags:
  - agent-vault
  - bug
---

# BUG-0037 - API workspace bootstrap prevents health checks during database outages

## Summary

- The API's real-stack workspace bootstrap opens the database before binding its HTTP listener, so `/healthz` is unavailable while the database is down.

## Observed Behavior

- `apps/api/src/auth-boundary.test.ts` starts the API with `DATABASE_URL=postgres://struct:struct@127.0.0.1:1/struct` and waits for `/healthz`.
- The process exits before it listens: `QueryError: Error: connect ECONNREFUSED 127.0.0.1:1`; the test fails with `API auth test server did not start`.

## Expected Behavior

- `/healthz` must identify a live API process independently of dependency availability. `/readyz` must remain the dependency-aware endpoint and must not signal ready until required bootstrap work is complete.

## Reproduction Steps

1. Run `bun test --timeout 15000 apps/api/src/auth-boundary.test.ts`.
2. Observe the server fail before its listener responds to `/healthz`.
3. Run the API with the test environment and an unreachable `DATABASE_URL`; it exits with `QueryError ECONNREFUSED`.

## Scope / Blast Radius

- Breaks the API health boundary and prevents deployment supervision from distinguishing a live process with an unavailable database from a process that cannot start.
- Blocks full-suite validation and closure of BUG-0035.

## Suspected Root Cause

- The real-stack harness needs its configured `API_WORKSPACE_ID` to exist, and its bootstrap was added to API startup rather than modeled as a readiness-gated task after the listener is bound.

## Confirmed Root Cause

- `apps/api/src/main.ts:244-258` executes `WorkspaceRepo.findById` and then `WorkspaceRepo.create` before `Bun.serve` at `:1649`. The former requires a database connection, so an unavailable database causes the outer server Effect to fail and releases the process before `/healthz` can respond.
- The preceding implementation (base `644af588`) bound the listener immediately after building repositories and preserved the intended `/healthz` versus `/readyz` separation.

## Workaround

- Before the 2026-07-25 fix, `/healthz` could not be relied on during an API database outage because the process exited before the listener bound. No workaround remains necessary after the scoped-bootstrap remediation.

## Permanent Fix Plan

- Preserve immediate listener availability, run workspace initialization only after the listener is bound, and make readiness fail until initialization succeeds. An unavailable database must not terminate the listener solely because bootstrap has not completed.

## Regression Coverage Needed

- `apps/api/src/auth-boundary.test.ts` must pass with its unreachable database and confirm `/healthz` is live.
- Add or retain coverage that `/readyz` is unavailable until database/bootstrap readiness is satisfied.
- Full `bun run test` must pass before BUG-0035 is reconsidered for closure.

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- [[03_Bugs/BUG-0035_v1-browser-journey-gate-stubs-every-api-route-instead-of-using-the-real-stack|BUG-0035 V1 browser journey gate stubs every API route instead of using the real stack]]
- [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_08_gate-v1-on-the-complete-browser-journey|STEP-10-08 Gate v1 on the Complete Browser Journey]]
<!-- AGENT-END:bug-related-notes -->

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-07-24 - Reported after BUG-0035 full-suite validation failed.
- 2026-07-24 - Reproduced independently with `bun test --timeout 15000 apps/api/src/auth-boundary.test.ts`: 0 pass, 1 fail, `API auth test server did not start`.
- 2026-07-24 - Root cause confirmed: the `WorkspaceRepo.findById/create` startup initialization precedes `Bun.serve`, and an unreachable database terminates the process before `/healthz` can bind.
- 2026-07-25 - Remediation bound `Bun.serve` before workspace bootstrap, kept `/healthz` live, and made `/readyz` report `503 not-ready` with `api/stalled` plus `database/dependency-unavailable` until bootstrap succeeds.
- 2026-07-25 - Regression coverage confirms `/healthz` 200 and `/readyz` 503 during unreachable-database startup.
- 2026-07-25 - Root validation passed: `bun test --timeout 15000 apps/api/src/auth-boundary.test.ts` (4 pass); related API and observability tests (14 pass); `bun run typecheck`; and `bun test --timeout 120000 --max-concurrency 1 apps/web/e2e/workspace-release.spec.ts` (4 pass). Independent review found no actionable issue.
<!-- AGENT-END:bug-timeline -->
