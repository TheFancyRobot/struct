# DEC-0012: Keep Fred at the Orchestration Boundary for Typed Research Runs

## Status

Accepted.

## Context

STEP-00-01 needed to prove whether the published Fred surface was strong enough to bootstrap the product's first research workflow without forcing product logic into Fred core. The spike showed that `createFred()`, `defineWorkflow()`, workflow hooks, `@fancyrobot/fred/eval`, and `@fancyrobot/fred-http` all work at the published versions, but it also showed that the product still needs its own public run identity, journal, compact checkpoints, artifact references, and reconnection policy.

## Decision

Use Fred as the orchestration boundary around typed research runs:

- Fred owns workflow graph execution, step scheduling, hook dispatch, and optional transport helpers.
- Product code owns domain schemas, deterministic retrieval and persistence services, public run IDs, event journals, checkpoint records, artifact references, auth, replay policy, and user-facing SSE semantics.
- `@fancyrobot/fred-http` may be reused selectively for smoke tests or tightly scoped admin-style workflow surfaces, but its coarse lifecycle SSE is not the product progress contract.
- Fred checkpoints and identities remain correlation inputs to product durability rather than substitutes for it.

## Alternatives

- Push product-local persistence and event policy into Fred core.
- Accept `fred-http` SSE as the final user-facing event stream.
- Replace Fred with a custom orchestration layer before Phase 1.

## Consequences

- Phase 1 can consume published Fred packages immediately without waiting for upstream changes.
- STEP-00-02 must define the product journal, replay, cancellation, and checkpoint contract separately from Fred internals.
- Any future Fred-core proposal must come with a portable reproduction that proves the gap is generic rather than product-specific.
- The disposable harness in `spikes/fred-runtime/` is evidence only; canonical code belongs in Phase 1 packages.

## Related Phase

- [PHASE-00 Architecture Spikes and Delivery Foundations](../../.agent-vault/02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Phase.md)
