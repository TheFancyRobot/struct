---
note_type: bug
template_version: 2
contract_version: 1
title: Ingestion Heartbeat Failure Test Asserts Redacted Persistence Detail
bug_id: BUG-0025
status: resolved
severity: sev-3
category: logic
reported_on: '2026-07-22'
fixed_on: '2026-07-22'
owner: root-orchestrator
created: '2026-07-22'
updated: '2026-07-22'
related_notes:
  - '[[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_06_test-large-tree-refresh-failures-and-recovery|STEP-03-06 Test Large-Tree Refresh Failures and Recovery]]'
tags:
  - agent-vault
  - bug
---

# BUG-0025 - Ingestion Heartbeat Failure Test Asserts Redacted Persistence Detail

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Ingestion Heartbeat Failure Test Asserts Redacted Persistence Detail.
- Related notes: [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_06_test-large-tree-refresh-failures-and-recovery|STEP-03-06 Test Large-Tree Refresh Failures and Recovery]].

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
- Phase: [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Phase|Phase 03 durable directory ingestion and source refresh]]
- Step: [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_06_test-large-tree-refresh-failures-and-recovery|STEP-03-06 Test Large-Tree Refresh Failures and Recovery]]
<!-- AGENT-END:bug-related-notes -->

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-07-22 - Reported.
- 2026-07-22 - Resolved by updating the ingestion heartbeat test to inject raw database, credential, and path markers while asserting the typed safe `QueryError`, non-leakage through Effect representations, and interruption/no-late-transition behavior.
- 2026-07-22 - Verified with fresh spec and quality reviews.
<!-- AGENT-END:bug-timeline -->
