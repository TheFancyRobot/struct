---
note_type: bug
template_version: 2
contract_version: 1
title: Stack-up operation can validate a stale data-engine image after sidecar source changes
bug_id: BUG-0029
status: resolved
severity: sev-3
category: logic
reported_on: '2026-07-22'
fixed_on: '2026-07-22'
owner: ''
created: '2026-07-22'
updated: '2026-07-22'
related_notes:
  - '[[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_02_implement-parquet-materialization-and-data-profiling|STEP-04-02 Implement Parquet Materialization and Data Profiling]]'
tags:
  - agent-vault
  - bug
---

# BUG-0029 - Stack-up operation can validate a stale data-engine image after sidecar source changes

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Stack-up operation can validate a stale data-engine image after sidecar source changes.
- Related notes: [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_02_implement-parquet-materialization-and-data-profiling|STEP-04-02 Implement Parquet Materialization and Data Profiling]].

## Observed Behavior

- Describe what actually happens.
`bun scripts/production-operations.ts stack:up` returned successfully but did not rebuild `struct-data-engine:local`. The running `/opt/struct-data-engine/server.mjs` SHA-256 (`162c…`) differed from the workspace `services/data-engine-sidecar/server.mjs` SHA-256 (`3c6d…`), and the live lineage integration suite therefore exercised stale sidecar code.

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
The `stack:up` path runs `docker compose up -d --wait` without `--build`; Compose reused the existing tagged image even though files in its build context had changed. `docker compose up -d --build --wait --force-recreate data-engine data-engine-gateway` rebuilt the image, deployed source containing `materializedSourceSql`, and let the live suite pass.

## Workaround

- Describe any temporary mitigation and remaining risk.

## Permanent Fix Plan

- Describe the intended durable fix.

## Regression Coverage Needed

- List tests, fixtures, reproductions, alerts, or docs updates needed.

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- Phase: [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Phase|Phase 04 structured datasets and deterministic sql]]
- Step: [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_02_implement-parquet-materialization-and-data-profiling|STEP-04-02 Implement Parquet Materialization and Data Profiling]]
<!-- AGENT-END:bug-related-notes -->

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-07-22 - Reported.
<!-- AGENT-END:bug-timeline -->
- 2026-07-22 - Resolved: `stack:up` and `stack:restart` now use Compose `--build`; unit test passed 9/9, a stack-up produced matching container/workspace source SHA-256 values, and live sidecar integration passed 3/3.
