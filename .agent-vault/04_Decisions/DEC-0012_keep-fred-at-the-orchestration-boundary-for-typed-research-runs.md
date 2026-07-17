---
note_type: decision
template_version: 2
contract_version: 1
title: Keep Fred at the Orchestration Boundary for Typed Research Runs
decision_id: DEC-0012
status: accepted
decided_on: '2026-07-17'
owner: 'phase00-step01-attempt2'
created: '2026-07-17'
updated: '2026-07-17'
supersedes: []
superseded_by: []
related_notes:
  - '[[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Phase|PHASE-00 Architecture Spikes and Delivery Foundations]]'
  - '[[05_Sessions/2026-07-17-062747-spike-fred-runtime-and-workflow-integration-phase00-step01-attempt2|SESSION-2026-07-17-062747 phase00-step01-attempt2 session for Spike Fred Runtime and Workflow Integration]]'
  - '[[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Steps/Step_01_spike-fred-runtime-and-workflow-integration|STEP-00-01 Spike Fred Runtime and Workflow Integration]]'
tags:
  - agent-vault
  - decision
  - architecture
---

# DEC-0012 - Keep Fred at the Orchestration Boundary for Typed Research Runs

## Status

- Current status: accepted.
- Accepted after STEP-00-01 proved the published Fred runtime boundary and documented the remaining product-owned durability responsibilities.

## Context

- STEP-00-01 validated the published Fred runtime at `@fancyrobot/fred@2.0.0` and `@fancyrobot/fred-http@1.0.0` using a disposable harness in `spikes/fred-runtime/` plus the pinned upstream examples at commit `b964f3480c177ba3e3805cb66356c1e0f3f30cce`.
- The spike proved that typed workflow execution, workflow hooks, optional HTTP workflow exposure, and offline eval assertions are available through public APIs.
- The same spike also confirmed that product run identity, durable event journaling, compact checkpoints, artifact references, authorization, and replay policy still belong in product-local code rather than Fred core.
- Durable evidence lives in `docs/spikes/fred-compatibility-matrix.md` and `docs/spikes/fred-runtime-and-workflow-integration.md`.

## Decision

- Use Fred as the orchestration shell around typed research runs: workflow graph execution, step scheduling, hook dispatch, and optional HTTP workflow transport stay inside Fred.
- Keep domain schemas, deterministic retrieval/persistence/citation services, public `ResearchRunId`, product event journal, product checkpoint records, artifact references, replay rules, and user-facing SSE semantics in this repository.
- Treat `fred-http` as an optional admin/smoke-test transport, not as the authoritative product progress stream.
- Treat Fred checkpoint and run identifiers as correlation metadata that can feed product durability, not as substitutes for the product journal or checkpoint record.

## Alternatives Considered

- Push product-local persistence, event, and replay policy into Fred core immediately — rejected because the spike showed a safe product-local adapter path and no portable generic proof yet.
- Accept `fred-http` SSE as the final user-facing event model — rejected because its lifecycle envelope is coarser than the required product journal and replay contract.
- Replace Fred before Phase 1 — rejected because the published workflow surface already satisfies the bounded orchestration needs proven in STEP-00-01.

## Tradeoffs

- Product-local durability and event adapters create some short-term code that may later inform upstream changes.
- The boundary keeps v1 independently deliverable, but it requires deliberate correlation between product IDs and Fred IDs.
- Reusing `fred-http` selectively reduces transport work for smoke tests while preserving the right to keep the public product API stricter than Fred defaults.

## Consequences

- STEP-00-02 can assume the handoff rule: product `runId` is primary, product checkpoints remain authoritative, and workflow hooks are the supported Fred integration tap points.
- Phase 1 may consume the proven public Fred surface immediately from published packages.
- Any future Fred-core proposal must include a portable reproduction and preserve a safe product-local fallback.
- The disposable spike harness is evidence only and must not be promoted unchanged into canonical Phase 1 packages.

## Related Notes

<!-- AGENT-START:decision-related-notes -->
- Phase: [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Phase|PHASE-00 Architecture Spikes and Delivery Foundations]]
- Step: [[02_Phases/Phase_00_architecture_spikes_and_delivery_foundations/Steps/Step_01_spike-fred-runtime-and-workflow-integration|STEP-00-01 Spike Fred Runtime and Workflow Integration]]
- Session: [[05_Sessions/2026-07-17-062747-spike-fred-runtime-and-workflow-integration-phase00-step01-attempt2|SESSION-2026-07-17-062747 phase00-step01-attempt2 session for Spike Fred Runtime and Workflow Integration]]
- Evidence: `docs/spikes/fred-compatibility-matrix.md`, `docs/spikes/fred-runtime-and-workflow-integration.md`
<!-- AGENT-END:decision-related-notes -->

## Change Log

<!-- AGENT-START:decision-change-log -->
- 2026-07-17 - Accepted after the Fred runtime spike landed compatibility, boundary, and handoff evidence.
<!-- AGENT-END:decision-change-log -->
