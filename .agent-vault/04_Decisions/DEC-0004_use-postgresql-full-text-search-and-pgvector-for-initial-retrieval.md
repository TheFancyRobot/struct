---
note_type: decision
template_version: 2
contract_version: 1
title: Use PostgreSQL Full-Text Search and pgvector for Initial Retrieval
decision_id: DEC-0004
status: accepted
decided_on: '2026-07-17'
owner: ''
created: '2026-07-17'
updated: '2026-07-17'
supersedes: []
superseded_by: []
related_notes:
  - '[[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Phase|PHASE-02 Document Research and Hybrid Retrieval]]'
  - '[[01_Architecture/System_Overview|System Overview]]'
tags:
  - agent-vault
  - decision
  - architecture
---

# DEC-0004 - Use PostgreSQL Full-Text Search and pgvector for Initial Retrieval

## Status

- Current status: accepted.
- Revisit when a linked spike contradicts the selected boundary or the documented promotion/scale criterion is met.

## Context

- v1 needs keyword, semantic, filtered, workspace-scoped retrieval without introducing another distributed datastore before workload evidence exists.

## Decision

- Use PostgreSQL full-text search and pgvector as the initial document retrieval stores.
- Persist chunk/version metadata beside retrieval indexes and fuse keyword/vector candidates deterministically in a typed retrieval service.
- Treat embeddings and indexes as rebuildable derived data; immutable source versions and locators remain authoritative.
- Revisit a dedicated vector database only after measured scale, latency, filtering, or operational limits.

## Alternatives Considered

- Dedicated vector database from day one — rejected as premature operational complexity.
- Embeddings-only retrieval — rejected because exact terms, identifiers, and transparent ranking matter.
- Application-memory index — rejected because persistence, concurrency, filtering, and recovery would be inadequate.

## Tradeoffs

- PostgreSQL needs index tuning and capacity testing.
- Hybrid ranking and migrations require explicit versioning.

## Consequences

- Phase 02 owns retrieval conformance and evaluation.
- Index rebuilds must not change citation targets.
- A future store replacement remains behind the retrieval service contract.

## Related Notes

<!-- AGENT-START:decision-related-notes -->
- Phase: [[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Phase|PHASE-02 Document Research and Hybrid Retrieval]]
- Architecture: [[01_Architecture/System_Overview|System Overview]]
- Product requirements: `docs/product-brief.md`
<!-- AGENT-END:decision-related-notes -->

## Change Log

<!-- AGENT-START:decision-change-log -->
- 2026-07-17 - Accepted during greenfield architecture planning; implementation remains gated by the linked phase and spikes.
<!-- AGENT-END:decision-change-log -->
