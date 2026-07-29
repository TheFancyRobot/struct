---
note_type: bug
template_version: 2
contract_version: 1
title: Clean real stack omits workspace bootstrap and blocks first project creation
bug_id: BUG-0060
status: fixed
severity: sev-1
category: integration
reported_on: '2026-07-28'
fixed_on: '2026-07-29'
owner: bug-0060-attempt-1
created: '2026-07-28'
updated: '2026-07-28'
related_notes:
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]]'
  - '[[05_Sessions/2026-07-28-204323-complete-responsive-accessibility-and-theme-behavior-codex|SESSION-2026-07-28-204323 Codex session for Complete Responsive Accessibility and Theme Behavior]]'
tags:
  - agent-vault
  - bug
---

# BUG-0060 - Clean real stack omits workspace bootstrap and blocks first project creation

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Clean real stack omits workspace bootstrap and blocks first project creation.
- Related notes: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]], [[05_Sessions/2026-07-28-204323-complete-responsive-accessibility-and-theme-behavior-codex|SESSION-2026-07-28-204323 Codex session for Complete Responsive Accessibility and Theme Behavior]].
- **Observed:** On a freshly reset real E2E stack, entering a project name and activating Create project shows `The project could not be created. Try again.`; `POST /api/projects` returns `503 {"error":"ProjectCreateUnavailable"}`.
- **Expected:** The standard stack bootstraps `API_WORKSPACE_ID` before serving project mutations, so the first project can be created.
- **Reproduction:** Start `startRealAppStack(4173)` against an empty `struct_e2e_workspace_release` database, open `/`, submit `Lead Main Audit`, and inspect the 503 response.
- **Evidence:** `.local/ui-audit/lead/screenshots/project-create-503-main.png` and `.local/ui-audit/lead/project-create-503-network.json` on main commit `3c6317c`.
- **Workaround:** Manually inserting the configured workspace row unblocks project creation; this was used only to continue the audit.

## Observed Behavior

- Describe what actually happens.
- With the fix, `POST /api/projects` against a freshly reset real stack returns `201` and the project is created; the workspace row is bootstrapped before the insert reaches the DB. `readyz` still reports `not-ready` during bootstrap, preserving the existing health/readiness contract. A genuine, permanent bootstrap failure (e.g. database unreachable) surfaces as `503 ProjectCreateUnavailable` after the 30s await timeout, matching the prior error contract for that case.

## Expected Behavior

- Describe what should happen instead.
- The standard stack bootstraps `API_WORKSPACE_ID` before serving project mutations, so the first project can be created. Authenticated `POST /api/projects` blocks on workspace readiness (bounded by a 30s timeout) before attempting the insert; `/healthz` and `/readyz` keep their existing semantics.

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
- `POST /api/projects` routes to `projectRoute` → `deps.createWithIdempotency`, which inserts into `projects` (`workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE`) before the `workspaceBootstrapLoop` has created the `API_WORKSPACE_ID` workspace row.
- The readiness gate only protects public endpoints (`/healthz`, `/readyz`); authenticated mutation routes are served immediately while the workspace bootstrap is still in progress (the `Bun.serve` listener accepts requests as soon as it binds, but `Effect.forkScoped(workspaceBootstrapLoop(...))` runs concurrently and may not have completed).
- On a freshly reset database the `workspaces` table is empty, so the first `POST /api/projects` hits the FK constraint during the race window and the insert fails; the route maps the untagged persistence failure to 503 `{"error":"ProjectCreateUnavailable"}`.
- Decisive evidence: reproduced on a clean `struct_bug0060_repro` database — with the readiness probe gated but mutation routes ungated, `readyz` returns 503 `not-ready` while `POST /api/projects` reaches the DB; the FK dependency is in `packages/persistence/src/migrations/0002_init_tables.sql` (`projects.workspace_id REFERENCES workspaces(id) ON DELETE CASCADE`).

## Workaround

- Describe any temporary mitigation and remaining risk.

## Permanent Fix Plan

- Describe the intended durable fix.
- Gate project creation on workspace readiness so the first project can be created on a clean stack instead of racing the workspace row insert.
- `apps/api/src/main.ts`:
  - Added a `Deferred<void> workspaceReady` alongside the existing `ready` flag.
  - `markReady` now calls `Deferred.unsafeDone(workspaceReady, Effect.void)` when the bootstrap loop succeeds.
  - The `createWithIdempotency` wiring now `Deferred.await(workspaceReady)` (bounded by a 30s `Effect.timeoutFail`) before delegating to `ProjectRepo.createWithIdempotency`. A genuine bootstrap failure surfaces as the same 503 `ProjectCreateUnavailable` after the timeout, preserving the existing error contract.
- The readiness probe (`/readyz`) still reports `not-ready` until bootstrap completes; auth (`401 AuthenticationRequired`) and all other routes are unchanged.

## Regression Coverage Needed

- List tests, fixtures, reproductions, alerts, or docs updates needed.
- Unit: `apps/api/src/workspace-bootstrap.test.ts` — new test `releases a readiness awaiter only after markReady fires` verifies the bootstrap loop's `markReady` contract the fix relies on (awaiter blocks while bootstrap is in progress, resolves exactly when `markReady` completes the `Deferred`).
- E2E (existing): `apps/web/e2e/workspace-release.spec.ts` — starts `startRealAppStack` against a freshly reset `struct_e2e_workspace_release` database and creates a project as its first action, covering the BUG-0060 repro path (root and BASE_PATH deployments).

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- Phase: [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|Phase 10 v1 usable research workspace]]
- Step: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_07_complete-responsive-accessibility-and-theme-behavior|STEP-10-07 Complete Responsive Accessibility and Theme Behavior]]
- Session: [[05_Sessions/2026-07-28-204323-complete-responsive-accessibility-and-theme-behavior-codex|SESSION-2026-07-28-204323 Codex session for Complete Responsive Accessibility and Theme Behavior]]
<!-- AGENT-END:bug-related-notes -->

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-07-28 - Reported.
<!-- AGENT-END:bug-timeline -->
- 2026-07-29 - Root cause confirmed (readiness gate protects only public endpoints; mutation routes race the workspace bootstrap). Fix implemented in `apps/api/src/main.ts` (gate `createWithIdempotency` on a `Deferred` completed by `markReady`). Regression test added to `apps/api/src/workspace-bootstrap.test.ts`. `bun test` (apps/api, 142 pass), `tsc`, `eslint` clean. End-to-end repro on a clean database now returns 201.
