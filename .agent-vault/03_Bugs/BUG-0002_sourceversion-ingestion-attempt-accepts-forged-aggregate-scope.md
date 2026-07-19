---
note_type: bug
template_version: 2
contract_version: 1
title: SourceVersion ingestion attempt accepts forged aggregate scope
bug_id: BUG-0002
status: fixed
severity: sev-3
category: logic
reported_on: '2026-07-19'
fixed_on: '2026-07-19'
owner: ''
created: '2026-07-19'
updated: '2026-07-19'
related_notes:
  - '[[02_Phases/Phase_01_walking_skeleton/Steps/Step_03_implement-single-text-source-ingestion-and-artifact-storage|STEP-01-03 Implement Single Text Source Ingestion and Artifact Storage]]'
tags:
  - agent-vault
  - bug
---

# BUG-0002 - SourceVersion ingestion attempt accepts forged aggregate scope

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- SourceVersion ingestion attempt accepts forged aggregate scope.
- Related notes: [[02_Phases/Phase_01_walking_skeleton/Steps/Step_03_implement-single-text-source-ingestion-and-artifact-storage|STEP-01-03 Implement Single Text Source Ingestion and Artifact Storage]].

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
- `SourceVersionRepo.createForIngestionAttempt` fenced job ID, source ID, status, and attempt but omitted workspace and did not validate the supplied job aggregate against the version. Forged job metadata could renew and insert under a mismatched scope.

## Workaround

- Describe any temporary mitigation and remaining risk.

## Permanent Fix Plan

- Describe the intended durable fix.

## Regression Coverage Needed

- List tests, fixtures, reproductions, alerts, or docs updates needed.

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- Phase: [[02_Phases/Phase_01_walking_skeleton/Phase|Phase 01 walking skeleton]]
- Step: [[02_Phases/Phase_01_walking_skeleton/Steps/Step_03_implement-single-text-source-ingestion-and-artifact-storage|STEP-01-03 Implement Single Text Source Ingestion and Artifact Storage]]
<!-- AGENT-END:bug-related-notes -->

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-07-19 - Reported.
<!-- AGENT-END:bug-timeline -->
