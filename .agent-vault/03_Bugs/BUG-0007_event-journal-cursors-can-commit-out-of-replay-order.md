---
note_type: bug
template_version: 2
contract_version: 1
title: Event journal cursors can commit out of replay order
bug_id: BUG-0007
status: fixed
severity: sev-3
category: logic
reported_on: '2026-07-19'
fixed_on: '2026-07-19'
owner: step-01-04-event-cursor-commit-order-remediation
created: '2026-07-19'
updated: '2026-07-19'
related_notes:
  - '[[02_Phases/Phase_01_walking_skeleton/Steps/Step_04_implement-deterministic-retrieval-and-fred-research-workflow|STEP-01-04 Implement Deterministic Retrieval and Fred Research Workflow]]'
tags:
  - agent-vault
  - bug
---

# BUG-0007 - Event journal cursors can commit out of replay order

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Event journal cursors can commit out of replay order.
- Related notes: [[02_Phases/Phase_01_walking_skeleton/Steps/Step_04_implement-deterministic-retrieval-and-fred-research-workflow|STEP-01-04 Implement Deterministic Retrieval and Fred Research Workflow]].

## Observed Behavior

- A transaction could allocate lower cursor A and remain open while a second transaction allocated and committed higher cursor B. A reconnect could persist B as its checkpoint; after A committed, `WHERE cursor > B` could never return A.

## Expected Behavior

- Cursor order must match commit visibility: before a higher cursor can become observable, every transaction that allocated a lower cursor must have committed or rolled back. Rollback gaps are allowed.

## Reproduction Steps

1. Begin transaction A and insert an event, allocating the lower sequence cursor without committing.
2. On connection B, insert and commit another event, allocating a higher cursor.
3. Observe B and retain its cursor as a reconnect checkpoint.
4. Commit A, then query `WHERE cursor > checkpoint`; A is present but permanently excluded.

## Scope / Blast Radius

- Every `event_journal` insert path was affected because all relied on the same non-transactional `BIGSERIAL` default. Any SSE/replay consumer checkpointing the highest visible cursor could silently miss a late lower-cursor ingestion or research event.

## Suspected Root Cause

- The cursor sequence was suspected because PostgreSQL sequence increments are not rolled back or ordered by transaction commit.

## Confirmed Root Cause

- `event_journal.cursor` uses `BIGSERIAL`, whose sequence value is allocated before transaction commit. A transaction with a lower cursor can commit after a higher cursor is observed as a reconnect checkpoint, so `WHERE cursor > checkpoint` permanently misses the late event.

## Workaround

- No caller-side workaround is safe for all insert paths. Consumers must deploy migration `0004_event_journal_commit_order` before treating the highest visible cursor as a complete replay checkpoint.

## Permanent Fix Plan

- Implemented reversible migration `0004_event_journal_commit_order`. It removes the column default and installs a `BEFORE INSERT` trigger that takes a relation-scoped transaction advisory lock before allocating the owned sequence. The trigger overrides explicit cursors, so direct SQL and every repository path receive the same invariant automatically.
- Post-fix independent review found one upgrade edge: the legacy schema allowed explicit zero or negative cursors, but `setval` cannot accept a value below the owned sequence minimum. Migration `0004` now reads `pg_sequence.seqmin`; empty or below-minimum legacy states reset to that minimum with `is_called = FALSE`, while a valid positive maximum remains the last-called value so the next allocation is `MAX(cursor) + 1`.

## Regression Coverage Needed

- Added a deterministic two-connection PostgreSQL suite that reproduces the legacy A-allocates/B-commits/A-commits replay loss under the down migration, proves B blocks under the forward migration, verifies replay after the safe checkpoint, rollback gaps, concurrent uniqueness, explicit-cursor override, and down/up round-trip behavior.
- Added real-PostgreSQL upgrade cases for an empty journal, a sole zero cursor, a sole negative cursor, mixed nonpositive cursors, and a positive legacy maximum. Each case verifies a positive next allocation, exact maximum synchronization, and trigger override of a supplied cursor.

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- Phase: [[02_Phases/Phase_01_walking_skeleton/Phase|Phase 01 walking skeleton]]
- Step: [[02_Phases/Phase_01_walking_skeleton/Steps/Step_04_implement-deterministic-retrieval-and-fred-research-workflow|STEP-01-04 Implement Deterministic Retrieval and Fred Research Workflow]]
<!-- AGENT-END:bug-related-notes -->

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-07-19 - Reported.
<!-- AGENT-END:bug-timeline -->
- 2026-07-19 - Fixed with migration `0004_event_journal_commit_order` and deterministic real-PostgreSQL concurrency/replay coverage.
- 2026-07-19 — Scope correction: the project is unreleased greenfield and has no supported legacy databases. Removed synthetic nonpositive-cursor upgrade compatibility and sequence-repair code; migration validation remains focused on clean/current schemas and the real commit-order replay invariant.
