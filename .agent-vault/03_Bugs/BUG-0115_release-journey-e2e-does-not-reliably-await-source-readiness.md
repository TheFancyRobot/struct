---
note_type: bug
template_version: 2
contract_version: 1
title: Release journey E2E does not reliably await source readiness
bug_id: BUG-0115
status: fixed
severity: sev-3
category: logic
reported_on: '2026-08-05'
fixed_on: '2026-08-05'
owner: bug0115_attempt1
created: '2026-08-05'
updated: '2026-08-05'
related_notes:
  - '[[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_08_gate-v1-on-the-complete-browser-journey|STEP-10-08 Gate v1 on the Complete Browser Journey]]'
tags:
  - agent-vault
  - bug
---

# BUG-0115 - Release journey E2E does not reliably await source readiness

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Release journey E2E does not reliably await source readiness.
- Related notes: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_08_gate-v1-on-the-complete-browser-journey|STEP-10-08 Gate v1 on the Complete Browser Journey]].

## Observed Behavior

- Describe what actually happens.
- During the full release campaign, the `renewals.md` catalog readiness assertion could exceed Playwright's implicit 30-second wait even though source materialization is an asynchronous real-stack operation.

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
- `workspace-release.spec.ts` relied on Playwright's implicit 30-second locator timeout while waiting for worker-driven materialization and indexing. That timeout is shorter than the valid bounded latency of a cold, full-campaign real stack; the test could fail before observing the user-visible `ready` state.

## Workaround

- Describe any temporary mitigation and remaining risk.

## Permanent Fix Plan

- Describe the intended durable fix.
- Retain the visible project-source catalog as the production readiness authority, but wait for its exact `ready` badge with an explicit 60-second source-readiness budget. Bound the complete dual-deployment journey at 180 seconds.

## Regression Coverage Needed

- List tests, fixtures, reproductions, alerts, or docs updates needed.
- The real root and `BASE_PATH` release journey now exercises sequential file, pasted-text, folder, and dataset imports, requiring each source's user-visible `ready` state before research begins. Focused result: 2/2 tests, 19 assertions. Full web E2E result: 88/88 tests, 1,048 assertions. Web typecheck passed.

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- Phase: [[02_Phases/Phase_10_v1_usable_research_workspace/Phase|Phase 10 v1 usable research workspace]]
- Step: [[02_Phases/Phase_10_v1_usable_research_workspace/Steps/Step_08_gate-v1-on-the-complete-browser-journey|STEP-10-08 Gate v1 on the Complete Browser Journey]]
<!-- AGENT-END:bug-related-notes -->

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-08-05 - Reported.
<!-- AGENT-END:bug-timeline -->
- 2026-08-05 - Fixed: replaced the implicit 30-second readiness wait with an explicit 60-second UI-state budget and set the complete root plus `BASE_PATH` journey budget to 180 seconds. Verified focused release, full web E2E, and web typecheck.
