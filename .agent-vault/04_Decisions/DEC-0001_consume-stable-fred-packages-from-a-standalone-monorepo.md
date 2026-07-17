---
note_type: decision
template_version: 2
contract_version: 1
title: Consume Stable Fred Packages from a Standalone Monorepo
decision_id: DEC-0001
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

# DEC-0001 - Consume Stable Fred Packages from a Standalone Monorepo

## Status

- Current status: accepted.
- Revisit when a linked spike contradicts the selected boundary or the documented promotion/scale criterion is met.

## Context

- The product needs stable Fred orchestration while remaining independently releasable. Development may use a local Fred checkout, but production builds require reproducible registry dependencies and must not inherit Fred repository lifecycle or unpublished internals.

## Decision

- Build this product as its own Bun workspace/monorepo.
- Consume exact compatible releases of `@fancyrobot/fred` and required provider/integration packages through their public exports.
- Permit a local link/override only for Fred integration development and compatibility tests; lockfiles and release builds resolve published versions.
- Record a compatibility matrix and upgrade Fred through explicit dependency/evaluation changes.

## Alternatives Considered

- Develop the application inside the Fred repository — rejected because release cadence, ownership, and product boundaries would be coupled.
- Vendor or fork Fred — rejected unless an urgent defect has no supported workaround; it creates long-term divergence.
- Track Fred main/HEAD — rejected because builds and evaluation results would not be reproducible.

## Tradeoffs

- Exact pins require planned upgrades and compatibility testing.
- A separate repository needs local linking ergonomics for coordinated Fred development.

## Consequences

- Phase 00 must prove the required public APIs against pinned versions.
- CI records dependency versions in traces and evaluation artifacts.
- Unpublished Fred internals are not valid application dependencies.

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
