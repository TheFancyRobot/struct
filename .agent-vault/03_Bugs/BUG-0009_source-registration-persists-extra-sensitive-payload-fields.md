---
note_type: bug
template_version: 2
contract_version: 1
title: Source registration persists extra sensitive payload fields
bug_id: BUG-0009
status: fixed
severity: sev-3
category: logic
reported_on: '2026-07-19'
fixed_on: '2026-07-19'
owner: step-01-04-registration-payload-leak-remediation
created: '2026-07-19'
updated: '2026-07-19'
related_notes:
  - '[[02_Phases/Phase_01_walking_skeleton/Steps/Step_03_implement-single-text-source-ingestion-and-artifact-storage|STEP-01-03 Implement Single Text Source Ingestion and Artifact Storage]]'
tags:
  - agent-vault
  - bug
---

# BUG-0009 - Source registration persists extra sensitive payload fields

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Source registration persists extra sensitive payload fields.
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
- Source registration checked required payload fields but not an exact key set, then persisted the caller payload verbatim. A PostgreSQL probe stored extra `sourceText` and absolute-path fields in both the job and journal event.

## Workaround

- Describe any temporary mitigation and remaining risk.

## Permanent Fix Plan

- Describe the intended durable fix.
- Fixed: `SourceRegistrationRepo` now requires exact source, job, event, job-payload, and event-payload key sets; validates UUIDs, scalar types, name/byte/attempt bounds, timestamps, and the initial event cursor before any SQL.
- Fixed: persisted JSONB is rebuilt from validated aggregate fields and the authorized project/workspace plus the canonical staged artifact ref; caller payload objects are never serialized verbatim.
- The API producer now satisfies the exported exact registration payload contracts.

## Regression Coverage Needed

- List tests, fixtures, reproductions, alerts, or docs updates needed.
- Completed unit coverage rejects extra `sourceText`, absolute paths, secrets, nested/unknown objects, invalid scalar types, excessive sizes, and malformed event identity/cursor/timestamp before SQL.
- Completed serial real-PostgreSQL coverage proves those rejected aggregates persist no source, job, or event rows and verifies a valid aggregate stores only the canonical allowlisted payload projections.

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- Phase: [[02_Phases/Phase_01_walking_skeleton/Phase|Phase 01 walking skeleton]]
- Step: [[02_Phases/Phase_01_walking_skeleton/Steps/Step_03_implement-single-text-source-ingestion-and-artifact-storage|STEP-01-03 Implement Single Text Source Ingestion and Artifact Storage]]
<!-- AGENT-END:bug-related-notes -->

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-07-19 - Reported.
<!-- AGENT-END:bug-timeline -->
- 2026-07-19 - Fixed with exact fail-closed registration contracts, canonical persisted payload reconstruction, API producer typing, documentation, and unit plus real-PostgreSQL rollback regressions. Session: [[05_Sessions/2026-07-19-032516-implement-single-text-source-ingestion-and-artifact-storage-step-01-04-registration-payload-leak-remediation|SESSION-2026-07-19-032516]].
