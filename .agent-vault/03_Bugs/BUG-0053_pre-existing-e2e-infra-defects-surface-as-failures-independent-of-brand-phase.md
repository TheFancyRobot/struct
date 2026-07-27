---
note_type: bug
template_version: 2
contract_version: 1
title: Pre-existing e2e infra defects surface as failures independent of brand phase
bug_id: BUG-0053
status: new
severity: sev-3
category: logic
reported_on: '2026-07-27'
fixed_on: ''
owner: ''
created: '2026-07-27'
updated: '2026-07-27'
related_notes:
  - '[[02_Phases/Phase_10B_brand_implementation/Steps/Step_04_validate-build-tests-and-visual-regression|STEP-10B-04 Validate Build Tests and Visual Regression]]'
tags:
  - agent-vault
  - bug
---

# BUG-0053 - Pre-existing e2e infra defects surface as failures independent of brand phase

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Pre-existing e2e infra defects surface as failures independent of brand phase.
- Related notes: [[02_Phases/Phase_10B_brand_implementation/Steps/Step_04_validate-build-tests-and-visual-regression|STEP-10B-04 Validate Build Tests and Visual Regression]].

## Observed Behavior

- Describe what actually happens.
Running `bun run test:e2e` locally fails ~10 of 69 e2e tests. None are caused by the PHASE-10B brand changes. Four distinct pre-existing defects:

- **A — Non-hermetic web-only specs (dead default API origin).** Specs using `startAppServer` (web-only; no API started) proxy every un-mocked `/api/*` call to the default `API_ORIGIN` `http://127.0.0.1:3001`, which has nothing listening locally → `fetch` throws → the web preview server returns `500`. Affected: `mixed-source-report` (5, via `consoleErrors`/`expectNoFailures`), `recursive-analysis` (1, via `serverErrors`). `WorkspaceShell` runs `createResource(fetchProjects)` on every page, so `GET /api/projects` is an incidental call these specs do not mock. (`notebook-report`, `conversation`, `workspace-accessibility`, `workspace-responsive` also hit it but do not assert on errors, so they pass.)
- **B — Duplicate project-link locators (project-lifecycle).** 3 `project-lifecycle` tests call `getByRole('link', { name: 'Café roadmap' | 'Beta archive' })` which resolves to **2 elements**: one in `aria-label="Workspace navigation"` and one in a `Projects` nav inside `main` (`btn btn-ghost`). Playwright strict-mode violation.
- **C — E2e port collisions + stale processes.** `note-reload` web = 4188 collides with `workspace-release` API = 4188 (`webPort+1`); `source-import` web = 4180 collides with `workspace-responsive` web = 4180. Interrupted runs leave stale `bun` servers holding ports → `workspace-release` "first-time user" fails with `port 4188 in use` / hangs to the 60s timeout.
- **D — General flakiness/hangs.** Back-to-back or interrupted runs leave dangling servers; tests hang to the 60s/120s timeout.

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
Proven NOT caused by PHASE-10B. Decisive evidence:

- **Brand phase changed zero API / test-infra code.** `git diff --stat 34c4359b..HEAD` (34c4359b = PR #94 merge base) shows only: `apps/web/src/index.css`, `apps/web/src/components/icons/index.tsx` (new), `apps/web/src/components/workspace/WorkspaceShell.tsx` (+5 lines: the logo lockup div, `role="img"`), `apps/web/index.html` (favicon), `apps/web/public/struct-favicon.svg`, `apps/web/package.json` (fonts), `bun.lock`. No API route, no `app-server.ts`, no e2e spec logic changed.
- **The incidental fetch predates the brand phase.** `WorkspaceShell` `createResource(fetchProjects)` was added in `8558fa0d` (feat: workspace navigation discovery), which `git merge-base --is-ancestor` confirms is an ancestor of `34c4359b` (PR #94). The error-asserting tests (`expectNoFailures`/`serverErrors`) and the broad `getByRole('link', { name: 'Café roadmap' })` locator were already present at `34c4359b` (`git show 34c4359b:...`), as were the two project-link regions (`Workspace navigation` + `Projects` main nav with `btn btn-ghost`). So defects A and B exist at the PR #94 base.
- **Manual reproduction exonerates the API.** `GET /api/projects` returns `200 {"items":[],"nextCursor":null}` against a freshly migrated `struct_e2e_workspace_release` DB, both directly and through the web preview proxy. Starting a live API on `127.0.0.1:3001` makes `recursive-analysis` pass 6/6 — proving A is purely the dead-default-origin hermeticity gap, not an API/DB bug.
- **C is environmental.** A stale `bun` process (PID 7158) was found holding 4188 from a prior interrupted run; `lsof` confirmed the note-reload(4188 web) ↔ workspace-release(4188 API) collision.

Root causes: A = `startAppServer` never starts/points at an API, so un-mocked `/api/*` proxies to a dead default origin. B = broad Playwright locator + two legitimately-rendered project links (nav switcher + main chooser). C = hardcoded, overlapping e2e port assignments across spec files + no port-reuse guard. D = same root as C (dangling servers from non-atomic teardown).

## Workaround

- Describe any temporary mitigation and remaining risk.
- For A only: start any API on `127.0.0.1:3001` (e.g. `API_PORT=3001 ... bun apps/api/src/main.ts` against the e2e DB) before running the suite — the web-only specs' incidental `/api` calls then 200. This is how CI presumably stays green and how the defect stayed latent.
- For C/D: kill stale e2e `bun` servers on ports 4173–4192 before each run; avoid back-to-back full-suite runs without cleanup.
- These do not address B (locator) and are not durable — see Permanent Fix Plan.

## Permanent Fix Plan

- Describe the intended durable fix.
- **A:** Make web-only `startAppServer` hermetic. Either (1) start a tiny stub `API_ORIGIN` that returns a valid empty `200` for `GET /api/projects` (`{"items":[],"nextCursor":null}`) and `GET /api/projects/:id/sources` (`{"items":[],"cursor":"0"}`), 404 otherwise — `page.route` mocks still take precedence at the browser layer; OR (2) have each error-asserting web-only spec mock `**/api/projects` (the `project-lifecycle` spec already does this in 10 places, the established pattern). Option 1 fixes all web-only specs once; option 2 is per-spec. (A working stub was prototyped and validated during STEP-10B-04 but reverted to keep the brand change-set focused; see the step session.)
- **B:** Scope the `project-lifecycle` link locators to the intended region, e.g. `page.getByLabel('Workspace navigation', { exact: true }).getByRole('link', { name: 'Café roadmap' })` (the tests assert on the project *switcher*). Confirm against the merge base which link the test originally targeted.
- **C:** Reassign the colliding e2e ports to disjoint values across all spec files (note-reload 4188, source-import 4180, workspace-responsive 4180, workspace-release API 4188) and/or derive ports from a single shared allocator with a port-reuse guard; ensure `stopAppServer`/`stopRealAppStack` fully release ports before the next spec binds.
- **D:** Same as C; add atomic teardown / port-release verification in the app-server support.

## Regression Coverage Needed

- List tests, fixtures, reproductions, alerts, or docs updates needed.

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- Phase: [[02_Phases/Phase_10B_brand_implementation/Phase|PHASE-10B Brand Implementation]]
- Step: [[02_Phases/Phase_10B_brand_implementation/Steps/Step_04_validate-build-tests-and-visual-regression|STEP-10B-04 Validate Build Tests and Visual Regression]]
<!-- AGENT-END:bug-related-notes -->

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-07-27 - Reported.
<!-- AGENT-END:bug-timeline -->
