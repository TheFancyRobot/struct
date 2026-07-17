# DEC-0009: Sandbox Filesystem Roots and Allowlist Read-Only SQL

## Status

Accepted.

## Context

The product ingests untrusted local files, directories, logs, JSON, code, and documents, and it lets models participate in planning queries over structured data. That makes filesystem escape, prompt injection, unrestricted SQL, and data exfiltration central security risks. The brief requires explicit workspace isolation, registered directory roots, path protections, and a bounded read-only SQL subset.

## Decision

Require explicit registration of allowed directory roots and enforce filesystem sandboxing with path normalization, symlink protections, ignore rules, and size limits. For structured data, allow only a validated read-only SQL subset with table and field validation, timeouts, memory limits, row and byte caps, concurrency limits, and cancellation support.

## Alternatives

- Allow arbitrary host-path reads supplied by the model or user.
- Permit unrestricted SQL against imported datasets.
- Trust imported content to behave as instructions rather than untrusted evidence.

## Consequences

- The product can safely support local-directory research without breaking host isolation.
- Some user flows become stricter because sources and queries must pass validation before execution.
- Security policy becomes part of the product architecture, not a hardening afterthought.
- Testing must include symlink traversal, prompt injection, oversized files, and SQL abuse cases.

## Related Phase

- [PHASE-00 Architecture Spikes and Delivery Foundations](../../.agent-vault/02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Phase.md)
