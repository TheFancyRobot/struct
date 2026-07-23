---
note_type: bug
template_version: 2
contract_version: 1
title: Merged PR 17 Review Findings Remain Unresolved
bug_id: BUG-0019
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
tags:
  - agent-vault
  - bug
---

# BUG-0019 - Merged PR 17 Review Findings Remain Unresolved

Use one note per bug. Capture reproduction, impact, root cause, workaround, and verification, then link back to the relevant phase, step, decision, or session. See [[07_Templates/Note_Contracts|Note Contracts]].

## Summary

- Merged PR 17 Review Findings Remain Unresolved.
- Related notes: [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_02_implement-parquet-materialization-and-data-profiling|STEP-04-02 Implement Parquet Materialization and Data Profiling]].

## Observed Behavior

- Merged PR #17 retains six unresolved inline review threads and one unrecorded validation-evidence finding.
- The current STEP-04-02 brief and validation plan still name only JSON/CSV even though the implementation later added JSONL.
- Materialization validates input artifact hashes but emits Parquet containing only declared dataset fields; after `UNION ALL` and `ORDER BY ALL`, no stable row-to-input ordinal or source-record pointer survives.
- Query results persist `engineVersion` and `engineConfigHash`, but the hash input omits the pinned `@duckdb/node-api` adapter identity and an explicit execution-policy version.
- STEP-03-06 frontmatter/context are `completed` while its agent-managed snapshot remains `in_progress` with an obsolete merge action.
- Generic persistence `QueryError`, `UniqueConstraintError`, and `DecodeError` values accept raw database/parser messages and causes that can contain SQL, credentials, or stored values.
- STEP-04-06 implementation correctly keeps timings outside the deterministic report hash, but its execution brief still combines timings with the deterministic report contract.
- The Phase 04 refinement session omits the successful `git diff --check` and secrets-scan evidence claimed by PR #17.

## Expected Behavior

- Every valid PR #17 finding is reflected in durable step/session contracts and current implementation.
- Every normalized Parquet record retains a stable identity and a locator that resolves through immutable dataset-snapshot lineage to the original source record.
- Persisted query configuration identity covers the pinned engine, adapter, protocol, and execution-policy version.
- Persistence failures expose only bounded sanitized fields; tests prove raw SQL, credentials, parser values, and causes cannot escape.
- Canonical step snapshots agree with frontmatter/context state, and deterministic report documentation explicitly excludes volatile timing metadata from hashing.

## Reproduction Steps

1. Query PR #17 review threads with GitHub GraphQL; observe six unresolved threads.
2. Inspect STEP-04-02 materialization and sidecar projection: source input ordinal and record pointer are not emitted into the Parquet projection.
3. Inspect the query-sidecar `engineConfigHash` input: engine and limit values are present, but adapter and policy versions are absent.
4. Construct `QueryError` or `DecodeError` with a credential/raw SQL string and serialize/stringify the error; the input is retained.
5. Compare STEP-03-06 frontmatter/context with its agent-managed snapshot and compare STEP-04-06 brief with `phase-04-evaluation.ts`.

## Scope / Blast Radius

- Phase 04 durable contracts and completion evidence.
- `packages/domain`, `packages/data-engine`, `packages/persistence`, the DuckDB sidecar, query/citation evidence, and evaluation fixtures.
- Agent Vault step/session accuracy and PR review traceability.

## Suspected Root Cause

- PR #17 was merged before automated review feedback was reconciled, and later Phase 04 implementation relied on the uncorrected briefs.

## Confirmed Root Cause

- The unresolved GitHub threads match current repository evidence: some later implementations independently covered JSONL and timing separation, while row-level original-source lineage, complete engine configuration identity, error redaction, and snapshot/session documentation remain incomplete.

## Workaround

- Dataset-snapshot-level lineage and immutable result snapshots identify contributing source versions, but cannot reopen the exact original record after multi-file materialization.
- API response mappers currently return generic status bodies, reducing direct HTTP exposure, but internal serialization/logging of persistence failures remains unsafe.

## Permanent Fix Plan

- Correct every affected Phase 03/04 brief, validation plan, snapshot, and session record.
- Add reserved immutable record-lineage columns to materialized Parquet, validate them through protocol/integration coverage, and preserve their mapping to dataset snapshot sources.
- Bind the adapter and execution-policy versions into persisted query configuration identity and its regression fixtures.
- Sanitize generic persistence and decode errors at construction and add leakage tests plus SQL-route response assertions.
- Re-run targeted sidecar/evaluation evidence, repository gates, vault validation, and GitHub thread resolution.

## Regression Coverage Needed

- JSON, JSONL, and CSV multi-input materialization fixtures asserting stable source ordinal, record ordinal/pointer, and record identity after deterministic ordering.
- Query-result fixtures proving engine configuration identity changes with engine, adapter, protocol, or policy identity.
- Unit/integration tests proving raw SQL, credentials, internal paths, parser values, and causes do not appear in errors or HTTP responses.
- Vault doctor, documentation lint, secrets scan, and `git diff --check`.

## Related Notes

<!-- AGENT-START:bug-related-notes -->
- Phase: [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Phase|Phase 04 structured datasets and deterministic sql]]
- Step: [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_02_implement-parquet-materialization-and-data-profiling|STEP-04-02 Implement Parquet Materialization and Data Profiling]]
<!-- AGENT-END:bug-related-notes -->

## Timeline

<!-- AGENT-START:bug-timeline -->
- 2026-07-22 - Reported.
<!-- AGENT-END:bug-timeline -->
- 2026-07-23 - Resolved: validated and remediated all six PR #17 review findings plus the validation-evidence record. Targeted contracts, full repository tests, live sidecar/Phase 04 integration, static gates, docs, secrets scan, and vault doctor passed; the follow-up review will resolve the original GitHub threads.
