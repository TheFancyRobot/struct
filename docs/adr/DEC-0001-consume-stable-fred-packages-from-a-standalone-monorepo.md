# DEC-0001: Consume Stable Fred Packages from a Standalone Monorepo

## Status

Accepted.

## Context

The product brief requires a standalone research workspace that depends on Fred without blending product-specific behavior into Fred core. The application needs its own release cadence, persistence model, ingestion pipeline, evaluation corpus, and security posture while still reusing stable Fred packages for orchestration.

## Decision

Build the research workspace as a standalone monorepo that consumes stable published or workspace-linked Fred packages. Keep product-specific research workflows, ingestion logic, citations, and UI code inside the product repository. Only upstream changes to Fred when the missing capability is clearly generic, independently testable, and useful to other Fred consumers.

## Alternatives

- Build the product directly inside the Fred monorepo.
- Maintain a separate repository with a long-lived fork of Fred.
- Copy Fred internals into the product instead of consuming stable packages.

## Consequences

- The product gets clear package boundaries, an independent roadmap, and a cleaner release process.
- Integration points with Fred must be explicit and versioned.
- Some short-term adapter work is accepted to avoid coupling product needs to Fred internals.
- Generic framework gaps must be documented before any upstream contribution is proposed.

## Related Phase

- [PHASE-00 Architecture Spikes and Delivery Foundations](../../.agent-vault/02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Phase.md)
