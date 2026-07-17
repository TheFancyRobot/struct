# DEC-0003: Use TypeScript, Bun, and Effect with Explicit Runtime Boundaries

## Status

Accepted.

## Context

The preferred technical direction in the brief is TypeScript-first with Bun as the runtime and Effect as the service, schema, and orchestration foundation. The repository instructions also require Effect services, Layers, Schemas, Streams, typed errors, and strict runtime discipline.

## Decision

Use TypeScript across the product, run the application on Bun by default, and separate the web, API, and durable worker applications. Model domain and service boundaries with Effect. Keep runtime execution at application entry points and other approved public boundaries only. Use Effect Schema for contracts and persisted records where practical, and do not call `Effect.runPromise` inside domain or service logic.

## Alternatives

- Use plain promise-based services without Effect as the primary composition model.
- Standardize on a Node-first runtime stack instead of Bun.
- Mix ad hoc runtime execution throughout domain code.

## Consequences

- The product gains typed service composition, safer dependency injection, and better testability.
- Teams must follow stricter Effect patterns and learn its operational model.
- Runtime boundaries become easier to audit for durability, tracing, and cancellation behavior.
- Any Bun compatibility issues must be surfaced early in spikes instead of being discovered late in delivery.

## Related Phase

- [PHASE-00 Architecture Spikes and Delivery Foundations](../../.agent-vault/02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Phase.md)
