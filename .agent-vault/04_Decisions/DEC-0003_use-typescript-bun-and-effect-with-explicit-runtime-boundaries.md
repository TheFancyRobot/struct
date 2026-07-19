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
updated: '2026-07-19'
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

- Use TypeScript and Bun as the sole maintained host runtime/toolchain for the
  monorepo, applications, workspace packages, scripts, and tests.
- Separate `apps/web`, `apps/api`, and `apps/worker` so the public request boundary remains latency-oriented while durable jobs own ingestion and research execution.
- Model business services with `Effect.Service`, `Effect.fn`, flat Layers, scoped resources, Effect Config, branded IDs, Effect Schema, and `Schema.TaggedError`.
- Keep `Effect.runPromise`/runtime execution at application, HTTP, worker, CLI, or test boundaries; internal services return Effect/Stream values.
- Enable strict TypeScript and the Effect language service from the walking skeleton.
- Permit a native-dependency container to use the runtime required by its
  adapter only when the runtime is pinned inside the image, the host talks to
  it through a typed bounded protocol, and the exception is recorded in an
  ADR. Phase 04's planned isolated DuckDB sidecar is the accepted instance;
  it does not add a Node or other runtime requirement to the host workspace.

## Alternatives Considered

- Promise-first services with ad hoc exceptions — rejected because failures and resource scopes become implicit.
- A mixed Python/TypeScript host data plane — rejected; an isolated adapter
  service may choose its internal runtime without widening the host toolchain.
- Node-only or Node-fallback host execution — rejected; native incompatibility
  is contained inside an explicitly decided, pinned container/service image.
  Phase 04's planned DuckDB sidecar is the accepted exception; DuckDB must not
  run as a host child process or load its native adapter into a maintained host
  application.

## Tradeoffs

- Effect has a learning and tooling cost.
- Bun compatibility must be proven for native dependencies and production operations.

## Consequences

- Typed failures and Layer composition are review requirements.
- Adapters isolate Promise/native APIs from domain services.
- Runtime exceptions are defects unless explicitly accepted in an ADR and
  isolated from the maintained host toolchain.

## Related Notes

<!-- AGENT-START:decision-related-notes -->
- Phase: [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Phase|PHASE-00 Architecture Spikes and Delivery Foundations]]
- Architecture: [[01_Architecture/System_Overview|System Overview]]
- Product requirements: `docs/product-brief.md`
<!-- AGENT-END:decision-related-notes -->

## Change Log

<!-- AGENT-START:decision-change-log -->
- 2026-07-17 - Accepted during greenfield architecture planning; implementation remains gated by the linked phase and spikes.
- 2026-07-19 - Clarified Bun as the sole maintained host runtime and accepted
  Phase 04's planned DuckDB container as an isolated adapter-runtime
  exception; removed the host Node fallback.
<!-- AGENT-END:decision-change-log -->
