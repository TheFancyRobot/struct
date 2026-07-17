---
note_type: decision
template_version: 2
contract_version: 1
title: Own the Typed API and Live Research Event Stream
decision_id: DEC-0008
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

# DEC-0008 - Own the Typed API and Live Research Event Stream

## Status

- Current status: accepted.
- Revisit when a linked spike contradicts the selected boundary or the documented promotion/scale criterion is met.

## Context

- Fred HTTP offers useful typed endpoints and coarse workflow events, but current workflow SSE does not provide the granular, persisted live research progress, replay, cancellation, and authorization semantics the product requires.

## Decision

- Own the product HTTP API contracts, authorization, error envelopes, job controls, and research event schemas.
- Serve live/replay SSE from the product event journal using monotonic cursors, heartbeats, reconnect, and bounded buffering.
- Selectively reuse `@fancyrobot/fred-http` features only when their contracts match; do not depend on its coarse buffered workflow SSE for research progress.
- Keep Fred workflow identifiers correlated but not exposed as the sole public job identity.

## Alternatives Considered

- Expose Fred HTTP directly as the product API — rejected because domain/auth/event semantics differ.
- Poll only — rejected because the required experience includes streaming progress.
- Bridge in-memory Fred hooks directly to clients — rejected because events would be lost or reordered across restart.

## Tradeoffs

- The product must maintain its own API/event versioning and SSE implementation.
- Selective Fred HTTP reuse requires a clear adapter boundary.

## Consequences

- Phase 01 proves live and replay behavior.
- Event delivery is at least once; clients deduplicate by cursor/identity.
- Slow consumers, authorization changes, retention, and reconnect are explicit tests.

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
