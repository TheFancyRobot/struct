---
note_type: bug
template_version: 2
contract_version: 1
title: E2E build artifacts break canonical lint gate
bug_id: BUG-0032
status: fixed
severity: sev-3
category: tooling
reported_on: '2026-07-22'
fixed_on: '2026-07-22'
owner: bug-0032-e2e-artifact-lifecycle
created: '2026-07-22'
updated: '2026-07-23'
related_notes: '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_01_establish-workspace-and-project-lifecycle|STEP-10-01 Establish Workspace and Project Lifecycle]]'
tags:
  - agent-vault
  - bug
---

# BUG-0032 - E2E build artifacts break canonical lint gate

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- E2E build artifacts break canonical lint gate.

## Observed Behavior

- Describe what actually happens.
- After `bun run test:e2e`, the harness leaves per-run Vite bundles under `apps/web/.e2e-dist/`. Running the canonical `bun --bun eslint .` gate then scans those generated minified bundles and fails with 2,550 false source errors.

## Expected Behavior

- Describe what should happen instead.
- The canonical validation sequence must remain green regardless of prior build/E2E gates. E2E servers must clean their unique generated bundle roots, and generated E2E output must be ignored by source-control and lint safety nets.

## Reproduction Steps

1. List the exact setup state.
2. List the user or developer actions.
3. Record the observed result.
1. Start from a clean branch with no `apps/web/.e2e-dist/` directory.
2. Run `bun run test:e2e`.
3. Observe unique generated bundle directories under `apps/web/.e2e-dist/`.
4. Run `bun run lint`.
5. Observe ESLint scanning generated assets and failing with thousands of `no-undef`/minified-code errors.

## Scope / Blast Radius

- List affected packages, commands, integrations, environments, or users.

## Suspected Root Cause

- Record current theories and assumptions.

## Confirmed Root Cause

- Record the proven cause and decisive evidence.
- `apps/web/e2e/support/app-server.ts` creates a unique `.e2e-dist/<scope>` directory for each server but `stopAppServer` only terminates the process and never removes its bundle. `.gitignore` and `eslint.config.mjs` ignore ordinary `dist` directories but not `.e2e-dist`, so leaked E2E bundles are untracked and linted.

## Workaround

- Describe any temporary mitigation and remaining risk.

## Permanent Fix Plan

- Describe the intended durable fix.
- Add test-first E2E lifecycle coverage proving every unique bundle root is removed on normal stop and startup failure; make cleanup deterministic in `finally` paths; add `.e2e-dist` safety ignores to Git and ESLint; then rerun E2E followed by lint in canonical order.

## Regression Coverage Needed

- `bun test apps/web/e2e/support/app-server.test.ts` proves normal shutdown and startup failures remove the unique bundle root.
- `bun run test:e2e` proves browser runs leave no `.e2e-dist` children.
- `bun run lint` and `bun --bun tsc --noEmit --project apps/web/tsconfig.json` prove generated output neither enters lint nor breaks the web harness typecheck.

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_01_establish-workspace-and-project-lifecycle|STEP-10-01 Establish Workspace and Project Lifecycle]] — validation context only; the step remains inactive.
- [[03_Bugs/BUG-0013_v1-ui-lacks-core-research-workflows|BUG-0013 v1 UI lacks core research workflows]] — the parent remediation remains open.
<!-- AGENT-END:bug-related-notes -->

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-07-22 - Reported.
<!-- AGENT-END:bug-timeline -->
- 2026-07-22 - Red: `bun test apps/web/e2e/support/app-server.test.ts` failed because `stopAppServer` left the created bundle root in place and a startup-before-readiness failure leaked a new `.e2e-dist` directory.
- 2026-07-22 - Green: focused `bun test apps/web/e2e/support/app-server.test.ts` passed after deterministic cleanup was added.
- 2026-07-22 - Validation: `bun --bun tsc --noEmit --project apps/web/tsconfig.json` passed; canonical `bun run test:e2e` passed (32 tests); `bun run lint` passed with 0 errors / 2 pre-existing warnings unrelated to `.e2e-dist`; `bun run lint:imports` passed; residual `apps/web/.e2e-dist` artifacts from earlier failed repro runs were removed with filesystem cleanup.
- 2026-07-22 - Remediation attempt 1 is not accepted: although focused app-server tests passed, two canonical E2E reruns recorded in `/tmp/oh-pi-bg-1784702714950.log` and `/tmp/oh-pi-bg-1784703316969.log` each failed all recursive-analysis cases at the first `page.goto`/subsequent 60-second timeouts and left `apps/web/.e2e-dist/4178-*` behind. The initial worker became idle without reporting/recovering this contradiction. BUG-0032 required a fresh attempt to find the regression root cause and prove full E2E cleanup.
- 2026-07-22 - Fresh remediation attempt 2 failed before execution: the mandated-model worker read the self-contained prompt, then remained idle with no commands, reproduction, edits, or response to a direct status request. It was shut down cleanly. No repository state changed in that attempt; the default retry budget now has one final fresh-worker attempt remaining.
- 2026-07-22 - Final fresh verification found no deterministic remaining BUG-0032 failure under clean state. After removing `apps/web/.e2e-dist`, an independent exact `bun run test:e2e` rerun passed all 32 tests (including all 6 recursive-analysis specs) and left no child directories under `apps/web/.e2e-dist/` plus no listeners on the E2E ports. Follow-up gates also passed: `bun run lint` (0 errors, 2 pre-existing unrelated warnings in `apps/web/src/api/projects.ts` and `apps/web/src/components/project-switcher.test.tsx`), `bun run lint:imports`, and `bun --bun tsc --noEmit --project apps/web/tsconfig.json`. Current evidence does not reproduce the earlier 4178 timeout cascade from `/tmp/oh-pi-bg-1784702714950.log` and `/tmp/oh-pi-bg-1784703316969.log`; bounded residual risk is an unexplained environment/process-level flake outside the presently observable deterministic lifecycle fix.
- 2026-07-22 - Root acceptance: focused recursive E2E passed 6/6 with no residual bundles; the ordered five-spec browser matrix passed 29/29 with no residual bundles; exact `bun run test:e2e` passed 32/32 with no residual bundle children. A final fresh independent clean-state run also passed 32/32, followed by clean app/web typecheck, `bun run lint`, and `bun run lint:imports`. Root removed the two lint warnings without suppressing rules by replacing a Babel-confusing namespace type import with schema `Type` members and deleting an actually unused directive; focused web tests passed 8/8. No deterministic lifecycle defect remains; the earlier timeout cascade was not reproducible after clean process/artifact state.
- 2026-07-22 - Status: BUG-0032 is fixed.
