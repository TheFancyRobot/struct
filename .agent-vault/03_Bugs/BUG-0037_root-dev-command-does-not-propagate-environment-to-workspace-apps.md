---
note_type: bug
template_version: 2
contract_version: 1
title: Root dev command does not propagate environment to workspace apps
bug_id: BUG-0037
status: fixed
severity: sev-3
category: logic
reported_on: '2026-07-24'
fixed_on: '2026-07-24'
owner: bug0037-worker-1
created: '2026-07-24'
updated: '2026-07-24'
related_notes:
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Phase|PHASE-10 v1 Usable Research Workspace]]'
  - '[[03_Bugs/BUG-0035_v1-browser-journey-gate-stubs-every-api-route-instead-of-using-the-real-stack|BUG-0035]]'
tags:
  - agent-vault
  - bug
---

# BUG-0037 - Root dev command does not propagate environment to workspace apps

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Root dev command does not propagate environment to workspace apps.
- Related notes: [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|PHASE-10]], [[03_Bugs/BUG-0035_v1-browser-journey-gate-stubs-every-api-route-instead-of-using-the-real-stack|BUG-0035]].

## Observed Behavior

- `bun dev` from the repository root prepared local storage, then started filtered workspace app `dev` scripts without the root `.env` values. In the current local setup the worker exited immediately with `Missing data at DATABASE_URL: "Expected DATABASE_URL to exist in the process context"`.
- Directly running the worker with an explicit env file, `WORKER_METRICS_PORT=3022 bun --env-file=.env run --filter @struct/worker dev`, reached `Worker ready for ingestion and research jobs`, which isolated the failure to environment propagation across the filtered root command.

## Expected Behavior

- The root `bun dev` entrypoint should pass the already-loaded root environment through to filtered workspace app scripts so API, worker, and web all start from the same local configuration contract.

## Reproduction Steps

1. From the repository root, run `bun dev`.
2. Observe `local:prepare` succeed and the filtered app startup begin.
3. The worker exits with `Missing data at DATABASE_URL`, proving the root env values did not reach the filtered workspace script.
4. Control check: `WORKER_METRICS_PORT=3022 bun --env-file=.env run --filter @struct/worker dev` reaches `Worker ready for ingestion and research jobs`.

## Scope / Blast Radius

- Affects the root `package.json` `dev` script only.
- Breaks local full-stack startup from the repository root even though the individual workspace app scripts work when given the env file explicitly.
- Does not require product-code, credentials, or container changes.

## Suspected Root Cause

- Bun likely loaded the root `.env` for the top-level command but did not propagate those values into filtered workspace child scripts.

## Confirmed Root Cause

- The original root script used `bun run --parallel --filter './apps/*' dev` directly. Bun loaded the root `.env` for the top-level command, but those values were not forwarded into the filtered child app processes.
- The proof was differential: the root command failed at worker config load with missing `DATABASE_URL`, while `bun --env-file=.env run --filter @struct/worker dev` succeeded without any code or container changes.
- The durable fix is to run filtered app startup through a tiny Bun script that spawns the same filtered command with `env: process.env`, preserving Bun-loaded `.env` / `.env.local` values in the child process environment.

## Workaround

- Temporary workaround before the fix: run the affected workspace script with an explicit env file, for example `bun --env-file=.env run --filter @struct/worker dev`.
- Remaining local limitation: in this worktree `.env` sets `WORKER_METRICS_PORT=3010`, and an unrelated pre-existing local listener on 3010 can still block startup until the port is freed or overridden.

## Permanent Fix Plan

- Replace the root `dev` script with a tiny Bun launcher that reuses the existing filtered app command but spawns it with `env: process.env`.
- Keep `.env.local` behavior by relying on Bun's normal root env loading rather than adding a custom parser.
- Completed 2026-07-24: root `package.json` now calls `scripts/run-dev-apps.ts`, which forwards `process.env` to `bun run --parallel --filter './apps/*' dev`.

## Regression Coverage Needed

- Red: `bun dev` from the repository root reproduced the worker failure with missing `DATABASE_URL`.
- Green: `bun test scripts/run-dev-apps.test.ts` passes and proves the new launcher forwards root environment variables into filtered app dev scripts.
- Green: `WEB_PORT=3100 API_PORT=3101 API_ORIGIN=http://127.0.0.1:3101 WORKER_METRICS_PORT=3102 bun dev` followed by HTTP checks returned `200` for `http://localhost:3100/`, `http://127.0.0.1:3101/readyz`, and `http://127.0.0.1:3102/readyz`.

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|PHASE-10 v1 Usable Research Workspace]]
- [[03_Bugs/BUG-0035_v1-browser-journey-gate-stubs-every-api-route-instead-of-using-the-real-stack|BUG-0035]]
<!-- AGENT-END:bug-related-notes -->

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-07-24 - Reported.
- 2026-07-24 - Reproduced: `bun dev` failed from the root because the worker child process did not receive `DATABASE_URL`.
- 2026-07-24 - Verified the env-propagation hypothesis: `WORKER_METRICS_PORT=3022 bun --env-file=.env run --filter @struct/worker dev` reached worker readiness.
- 2026-07-24 - Fixed root startup by adding `scripts/run-dev-apps.ts` and pointing the root `dev` script at it.
- 2026-07-24 - Added `scripts/run-dev-apps.test.ts` to lock in env forwarding.
- 2026-07-24 - Verified green full-stack startup with overridden local ports 3100/3101/3102 and HTTP 200 responses on web, API, and worker readiness endpoints.
<!-- AGENT-END:bug-timeline -->
