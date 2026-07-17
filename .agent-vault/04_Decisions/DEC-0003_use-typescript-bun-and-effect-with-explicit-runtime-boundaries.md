---
note_type: decision
template_version: 2
contract_version: 1
title: Use TypeScript Bun and Effect with Explicit Runtime Boundaries
decision_id: DEC-0003
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

# DEC-0003 - Use TypeScript Bun and Effect with Explicit Runtime Boundaries

## Status

- Current status: accepted.
- Revisit when a linked spike contradicts the selected boundary or the documented promotion/scale criterion is met.

## Context

- The product needs one typed programming model across domain logic, concurrency, streaming, resources, configuration, failures, and Fred integration, while using Bun for application/runtime tooling.

## Decision

- Use TypeScript and Bun for the monorepo, applications, scripts, and tests, subject to Phase 00 native-module evidence.
- Separate `apps/web`, `apps/api`, and `apps/worker` so the public request boundary remains latency-oriented while durable jobs own ingestion and research execution.
- Model business services with `Effect.Service`, `Effect.fn`, flat Layers, scoped resources, Effect Config, branded IDs, Effect Schema, and `Schema.TaggedError`.
- Keep `Effect.runPromise`/runtime execution at application, HTTP, worker, CLI, or test boundaries; internal services return Effect/Stream values.
- Enable strict TypeScript and the Effect language service from the walking skeleton.

## Alternatives Considered

- Promise-first services with ad hoc exceptions — rejected because failures and resource scopes become implicit.
- A mixed Python/TypeScript data plane — deferred; it adds deployment and typing boundaries before DuckDB evidence requires it.
- Node-only runtime — retained as a compatibility fallback if a required native dependency fails under Bun.

## Tradeoffs

- Effect has a learning and tooling cost.
- Bun compatibility must be proven for native dependencies and production operations.

## Consequences

- Typed failures and Layer composition are review requirements.
- Adapters isolate Promise/native APIs from domain services.
- Runtime exceptions are defects unless explicitly defect-classified at a boundary.

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
