---
note_type: bug
template_version: 2
contract_version: 1
title: Generic EventJournal append bypasses typed transition contracts
bug_id: BUG-0008
status: fixed
severity: sev-3
category: logic
reported_on: '2026-07-19'
fixed_on: '2026-07-19'
owner: generic-event-append-remediator
created: '2026-07-19'
updated: '2026-07-19'
related_notes:
  - '[[02_Phases/Phase_01_walking_skeleton/Steps/Step_04_implement-deterministic-retrieval-and-fred-research-workflow|STEP-01-04 Implement Deterministic Retrieval and Fred Research Workflow]]'
tags:
  - agent-vault
  - bug
---

# BUG-0008 - Generic EventJournal append bypasses typed transition contracts

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Generic EventJournal append bypasses typed transition contracts.
- Related notes: [[02_Phases/Phase_01_walking_skeleton/Steps/Step_04_implement-deterministic-retrieval-and-fred-research-workflow|STEP-01-04 Implement Deterministic Retrieval and Fred Research Workflow]].

## Observed Behavior

- Describe what actually happens.

## Expected Behavior

- Describe what should happen instead.
- Public journal access is read-only. Every journal write must be an atomic side effect of a typed aggregate-specific transition that validates ownership, scope, event kind, and payload.

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
- The exported generic `EventJournalRepo.append` inserts caller-controlled events without ingestion/research aggregate validation. A real-PostgreSQL probe persisted a forged `research-completed` event for a nonexistent run.

## Workaround

- Describe any temporary mitigation and remaining risk.

## Permanent Fix Plan

- Describe the intended durable fix.
- Implemented: removed the exported arbitrary `EventJournalRepo.append` writer and its repository interface.
- Replaced the remaining query capability with `EventJournalReader` / `EventJournalReadRepository`, with Effect dynamic accessors disabled.
- Journal writes remain available only through source-registration, ingestion-attempt, and research-attempt services that validate and fence their owning aggregate.

## Regression Coverage Needed

- List tests, fixtures, reproductions, alerts, or docs updates needed.
- Completed: package API tests prove the generic writer names are absent and the reader exposes SELECT-only cursor-ordered behavior.
- Completed: a real-PostgreSQL adversarial test proves a forged `research-completed` event for a nonexistent run cannot be persisted through any exported generic journal API.
- Completed: real-PostgreSQL typed ingestion and research event-contract suites remain green.

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- Phase: [[02_Phases/Phase_01_walking_skeleton/Phase|Phase 01 walking skeleton]]
- Step: [[02_Phases/Phase_01_walking_skeleton/Steps/Step_04_implement-deterministic-retrieval-and-fred-research-workflow|STEP-01-04 Implement Deterministic Retrieval and Fred Research Workflow]]
<!-- AGENT-END:bug-related-notes -->

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-07-19 - Reported.
<!-- AGENT-END:bug-timeline -->
- 2026-07-19 - Fixed by deleting the unrestricted writer, retaining an explicitly read-only reader, and validating the export boundary against PostgreSQL. Session: [[05_Sessions/2026-07-19-032025-implement-deterministic-retrieval-and-fred-research-workflow-generic-event-append-remediator|SESSION-2026-07-19-032025 generic-event-append-remediator]].
