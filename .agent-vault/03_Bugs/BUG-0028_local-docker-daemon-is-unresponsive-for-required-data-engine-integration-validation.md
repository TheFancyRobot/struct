---
note_type: bug
template_version: 2
contract_version: 1
title: Local Docker Daemon Is Unresponsive for Required Data-Engine Integration Validation
bug_id: BUG-0028
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

# BUG-0028 - Local Docker Daemon Is Unresponsive for Required Data-Engine Integration Validation

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Local Docker Daemon Is Unresponsive for Required Data-Engine Integration Validation.
- Related notes: [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_02_implement-parquet-materialization-and-data-profiling|STEP-04-02 Implement Parquet Materialization and Data Profiling]].

## Observed Behavior

- Describe what actually happens.
Required sidecar integration validation cannot start: port 4300 has no listener, `bun scripts/production-operations.ts stack:up` stayed silent and hung for more than six minutes, and direct `docker info` / `docker compose ps` calls also hung. The processes were terminated. This is an external local Docker-daemon blocker, not an application test failure.

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
Docker Desktop left stale `com.docker.backend` processes after shutdown. They retained the broken backend state and caused Docker CLI calls to hang. Terminating the stale backend processes and launching Docker Desktop started a fresh VM; `docker version` then returned server `29.4.2`, and the Struct gateway/data-engine/Postgres services became healthy.

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
- 2026-07-22 - Resolved: terminated stale Docker Desktop backend processes, restarted Docker Desktop, verified healthy Struct sidecar services, and ran the live lineage integration suite successfully (3/3).
