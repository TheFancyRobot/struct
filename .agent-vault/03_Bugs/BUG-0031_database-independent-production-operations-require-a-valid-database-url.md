---
note_type: bug
template_version: 2
contract_version: 1
title: Database-independent production operations require a valid database URL
bug_id: BUG-0031
status: resolved
severity: sev-3
category: logic
reported_on: '2026-07-22'
fixed_on: '2026-07-22'
owner: ''
created: '2026-07-22'
updated: '2026-07-22'
related_notes:
  - '[[02_Phases/Phase_09_v1_production_hardening_and_release/Steps/Step_02_harden-deployments-migrations-backups-and-rollback|STEP-09-02 Harden Deployments Migrations Backups and Rollback]]'
tags:
  - agent-vault
  - bug
---

# BUG-0031 - Database-independent production operations require a valid database URL

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Database-independent production operations require a valid database URL.
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
`main()` calls `requiredEnvironment('DATABASE_URL')` and `parseLocalDatabaseTarget()` before dispatching on the requested operation. Therefore `application:verify`, `artifacts:backup`, and `artifacts:verify` reject an absent or non-PostgreSQL `DATABASE_URL` even though they do not use database access.

## Workaround

- Describe any temporary mitigation and remaining risk.

## Permanent Fix Plan

- Describe the intended durable fix.

## Regression Coverage Needed

- List tests, fixtures, reproductions, alerts, or docs updates needed.

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- Phase: [[02_Phases/Phase_09_v1_production_hardening_and_release/Phase|Phase 09 v1 production hardening and release]]
- Step: [[02_Phases/Phase_09_v1_production_hardening_and_release/Steps/Step_02_harden-deployments-migrations-backups-and-rollback|STEP-09-02 Harden Deployments Migrations Backups and Rollback]]
<!-- AGENT-END:bug-related-notes -->

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-07-22 - Reported.
<!-- AGENT-END:bug-timeline -->
- 2026-07-22 - Resolved: `main()` now acquires and validates `DATABASE_URL` only in database-backed command branches. Focused tests passed 14/14, including database-independent commands without `DATABASE_URL` and strict rejection for database-backed commands.
