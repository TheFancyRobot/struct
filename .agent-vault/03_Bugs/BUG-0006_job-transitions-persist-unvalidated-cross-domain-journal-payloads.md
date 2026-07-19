---
note_type: bug
template_version: 2
contract_version: 1
title: Job transitions persist unvalidated cross-domain journal payloads
bug_id: BUG-0006
status: fixed
severity: sev-3
category: logic
reported_on: '2026-07-19'
fixed_on: '2026-07-19'
owner: step-01-04-ingestion-provenance-metadata-remediation
created: '2026-07-19'
updated: '2026-07-19'
related_notes:
  - '[[02_Phases/Phase_01_walking_skeleton/Steps/Step_04_implement-deterministic-retrieval-and-fred-research-workflow|STEP-01-04 Implement Deterministic Retrieval and Fred Research Workflow]]'
tags:
  - agent-vault
  - bug
session: '[[05_Sessions/2026-07-19-025731-implement-deterministic-retrieval-and-fred-research-workflow-step-01-04-ingestion-event-contract-remediation|SESSION-2026-07-19-025731 ingestion event contract remediation]]'
---

# BUG-0006 - Job transitions persist unvalidated cross-domain journal payloads

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Job transitions persist unvalidated cross-domain journal payloads.
- Related notes: [[02_Phases/Phase_01_walking_skeleton/Steps/Step_04_implement-deterministic-retrieval-and-fred-research-workflow|STEP-01-04 Implement Deterministic Retrieval and Fred Research Workflow]].

## Observed Behavior

- Describe what actually happens.
- `JobQueueRepo` accepted transition events with arbitrary payload keys and caller-controlled provenance so long as broad event metadata and the claimed attempt matched.

## Expected Behavior

- Describe what should happen instead.
- Each append, completion, retry, and terminal-failure transition accepts only its exact cursor/type/payload contract, binds provenance to the owned job and immutable SourceVersion, and rejects malformed or foreign data without heartbeat, status, or event side effects.

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
- Job/research transition repositories validate top-level lease scope but not exact per-transition event type, cursor, or payload linkage. Reproductions persisted an ingestion completion with foreign source-version/artifact fields and a research in-progress event carrying `ingestion-completed` plus arbitrary payload.
- Follow-up review found the worker used only `attempts < maxAttempts` to choose pending versus failed, so every deterministic or unknown ingestion error was requeued. The repository also encoded the same incorrect inversion by forbidding `fail` before exhaustion, making first-attempt terminal rejection impossible.

## Workaround

- Describe any temporary mitigation and remaining risk.

## Permanent Fix Plan

- Describe the intended durable fix.
- Implemented `IngestionEventValidationError` and exact event/payload validation for all four transitions.
- Ownership is selected and locked by job/source/workspace/status/attempt before mutation. SourceVersion provenance and persisted job byte length are revalidated inside the transaction; persisted payloads are rebuilt from authoritative state.
- Pending is permitted only with retry budget remaining, failure only when exhausted, and all invalid/conflicting operations roll back atomically.
- Resolved the research transition half of BUG-0006 by enforcing an exact repository event contract before journal writes.
- `appendInProgressEvent` accepts only `retrieval-completed` and `citations-validated`, requires caller cursor `0`, exact bounded payload keys/types, and verifies every retrieval source version against the persisted registered job source set.
- Persisted research transition payloads derive `jobId` and `attempt` from the owned database-fenced job; workspace, entity, and terminal scope are also derived from ownership rather than caller metadata.
- Completion requires exact answer/citation consistency, an exact current-attempt `citations-validated` event with the same citation count, registered source membership, and live tenant/project authorization.
- Failure accepts only a bounded alphanumeric error tag plus the fixed sanitized message `Research failed`; the worker normalizes unsafe or oversized tags to `ResearchWorkflowError`.
- Stale recovery now emits the same job/attempt-linked sanitized failure shape.
- Retryability is now a typed, fail-closed worker classification. Only known transient infrastructure errors or `DeclaredRetryableIngestionError` may requeue; deterministic validation/authorization/path/ref/unsupported/schema/hash/integrity/conflict and unknown errors fail terminally.
- The exact sanitized failure payload now includes boolean `retryable`. Pending requires `retryable: true` plus durable budget; fail permits `retryable: false` at any attempt or `retryable: true` only when exhausted. Persistence derives ownership fields from the locked row.
- Final provenance remediation removes `rawRef` from the `file-processed` journal contract because no current durable row can authorize it. The repository verifies the caller's manifest/content/source-version/byte-length linkage, then reconstructs the persisted payload from the locked `SourceVersion` and job; `normalizedRef` is derived from the owned content hash.
- Every claimed ingestion payload and stale-exhaustion terminal payload includes ownership-derived `jobId` and `attempt`. Event workspace/entity/type are likewise persisted from the locked row.
- All four claimed transitions reject noncanonical journal UUIDs, nonzero cursors, and non-bigint, negative, or greater-than-safe timestamps with typed validation before opening a database transaction.

## Regression Coverage Needed

- List tests, fixtures, reproductions, alerts, or docs updates needed.
- Complete: dedicated unit and serial PostgreSQL matrices exercise every transition with wrong event type, nonzero cursor, extra/cross-domain keys, malformed types/UUIDs/refs, foreign SourceVersions, mismatched hashes/manifests/byte lengths, unsafe failure payloads, retry inversion, exact no-side-effect snapshots, and valid controls.
- Added forged unit coverage for cross-domain event types, nonzero cursors, extra/missing/wrong payload keys, out-of-range counts, unauthorized source IDs, citation-count mismatches, unsafe failure details, and valid normalized controls.
- Added a serial PostgreSQL contract suite that proves forged append/complete/fail attempts create no journal rows or terminal state, proves valid controls, and rejects a `citations-validated` event replayed from a prior attempt.
- Verified worker failure-tag sanitization does not persist arbitrary error details.
- Complete: table-driven worker classification covers explicit transient tags and deterministic validation, authorization, path/ref, unsupported, oversized, UTF-8, schema, hash/integrity, conflict, and unknown failures. Serial PostgreSQL controls prove nonretryable first-attempt failure, budgeted retry pending, exhausted retry terminal, and idempotent terminal replay.
- Completed unit and serial PostgreSQL coverage for forged canonical raw provenance, foreign/mismatched manifest and source-version provenance, malformed/noncanonical event IDs, nonzero cursors, non-bigint/negative/unsafe timestamps, missing/forged attempt identity, retryability inversion, first-attempt deterministic terminal failure, exhausted retryable failure, stale ownership, atomic rollback, and valid controls.

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- Phase: [[02_Phases/Phase_01_walking_skeleton/Phase|Phase 01 walking skeleton]]
- Step: [[02_Phases/Phase_01_walking_skeleton/Steps/Step_04_implement-deterministic-retrieval-and-fred-research-workflow|STEP-01-04 Implement Deterministic Retrieval and Fred Research Workflow]]
<!-- AGENT-END:bug-related-notes -->

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-07-19 - Reported.
<!-- AGENT-END:bug-timeline -->
- 2026-07-19 - Fixed by [[05_Sessions/2026-07-19-025731-implement-deterministic-retrieval-and-fred-research-workflow-step-01-04-ingestion-event-contract-remediation|SESSION-2026-07-19-025731 ingestion event contract remediation]]; 249 maintained app/package tests passed with PostgreSQL enabled.
- 2026-07-19 - Final combined-state validation superseded the earlier count: 250 maintained app/package tests passed, 0 failed, with typecheck, lint, dependency boundaries, diff check, and Vault doctor clean.
- 2026-07-19 - Follow-up retryability remediation completed in [[05_Sessions/2026-07-19-031251-implement-single-text-source-ingestion-and-artifact-storage-ingestion-retryability-remediator|SESSION-2026-07-19-031251 ingestion retryability remediator]]; combined focused worker/persistence validation passed 56 tests / 524 assertions.
- 2026-07-19 — Follow-up review found unprovable raw artifact provenance, missing journal metadata bounds, missing attempt-partition identity, and retryability inversion. Remediation completed in [[05_Sessions/2026-07-19-030510-implement-deterministic-retrieval-and-fred-research-workflow-step-01-04-ingestion-provenance-metadata-remediation|SESSION-2026-07-19-030510 ingestion provenance and metadata remediation]] with focused unit, real-PostgreSQL, type, lint, import-boundary, and diff validation.
- 2026-07-19 - Settled shared-state validation superseded the earlier focused count: 60 worker/API/persistence tests passed / 562 assertions; repository-wide typecheck, lint, dependency boundaries, build, diff check, and Vault doctor were clean.
