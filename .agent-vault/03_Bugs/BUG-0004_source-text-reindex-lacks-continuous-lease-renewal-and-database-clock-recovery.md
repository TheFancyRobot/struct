---
note_type: bug
template_version: 2
contract_version: 1
title: Source text reindex lacks continuous lease renewal and database clock recovery
bug_id: BUG-0004
status: fixed
severity: sev-3
category: logic
reported_on: '2026-07-19'
fixed_on: '2026-07-19'
owner: step-01-04-reindex-lease-remediation
created: '2026-07-19'
updated: '2026-07-19'
related_notes:
  - '[[02_Phases/Phase_01_walking_skeleton/Steps/Step_04_implement-deterministic-retrieval-and-fred-research-workflow|STEP-01-04 Implement Deterministic Retrieval and Fred Research Workflow]]'
tags:
  - agent-vault
  - bug
---

# BUG-0004 - Source text reindex lacks continuous lease renewal and database clock recovery

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Source text reindex lacks continuous lease renewal and database clock recovery.
- Related notes: [[02_Phases/Phase_01_walking_skeleton/Steps/Step_04_implement-deterministic-retrieval-and-fred-research-workflow|STEP-01-04 Implement Deterministic Retrieval and Fred Research Workflow]].

## Observed Behavior

- Describe what actually happens.
- A claimed source-text reindex could run longer than the stale window without refreshing `updated_at`.
- Recovery accepted a host-derived absolute timestamp, so application/database clock skew could reclaim active work.

## Expected Behavior

- Describe what should happen instead.
- Active reindex work continuously renews an exact workspace/project/source-version/attempt lease.
- Stale recovery uses a duration evaluated against PostgreSQL time.
- Ownership loss safely interrupts stale work; infrastructure failure remains fatal; retry and terminal budgets remain unchanged.

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
- Source-text reindex processing has no continuous exact-attempt lease renewal and stale recovery compares a host-derived absolute timestamp against the database. Clock skew or processing beyond the stale window can reclaim active work.
- Adversarial follow-up found a second ownership race: `TextRetrieval.indexText` inserted `source_text_index` content before checking the exact attempt-fenced completion transition, then returned normally from the SQL transaction when completion ownership was absent. PostgreSQL therefore committed the stale index insertion before Effect raised `SourceTextReindexOwnershipLostError`.

## Workaround

- Describe any temporary mitigation and remaining risk.

## Permanent Fix Plan

- Describe the intended durable fix.
- Implemented `SourceTextReindexRepo.renewLease` with exact source-version/workspace/project/status/attempt fencing and PostgreSQL `NOW()` renewal.
- Changed stale recovery to accept `staleAfterMs` and compare `updated_at < NOW() - duration` inside PostgreSQL.
- Added a bounded reindex heartbeat derived from poll cadence, the stale window, and a 10-second cap; raced the complete claimed artifact/index path against it.
- Preserved safe expected ownership loss, fatal infrastructure errors, manifest/hash verification, retry budgets, and exact completion/failure fences.
- Implemented the follow-up transaction fix: reindex indexing now locks and verifies the exact workspace/project/source-version/in-progress/attempt row with `FOR UPDATE` before index mutation. A missing precondition or completion fence throws an internal rollback sentinel inside the transaction, which is mapped to the typed ownership-loss error only after PostgreSQL has rolled back. The ordinary ingestion path remains separately idempotent and preserves claimed reindex ownership.
- Final concurrency-safe form (superseding the earlier `FOR UPDATE` wording): perform the exact attempt-scoped ownership precheck without taking the job-row lock, then require the attempt-fenced completion update to succeed in the same transaction. Any transfer after the precheck causes an in-transaction throw and rolls back the index mutation. Avoiding a job-first row lock preserves the existing index-then-job lock order used by ingestion and prevents a reindex/ingestion deadlock.

## Regression Coverage Needed

- List tests, fixtures, reproductions, alerts, or docs updates needed.
- Completed unit coverage for exact renewal SQL, expected ownership loss, DB-clock duration SQL, bounded heartbeat derivation, continuous renewal, interruption/no late writes, and fatal infrastructure failure.
- Completed serial real-PostgreSQL coverage for valid renewal, forged workspace/project/attempt rejection, retryable/exhausted stale recovery, stale failure rejection, and valid completion controls.
- Validation: typecheck, lint, import boundaries, build, and the 78-test focused/real-DB suite pass.
- Added serial PostgreSQL worker-level controls that transfer an actual lease during blocked indexing and verify interruption with no late index or terminal write; the infrastructure-failure control likewise proves interruption and a recoverable nonterminal database state.
- Added unit coverage proving ownership transferred before the call prevents any index SQL and completion-fence loss rolls back staged mutation.
- Added serial real-PostgreSQL coverage proving a stale pre-call attempt leaves the index absent and the newer job nonterminal, plus fault-injected ownership change inside the transaction rolls back both the inserted index content and injected attempt change with no stale terminal write.

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- Phase: [[02_Phases/Phase_01_walking_skeleton/Phase|Phase 01 walking skeleton]]
- Step: [[02_Phases/Phase_01_walking_skeleton/Steps/Step_04_implement-deterministic-retrieval-and-fred-research-workflow|STEP-01-04 Implement Deterministic Retrieval and Fred Research Workflow]]
<!-- AGENT-END:bug-related-notes -->

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-07-19 - Reported.
<!-- AGENT-END:bug-timeline -->
- 2026-07-19 - Fixed and validated in [[05_Sessions/2026-07-19-022407-implement-deterministic-retrieval-and-fred-research-workflow-step-01-04-reindex-lease-remediation|SESSION-2026-07-19-022407 reindex lease remediation]].
- 2026-07-19: Independent adversarial review reproduced a stale late-write commit against PostgreSQL; remediation added pre-mutation exact ownership locking and in-transaction rollback on completion-fence loss. Focused unit and serial PostgreSQL regressions passed.
