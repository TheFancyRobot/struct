---
note_type: decision
template_version: 2
contract_version: 1
title: Prefer Product-Local Adapters Before Fred Core Changes
decision_id: DEC-0002
status: accepted
decided_on: '2026-07-17'
owner: ''
created: '2026-07-17'
updated: '2026-07-17'
supersedes: []
superseded_by: []
related_notes:
  - '[[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Phase|PHASE-00 Architecture Spikes and Delivery Foundations]]'
  - '[[01_Architecture/System_Overview|System Overview]]'
tags:
  - agent-vault
  - decision
  - architecture
---

# DEC-0002 - Prefer Product-Local Adapters Before Fred Core Changes

## Status

- Current status: accepted.
- Revisit when a linked spike contradicts the selected boundary or the documented promotion/scale criterion is met.

## Context

- Several desired behaviors may expose Fred gaps, including richer live events, cancellation, cross-process recovery, large outputs by reference, injected stores, typed node boundaries, and capability-aware routing. Most can be composed product-locally while their generic value is evaluated.

## Decision

- Implement product-specific policy, persistence, event schemas, and adapters in this repository first.
- Propose a Fred change only when the gap is generic, cannot be composed safely, has a minimal portable reproduction, and benefits multiple Fred consumers.
- Keep a product-local fallback so v1 is not blocked on upstream acceptance.

## Alternatives Considered

- Change Fred for every product need — rejected because it would leak application policy into a reusable framework.
- Never change Fred — rejected because measured generic improvements should benefit the ecosystem.
- Maintain a permanent fork — rejected because it increases compatibility and security risk.

## Tradeoffs

- Some adapter code may later be deleted or generalized.
- Dual product/upstream tests can add short-term effort.

## Consequences

- Phase 00 classifies gaps and records promotion criteria.
- Candidate upstream work must preserve Fred compatibility and include isolated tests/docs.
- Product milestones remain independently deliverable.

## Related Notes

<!-- AGENT-START:decision-related-notes -->
- Phase: [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Phase|PHASE-00 Architecture Spikes and Delivery Foundations]]
- Architecture: [[01_Architecture/System_Overview|System Overview]]
- Product requirements: `docs/product-brief.md`
<!-- AGENT-END:decision-related-notes -->

## Change Log

<!-- AGENT-START:decision-change-log -->
- 2026-07-17 - Accepted during greenfield architecture planning; implementation remains gated by the linked phase and spikes.
<!-- AGENT-END:decision-change-log -->
