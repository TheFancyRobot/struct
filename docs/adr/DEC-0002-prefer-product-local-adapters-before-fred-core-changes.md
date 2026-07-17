# DEC-0002: Prefer Product-Local Adapters Before Fred Core Changes

## Status

Accepted.

## Context

The product will likely uncover gaps while building durable ingestion, deterministic data access, citation validation, and research orchestration on top of Fred. The brief explicitly warns against changing Fred core to satisfy product-local needs and asks for adapters first unless the missing capability is broadly reusable.

## Decision

When the product needs behavior that Fred does not provide yet, implement a product-local adapter first. Document the deficiency, prove the behavior in the product, and only propose a Fred-core change when the capability is generic, stable in shape, independently testable, and valuable outside this application.

## Alternatives

- Patch Fred core as soon as a product need appears.
- Build the product as a deep fork of Fred.
- Avoid integration entirely and replace Fred with a custom orchestration layer.

## Consequences

- The product moves forward without prematurely expanding Fred's public surface area.
- Some adapter code may exist temporarily until a generic abstraction is justified.
- Upstream changes will arrive later but with better evidence, tests, and migration notes.
- Product developers must explicitly separate framework deficiencies from application-specific policy.

## Related Phase

- [PHASE-00 Architecture Spikes and Delivery Foundations](../../.agent-vault/02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Phase.md)
