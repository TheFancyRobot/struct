---
note_type: bug
template_version: 2
contract_version: 1
title: Full v1 browser gate leaves dangling lifecycle and source readiness failures
bug_id: BUG-0116
status: fixed
severity: sev-3
category: logic
reported_on: '2026-08-05'
fixed_on: '2026-08-05'
owner: bug0116_attempt1
created: '2026-08-05'
updated: '2026-08-05'
related_notes:
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_08_gate-v1-on-the-complete-browser-journey|STEP-10-08 Gate v1 on the Complete Browser Journey]]'
tags:
  - agent-vault
  - bug
---

# BUG-0116 - Full v1 browser gate leaves dangling lifecycle and source readiness failures

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Full v1 browser gate leaves dangling lifecycle and source readiness failures.
- Related notes: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_08_gate-v1-on-the-complete-browser-journey|STEP-10-08 Gate v1 on the Complete Browser Journey]].

## Observed Behavior

- Describe what actually happens.
- The v1 evaluation campaign ran all `apps/web/e2e` files through one raw `bun test` process. This bypassed the repository's isolated `test:e2e` runner and could reproduce the known shared Playwright lifecycle failures: source-import setup/teardown errors with dangling processes and the release journey failing before `renewals.md` reached `ready`.

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
- `scripts/v1-evaluation-campaign.ts` defined `playwright-accessibility-responsive-ui` as raw `bun test --timeout 60000 --max-concurrency 1 ./apps/web/e2e`. That single-process execution contradicted BUG-0058's required per-file isolation and BUG-0105's supported command contract. The focused release journey and raw aggregate run can pass opportunistically, but shared browser/server lifecycle remains nondeterministic.

## Workaround

- Describe any temporary mitigation and remaining risk.

## Permanent Fix Plan

- Describe the intended durable fix.
- Route the campaign browser gate through `bun run test:e2e`, which builds once then runs each browser spec and support test in a fresh Bun process. Retain the 180-second campaign budget; no timeout inflation or browser-test weakening is needed.

## Regression Coverage Needed

- List tests, fixtures, reproductions, alerts, or docs updates needed.
- Added a campaign-inventory assertion that the browser gate command is exactly `['bun', 'run', 'test:e2e']`. Also restored the missing `CapturedProcess` type import in readiness tests, so the suite's bounded-log contracts remain typechecked.
- Verified: `bun test --timeout 30000 --max-concurrency 1 scripts/v1-evaluation-campaign.test.ts` (4 pass); `bun run test:e2e` (all browser specs and support tests pass, including source-import 7/7 and root/BASE_PATH release journey); `bun run typecheck`.

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- Phase: [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|Phase 10 v1 usable research workspace]]
- Step: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_08_gate-v1-on-the-complete-browser-journey|STEP-10-08 Gate v1 on the Complete Browser Journey]]
<!-- AGENT-END:bug-related-notes -->

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-08-05 - Reported.
<!-- AGENT-END:bug-timeline -->
- 2026-08-05 - Confirmed the campaign bypassed the isolated E2E runner. Updated the browser gate to use `bun run test:e2e`, added a regression contract, repaired the missing readiness-test type import, and validated focused tests, full isolated E2E, and repository typecheck.
