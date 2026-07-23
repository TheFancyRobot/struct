---
note_type: bug
template_version: 2
contract_version: 1
title: E2E App Server Helper Adopts Stale Port Listeners and Leaves Orphans
bug_id: BUG-0027
status: resolved
severity: sev-3
category: logic
reported_on: '2026-07-22'
fixed_on: '2026-07-22'
owner: root-orchestrator
created: '2026-07-22'
updated: '2026-07-22'
related_notes:
  - '[[02_Phases/Phase_09_v1_production_hardening_and_release/Steps/Step_06_publish-v1-documentation-accessibility-and-release-checklist|STEP-09-06 Publish v1 Documentation Accessibility and Release Checklist]]'
tags:
  - agent-vault
  - bug
---

# BUG-0027 - E2E App Server Helper Adopts Stale Port Listeners and Leaves Orphans

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- E2E App Server Helper Adopts Stale Port Listeners and Leaves Orphans.
- Related notes: [[02_Phases/Phase_09_v1_production_hardening_and_release/Steps/Step_06_publish-v1-documentation-accessibility-and-release-checklist|STEP-09-06 Publish v1 Documentation Accessibility and Release Checklist]].

## Observed Behavior

- Describe what actually happens.
The canonical grouped E2E command `bun test --timeout 60000 --max-concurrency 1 ./apps/web/e2e` failed in the final recursive-analysis theme test after the earlier suites passed, while the recursive spec alone passed. Inspection found an orphan `bun src/server.ts` process (parent PID 1) listening on port 4174.

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
`startAppServer` considered a generic successful HTTP fetch to be readiness. With an existing listener on the requested port, this fetch succeeded before its newly spawned server failed to bind, so it returned the wrong process handle. Later cleanup could not stop the stale listener, producing order-dependent E2E behavior.

## Workaround

- Describe any temporary mitigation and remaining risk.

## Permanent Fix Plan

- Describe the intended durable fix.
Implemented a loopback occupancy probe before spawning the E2E web server. A live listener now fails closed before readiness polling. Startup readiness failures kill and await the spawned child. The lifecycle regression test now always cleans up both first and second servers with `try/finally`.

## Regression Coverage Needed

- List tests, fixtures, reproductions, alerts, or docs updates needed.
Added focused coverage that a managed server occupying port 4190 causes a second startup attempt to reject. The normal same-port stop/restart test is exception-safe. Independent spec and final quality reviews passed. The ordered five-spec E2E reproduction passed twice after the fix (23 tests), and no listeners remained on the E2E ports.

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- Phase: [[02_Phases/Phase_09_v1_production_hardening_and_release/Phase|Phase 09 v1 production hardening and release]]
- Step: [[02_Phases/Phase_09_v1_production_hardening_and_release/Steps/Step_06_publish-v1-documentation-accessibility-and-release-checklist|STEP-09-06 Publish v1 Documentation Accessibility and Release Checklist]]
<!-- AGENT-END:bug-related-notes -->

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-07-22 - Reported.
- 2026-07-22 - Verified with the focused occupied-port regression, the exception-safe same-port stop/restart test, and two passing ordered five-spec E2E reproductions (23 tests each) with no listeners left behind.
<!-- AGENT-END:bug-timeline -->
