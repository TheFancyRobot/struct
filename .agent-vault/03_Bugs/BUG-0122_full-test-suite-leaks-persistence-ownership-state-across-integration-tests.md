---
note_type: bug
template_version: 2
contract_version: 1
title: Full test suite leaks persistence ownership state across integration tests
bug_id: BUG-0122
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

# BUG-0122 - Full test suite leaks persistence ownership state across integration tests

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Full test suite leaks persistence ownership state across integration tests.
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
The PostgreSQL ownership integration fixture used fixed IDs but only removed them in `afterAll`. An interrupted prior run could leave those rows behind; its next `beforeAll` then failed on duplicate persistence ownership state.

## Workaround

- Describe any temporary mitigation and remaining risk.

## Permanent Fix Plan

- Describe the intended durable fix.
Reuse the existing exact-ID cleanup sequence before fixture seeding and in `afterAll`, so each run starts from an empty owned fixture scope.

## Regression Coverage Needed

- List tests, fixtures, reproductions, alerts, or docs updates needed.
Seeded the fixed ownership workspace before the focused integration test; the test now clears that stale row, seeds its fixture, and passes all 10 ownership cases.

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- None yet.
<!-- AGENT-END:bug-related-notes -->

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-08-05 - Reported.
<!-- AGENT-END:bug-timeline -->
