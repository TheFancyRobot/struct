---
note_type: decision
template_version: 2
contract_version: 1
title: Compose a Product Job Journal with Fred Checkpoints
decision_id: DEC-0007
status: accepted
decided_on: '2026-07-17'
owner: ''
created: '2026-07-17'
updated: '2026-07-17'
supersedes: []
superseded_by: []
related_notes:
  - '[[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Phase|PHASE-05 Typed Research Planning and Bounded Execution]]'
  - '[[01_Architecture/System_Overview|System Overview]]'
tags:
  - agent-vault
  - decision
  - architecture
---

# DEC-0007 - Compose a Product Job Journal with Fred Checkpoints

## Status

- Current status: accepted.
- Revisit when a linked spike contradicts the selected boundary or the documented promotion/scale criterion is met.

## Context

- Fred checkpoints capture workflow state, while the product also needs job leases, idempotency, cancellation intent, user-visible events, replay cursors, progress trees, audit history, and large artifacts. One mechanism should not be overloaded to impersonate the other.

## Decision

- Compose Fred checkpoint persistence with a product-owned durable Job/Attempt/Event journal.
- Commit idempotent domain state and product events transactionally where consistency requires it; derive SSE from the event journal.
- Store large tool/node outputs in artifact storage and checkpoint typed references plus hashes and metadata.
- Define reconciliation and recovery rules for crashes between domain commits, events, and Fred checkpoint writes.

## Alternatives Considered

- Use only Fred checkpoints — rejected because product job/event/audit semantics are broader.
- Use only a product queue and discard Fred resume — rejected because workflow state and pending inputs would be reimplemented.
- Stream ephemeral in-memory events — rejected because reconnect and recovery would lie.

## Tradeoffs

- Two coordinated persistence mechanisms create reconciliation work.
- Exactly-once external effects are impossible; idempotency and at-least-once handling must be explicit.

## Consequences

- Phase 00 spikes cross-process recovery; Phases 03 and 05 productionize the journal.
- Every event has a stable run/attempt/sequence identity.
- Recovery tests cover each write-boundary failure window.

## Related Notes

<!-- AGENT-START:decision-related-notes -->
- Phase: [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Phase|PHASE-05 Typed Research Planning and Bounded Execution]]
- Architecture: [[01_Architecture/System_Overview|System Overview]]
- Product requirements: `docs/product-brief.md`
<!-- AGENT-END:decision-related-notes -->

## Change Log

<!-- AGENT-START:decision-change-log -->
- 2026-07-17 - Accepted during greenfield architecture planning; implementation remains gated by the linked phase and spikes.
<!-- AGENT-END:decision-change-log -->
