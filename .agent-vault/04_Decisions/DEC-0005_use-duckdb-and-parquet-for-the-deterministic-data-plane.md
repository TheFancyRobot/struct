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
updated: '2026-07-19'
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
- Run DuckDB behind an isolated Phase-04 container/sidecar and a scoped typed
  Effect client. The sidecar may use the runtime required by its selected
  adapter, pinned inside the image; Bun remains the sole maintained host
  runtime.
- Phase-04 refinement selects the exact image, authenticated protocol, mounts,
  health checks, resource limits, cancellation, and restart contract. The
  current Compose stack provisions PostgreSQL only.
- Expose bounded validated query tools to Fred rather than raw DuckDB access.

## Alternatives Considered

- Flatten rows into chunks and use RAG — rejected because it destroys structure and exactness.
- PostgreSQL for all analytical work — rejected for the large local/file-oriented analytical workload, while remaining the metadata system of record.
- Remote warehouse required for v1 — rejected because it raises deployment and data-governance complexity.

## Tradeoffs

- Native-module behavior, memory, cancellation, and concurrency require careful isolation.
- Parquet materialization adds storage and lifecycle management.

## Consequences

- The containerized service boundary is stable; its implementation remains
  gated by Phase-04 refinement and validation.
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
- 2026-07-19 - Reconciled the Phase-00 child-process evidence with the
  Bun-only maintained-host decision: Phase 04 will implement an isolated
  DuckDB sidecar rather than a host child process.
<!-- AGENT-END:decision-change-log -->
