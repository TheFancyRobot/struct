---
note_type: decision
template_version: 2
contract_version: 1
title: Sandbox Filesystem Roots and Allowlist Read-Only SQL
decision_id: DEC-0009
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

# DEC-0009 - Sandbox Filesystem Roots and Allowlist Read-Only SQL

## Status

- Current status: accepted.
- Revisit when a linked spike contradicts the selected boundary or the documented promotion/scale criterion is met.

## Context

- The application handles hostile files and model-proposed data operations. Filesystem traversal and SQL are direct security boundaries, not prompt-level conventions.

## Decision

- Allow filesystem discovery only beneath administrator/user-registered canonical roots and reject traversal, unsafe symlinks, cycles, devices, sockets, and policy-exceeding inputs.
- Execute only parsed and validated read-only SQL against catalog-issued views/tables with forbidden statements, functions, paths, attachments, extensions, and side effects denied.
- Apply workspace authorization, resource budgets, cancellation, audit logging, and isolated execution at both boundaries.
- Treat imported content as untrusted evidence and never as tool/system instructions.

## Alternatives Considered

- Rely on OS permissions alone — rejected because workspace and tool policies are narrower.
- Use regex-only SQL checks — rejected because parsing/catalog allowlists and runtime defense in depth are required.
- Ask the model to behave safely — rejected because prompt instructions are not a security boundary.

## Tradeoffs

- Strict allowlists may reject useful operations until explicitly supported.
- Canonicalization and platform-specific filesystem behavior require extensive tests.

## Consequences

- Security controls fail closed with typed errors.
- Phase 00 defines the threat model; Phases 03/04 implement and Phase 09 audits it.
- Prompt-injection evaluations attempt policy escalation through every source type.

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
