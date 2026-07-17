---
note_type: decision
template_version: 2
contract_version: 1
title: Make Source Versions Immutable and Provenance Typed
decision_id: DEC-0006
status: accepted
decided_on: '2026-07-17'
owner: ''
created: '2026-07-17'
updated: '2026-07-17'
supersedes: []
superseded_by: []
related_notes:
  - '[[02_Phases/Phase_01_walking_skeleton/Phase|PHASE-01 Walking Skeleton]]'
  - '[[01_Architecture/System_Overview|System Overview]]'
tags:
  - agent-vault
  - decision
  - architecture
---

# DEC-0006 - Make Source Versions Immutable and Provenance Typed

## Status

- Current status: accepted.
- Revisit when a linked spike contradicts the selected boundary or the documented promotion/scale criterion is met.

## Context

- Research claims must remain auditable after sources change, indexes rebuild, users edit reports, or results are exported. Mutable source records or free-form citation strings cannot provide that guarantee.

## Decision

- Create a new immutable SourceVersion for each accepted content change and retain original artifact identity and parent source lineage.
- Represent citations and provenance as typed edges through source/query/evidence/result versions and precise source-specific locators.
- Store derived chunks, embeddings, Parquet, profiles, evidence, and reports as versioned artifacts that reference their inputs.
- Never silently retarget an existing citation to a newer source version.

## Alternatives Considered

- Update sources in place — rejected because historical answers become unauditable.
- Store only rendered citation text — rejected because validation and navigation are impossible.
- Copy full provenance into every report — rejected because graphs and artifact references are more consistent and verifiable.

## Tradeoffs

- Immutable history increases storage and retention complexity.
- Locator design differs for text, pages, directories, datasets, and query results.

## Consequences

- Version and provenance schemas begin in Phase 01 and are migration-critical.
- Refresh invalidates derived data by lineage, not destructive overwrite.
- Retention/deletion must preserve required audit semantics or mark intentional tombstones.

## Related Notes

<!-- AGENT-START:decision-related-notes -->
- Phase: [[02_Phases/Phase_01_walking_skeleton/Phase|PHASE-01 Walking Skeleton]]
- Architecture: [[01_Architecture/System_Overview|System Overview]]
- Product requirements: `docs/product-brief.md`
<!-- AGENT-END:decision-related-notes -->

## Change Log

<!-- AGENT-START:decision-change-log -->
- 2026-07-17 - Accepted during greenfield architecture planning; implementation remains gated by the linked phase and spikes.
<!-- AGENT-END:decision-change-log -->
