---
note_type: bug
template_version: 2
contract_version: 1
title: Completed Step Snapshots Contradict Canonical Status Across Vault
bug_id: BUG-0020
status: resolved
severity: sev-2
category: logic
reported_on: '2026-07-22'
fixed_on: '2026-07-23'
owner: Codex
created: '2026-07-22'
updated: '2026-07-22'
related_notes:
  - '[[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_02_implement-parquet-materialization-and-data-profiling|STEP-04-02 Implement Parquet Materialization and Data Profiling]]'
  - '[[05_Sessions/2026-07-22-161910-implement-parquet-materialization-and-data-profiling-codex|SESSION-2026-07-22-161910 Codex session for Implement Parquet Materialization and Data Profiling]]'
tags:
  - agent-vault
  - bug
---

# BUG-0020 - Completed Step Snapshots Contradict Canonical Status Across Vault

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Completed Step Snapshots Contradict Canonical Status Across Vault.
- Related notes: [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_02_implement-parquet-materialization-and-data-profiling|STEP-04-02 Implement Parquet Materialization and Data Profiling]], [[05_Sessions/2026-07-22-161910-implement-parquet-materialization-and-data-profiling-codex|SESSION-2026-07-22-161910 Codex session for Implement Parquet Materialization and Data Profiling]].

## Observed Behavior

- Thirteen step notes have canonical `status: completed` frontmatter while their agent-managed snapshots still say `planned` or `in_progress`; STEP-09-06 also retains `context_status: active`, and completed Phase 04/05/06 companion outcomes retain obsolete pre-merge handoffs.

## Expected Behavior

- Every completed step must present one consistent completed state across frontmatter, agent-managed snapshot, outcome, and generated context so future agents do not repeat merged work.

## Reproduction Steps

1. Scan `.agent-vault/02_Phases/Phase_*/Steps/Step_*.md` and parse canonical frontmatter `status` plus the `step-agent-managed-snapshot` status.
2. Compare the two values for every step note.
3. Observe thirteen completed steps whose snapshots remain `planned` or `in_progress`, including STEP-01-06, STEP-02-01, STEP-03-02, STEP-04-02/03/04, all six Phase 08 steps, and STEP-09-05; separately observe completed STEP-09-06 with `context_status: active` and stale pre-merge outcome prose in STEP-04-01/02/03/04/05, STEP-05-06, and STEP-06-03/04.

## Scope / Blast Radius

- Agent Vault roadmap context, resume behavior, at least fourteen completed step indexes, eight completed-step outcomes, and any agent that loads narrow context without independently reconciling frontmatter.

## Suspected Root Cause

- Step completion updated canonical frontmatter without refreshing the agent-managed snapshot and final outcome; generated validation checks syntax and links but not semantic status equality.

## Confirmed Root Cause

- Repository-wide status comparisons report thirteen snapshot mismatches and one additional stale active context; an outcome scan finds eight completed steps that still claim review or merge is pending. The affected notes contradict completed frontmatter and merged roadmap phases.

## Workaround

- Agents can manually privilege canonical frontmatter, but narrow context loading still exposes contradictory instructions and can repeat completed work.

## Permanent Fix Plan

- Synchronize every mismatched snapshot and stale outcome with the completed canonical state, then add an automated vault regression check that fails when canonical and snapshot statuses diverge.

## Regression Coverage Needed

- Repository-wide semantic status parity test, clean vault doctor, and a second mismatch scan returning zero results.

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- Phase: [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Phase|Phase 04 structured datasets and deterministic sql]]
- Step: [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_02_implement-parquet-materialization-and-data-profiling|STEP-04-02 Implement Parquet Materialization and Data Profiling]]
- Session: [[05_Sessions/2026-07-22-161910-implement-parquet-materialization-and-data-profiling-codex|SESSION-2026-07-22-161910 Codex session for Implement Parquet Materialization and Data Profiling]]
<!-- AGENT-END:bug-related-notes -->

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-07-22 - Reported.
<!-- AGENT-END:bug-timeline -->
- 2026-07-22 - Resolved: synchronized every completed-step snapshot and stale active step context, added repository-owned `vault:parity` regression coverage, and independently verified 0 parity issues plus a clean vault doctor.
- 2026-07-23 - Resolution status recorded after the repository-owned parity regression and vault doctor passed again.
