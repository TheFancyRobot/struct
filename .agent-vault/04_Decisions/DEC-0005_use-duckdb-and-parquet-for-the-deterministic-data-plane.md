---
note_type: decision
template_version: 2
contract_version: 1
title: Use DuckDB and Parquet for the Deterministic Data Plane
decision_id: DEC-0005
status: accepted
decided_on: '2026-07-17'
owner: ''
created: '2026-07-17'
updated: '2026-07-17'
supersedes: []
superseded_by: []
related_notes:
  - '[[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Phase|PHASE-04 Structured Datasets and Deterministic SQL]]'
  - '[[01_Architecture/System_Overview|System Overview]]'
tags:
  - agent-vault
  - decision
  - architecture
---

# DEC-0005 - Use DuckDB and Parquet for the Deterministic Data Plane

## Status

- Current status: accepted.
- Revisit when a linked spike contradicts the selected boundary or the documented promotion/scale criterion is met.

## Context

- Structured datasets require exact, typed, auditable computation over many files. They must not be reduced to document chunks, and model-generated arithmetic is not acceptable evidence.

## Decision

- Use DuckDB for deterministic analytical execution and Parquet for normalized columnar artifacts.
- Keep datasets as first-class cataloged versions with schemas, profiles, input lineage, and query-result artifacts.
- Use the official `@duckdb/node-api` line behind a scoped Effect service; choose in-process versus isolated worker topology only after the Phase 00 spike.
- Expose bounded validated query tools to Fred rather than raw DuckDB access.

## Alternatives Considered

- Flatten rows into chunks and use RAG — rejected because it destroys structure and exactness.
- PostgreSQL for all analytical work — rejected for the large local/file-oriented analytical workload, while remaining the metadata system of record.
- Remote warehouse required for v1 — rejected because it raises deployment and data-governance complexity.

## Tradeoffs

- Native-module behavior, memory, cancellation, and concurrency require careful isolation.
- Parquet materialization adds storage and lifecycle management.

## Consequences

- DuckDB topology is spike-gated but the service boundary is stable.
- Exact query artifacts are part of citation provenance.
- No agent receives unrestricted SQL or filesystem capabilities.

## Related Notes

<!-- AGENT-START:decision-related-notes -->
- Phase: [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Phase|PHASE-04 Structured Datasets and Deterministic SQL]]
- Architecture: [[01_Architecture/System_Overview|System Overview]]
- Product requirements: `docs/product-brief.md`
<!-- AGENT-END:decision-related-notes -->

## Change Log

<!-- AGENT-START:decision-change-log -->
- 2026-07-17 - Accepted during greenfield architecture planning; implementation remains gated by the linked phase and spikes.
<!-- AGENT-END:decision-change-log -->
