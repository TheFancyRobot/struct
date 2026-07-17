# DEC-0006: Make Source Versions Immutable and Provenance Typed

## Status

Accepted.

## Context

The product must support source refresh, historical research runs, durable findings, and navigable citations without losing the exact state of the evidence used to produce an answer. Mutable source state alone would make historical claims difficult to reproduce and would cause citation drift after refresh.

## Decision

Represent source state through immutable source versions and typed provenance records. Research runs, findings, citations, dataset snapshots, and report sections must reference specific source-version identifiers rather than only mutable source identities. Refresh operations create new immutable versions instead of rewriting prior evidence in place.

## Alternatives

- Track only the latest mutable source state.
- Recompute citations against whatever version is current when a user opens them.
- Store loosely typed provenance metadata without stable identifiers.

## Consequences

- Historical runs stay reproducible even after documents, directories, or datasets change.
- Citation validation and version comparison become tractable because references are explicit.
- Persistence, indexing, and storage requirements increase because old versions must remain addressable.
- Product APIs and UI flows must surface version awareness as a first-class concept.

## Related Phase

- [PHASE-01 Walking Skeleton](../../.agent-vault/02_Phases/Phase_01_walking_skeleton/Phase.md)
