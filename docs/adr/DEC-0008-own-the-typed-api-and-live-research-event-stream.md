# DEC-0008: Own the Typed API and Live Research Event Stream

## Status

Accepted.

## Context

The application needs a stable contract between the web experience, worker processes, and Fred-powered orchestration. Users must see progress for ingestion and research runs, inspect citations, and interact with product-specific resources such as projects, sources, findings, and reports. The brief favors typed application APIs and SSE for long-running event streams.

## Decision

Expose a product-owned typed API boundary for projects, sources, runs, findings, reports, citations, and operational controls. Stream long-running ingestion and research updates through a product-owned SSE event contract. Fred stays behind this boundary as the orchestration engine rather than becoming the public application API.

## Alternatives

- Expose Fred workflow primitives directly to the client.
- Use polling for all long-running status updates.
- Start with WebSockets as the default transport before proving the need for bidirectional state.

## Consequences

- The UI gets stable, product-specific contracts that can evolve independently of orchestration internals.
- SSE keeps the initial streaming model simpler while still supporting progress updates and result streaming.
- API schemas, event typing, and client state management require disciplined design from the start.
- If richer realtime collaboration appears later, the transport strategy can evolve without changing the core product model.

## Related Phase

- [PHASE-01 Walking Skeleton](../../.agent-vault/02_Phases/Phase_01_walking_skeleton/Phase.md)
