---
note_type: bug
template_version: 2
contract_version: 1
title: Canonical v1 performance resilience report hashes are stale
bug_id: BUG-0121
status: fixed
severity: sev-3
category: logic
reported_on: '2026-08-05'
fixed_on: '2026-08-05'
owner: ''
created: '2026-08-05'
updated: '2026-08-05'
related_notes: '[[02_Phases/Phase_09_v1_production_hardening_and_release/Phase|PHASE-09 v1 Production Hardening and Release]]'
tags:
  - agent-vault
  - bug
---

# BUG-0121 - Canonical v1 performance resilience report hashes are stale

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Canonical v1 performance resilience report hashes are stale.
- Related notes: none linked yet.

## Observed Behavior

- Describe what actually happens.

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

## Workaround

- Describe any temporary mitigation and remaining risk.

## Permanent Fix Plan

- Describe the intended durable fix.

## Regression Coverage Needed

- List tests, fixtures, reproductions, alerts, or docs updates needed.

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- None yet.
<!-- AGENT-END:bug-related-notes -->

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-08-05 - Reported.
<!-- AGENT-END:bug-timeline -->
- 2026-08-05 - Fixed: regenerated the canonical v1 performance/resilience report after `apps/web/src/hooks/useSSE.test.ts` changed; its source-evidence hash and derived `reportSha256` were stale. Verified with `bun packages/evaluation/src/v1-performance-resilience.ts --check` and the focused Bun test (3 passing).
