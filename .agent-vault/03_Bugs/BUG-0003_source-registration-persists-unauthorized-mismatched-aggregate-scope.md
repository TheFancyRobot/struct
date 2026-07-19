---
note_type: bug
template_version: 2
contract_version: 1
title: Source registration persists unauthorized mismatched aggregate scope
bug_id: BUG-0003
status: fixed
severity: sev-3
category: logic
reported_on: '2026-07-19'
fixed_on: '2026-07-19'
owner: source-registration-remediator
created: '2026-07-19'
updated: '2026-07-19'
related_notes:
  - '[[02_Phases/Phase_01_walking_skeleton/Steps/Step_03_implement-single-text-source-ingestion-and-artifact-storage|STEP-01-03 Implement Single Text Source Ingestion and Artifact Storage]]'
tags:
  - agent-vault
  - bug
---

# BUG-0003 - Source registration persists unauthorized mismatched aggregate scope

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Source registration persists unauthorized mismatched aggregate scope.
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
- `SourceRegistrationRepo.create` accepted independent source, job, and event scope fields without aggregate validation or project-to-workspace authorization. The polymorphic job/event columns have no database foreign key capable of preventing mismatched durable metadata.

## Workaround

- Describe any temporary mitigation and remaining risk.

## Permanent Fix Plan

- Describe the intended durable fix.
- Implemented pre-write validation of source/job/event links, types, initial status, attempt state, and shared payload fields.
- The transaction now locks and authorizes the source project against the registration workspace, then derives persisted project/workspace/entity/type scope from that authorized aggregate.

## Regression Coverage Needed

- List tests, fixtures, reproductions, alerts, or docs updates needed.
- Added unit adversarial coverage for entity, type, status, project, workspace, and payload mismatches, with assertions that no insert runs.
- Added serial real-PostgreSQL cross-workspace/project and forged aggregate coverage proving no partial source/job/event rows, plus a valid authorized control.

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- Phase: [[02_Phases/Phase_01_walking_skeleton/Phase|Phase 01 walking skeleton]]
- Step: [[02_Phases/Phase_01_walking_skeleton/Steps/Step_03_implement-single-text-source-ingestion-and-artifact-storage|STEP-01-03 Implement Single Text Source Ingestion and Artifact Storage]]
<!-- AGENT-END:bug-related-notes -->

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-07-19 - Reported.
<!-- AGENT-END:bug-timeline -->
- 2026-07-19 - Fixed and validated in [[05_Sessions/2026-07-19-021959-implement-single-text-source-ingestion-and-artifact-storage-source-registration-remediator|SESSION-2026-07-19-021959 source-registration-remediator session]].
- 2026-07-19 - Independent adversarial review found that nonempty but non-canonical staged references could still be persisted. Follow-up remediation introduced one bounded, path-safe canonical staged-reference predicate shared by persistence, storage, and the ingestion worker; invalid-scheme, malformed UUID, traversal, and oversized references now fail with `ValidationError` before SQL.
- 2026-07-19 - A second independent adversarial review reproduced a case-folding alias on the default macOS filesystem: storage emitted `.../Notes.MD`, while accepted `.../notes.md` resolved to the same bytes. The permanent boundary now emits only lowercase-ASCII internal staged filenames and rejects mixed-case aliases in domain validation, persistence, worker decoding, and storage reads; the original mixed-case upload name remains on `Source.name`.
