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

- In the cold, dual-deployment release journey, the `renewals.md` source can still be materializing or indexing after Playwright's implicit 30-second locator timeout. The test then fails before the catalog displays that source's user-visible `ready` badge.

## Expected Behavior

- The release journey must wait for the exact catalog entry to display `ready` before beginning research, while failing within an explicit bounded budget if the source never becomes ready.

## Reproduction Steps

1. Start the real application stack in the release-journey configuration for both the root deployment and the `BASE_PATH` deployment.
2. Run the release journey, import `renewals.md`, and wait for its project-source catalog entry.
3. On a cold or contended run, materialization and indexing can outlast the implicit 30-second locator timeout, so the readiness assertion fails before the `ready` badge appears.

## Scope / Blast Radius

- Affected surface: `apps/web/e2e/workspace-release.spec.ts` and the browser release campaign for both root and `BASE_PATH` deployments. The defect affects test readiness and can create a false release-blocking failure; it does not change production source materialization behavior.

## Suspected Root Cause

- The failure appeared timing-related because source readiness is driven by the real worker and cold stack startup, while the assertion had no explicit readiness budget beyond Playwright's default locator timeout.

## Confirmed Root Cause

- `workspace-release.spec.ts` relied on Playwright's implicit 30-second locator timeout while waiting for worker-driven materialization and indexing. That timeout is shorter than the valid bounded latency of a cold, full-campaign real stack; the test could fail before observing the user-visible `ready` state.

## Workaround

- Re-run the affected release journey after the stack has warmed. This is not an acceptable release gate because a cold real-stack run can still exceed 30 seconds and produce the same false failure.

## Permanent Fix Plan

- Retain the visible project-source catalog as the production readiness authority, but wait for its exact `ready` badge with an explicit 60-second source-readiness budget. Bound the complete dual-deployment journey at 180 seconds.

## Regression Coverage Needed

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
- 2026-08-05 - Review remediation: replaced all template prompts with the observed cold-stack readiness failure, explicit expected UI state, reproducible root and `BASE_PATH` scenario, affected release-gate scope, confirmed timeout cause, rejected warm-run workaround, permanent 60-second readiness/180-second journey budgets, and the focused plus full-E2E regression evidence.
