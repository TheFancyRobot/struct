---
note_type: phase
template_version: 2
contract_version: 1
title: v2 Scaled Research Platform
phase_id: PHASE-16
status: planned
owner: ''
created: '2026-07-17'
updated: '2026-07-17'
depends_on:
  - '[[02_Phases/Phase_15_v1_5_advanced_research/Phase|PHASE-15 v1.5 Advanced Research]]'
related_architecture:
  - '[[01_Architecture/System_Overview|System Overview]]'
  - '[[01_Architecture/Domain_Model|Domain Model]]'
  - '[[01_Architecture/Integration_Map|Integration Map]]'
  - '[[01_Architecture/Agent_Workflow|Agent Workflow]]'
related_decisions:
  - '[[04_Decisions/DEC-0002_prefer-product-local-adapters-before-fred-core-changes|DEC-0002 Prefer Product-Local Adapters Before Fred Core Changes]]'
  - '[[04_Decisions/DEC-0007_compose-a-product-job-journal-with-fred-checkpoints|DEC-0007 Compose a Product Job Journal with Fred Checkpoints]]'
related_bugs: []
tags:
  - agent-vault
  - phase
  - post-v1
---

# Phase 16 v2 Scaled Research Platform

Use this note as the canonical bounded milestone. Detailed execution belongs in linked step companion notes; architecture and durable choices belong in their linked notes.

## Objective

- Evolve the proven single-product architecture into a horizontally scalable research platform with distributed placement, multi-tenant quotas, portable orchestration improvements, and measured economics.

## Why This Phase Exists

- Distribution should follow real workload evidence. v2 addresses bottlenecks that cannot be solved safely by tuning the v1 architecture while preserving its contracts.

## Scope

- Partition job/event/checkpoint execution and artifact placement across workers and failure domains.
- Build a multi-tenant control plane for quotas, scheduling, isolation, regional placement, metering, and policy.
- Validate scale, disaster recovery, consistency, economics, and candidate broadly useful Fred enhancements with upstream-quality reproductions.

## Non-Goals

- Premature microservices or a distributed rewrite without measured v1 limits.
- Upstreaming product policy or coupling Fred to this repository.

## Dependencies

- Depends on [[02_Phases/Phase_15_v1_5_advanced_research/Phase|PHASE-15 v1.5 Advanced Research]].

## Acceptance Criteria

- [ ] Distributed execution preserves v1 idempotency, ordering, checkpoint, cancellation, provenance, and citation invariants under failover.
- [ ] Tenant and region isolation, quotas, placement, metering, and noisy-neighbor controls pass adversarial and capacity tests.
- [ ] Scale targets, cost curves, recovery objectives, migrations, rollback, observability, and operator runbooks are validated.
- [ ] Only generic, reusable Fred improvements are proposed upstream with isolated tests, compatibility analysis, and product-local fallback.

## Delivery Strategy

- **Safe parallel work:** Control-plane policy, distributed execution prototypes, and scale/economic modeling may proceed in parallel; migration strategy and release require integrated failure testing.
- **Gate:** The phase closes only when all acceptance criteria have reproducible evidence and the relevant docs, migrations, security checks, telemetry, and evaluations are updated.
- **Boundary:** Post-v1 work must not be pulled forward in a way that weakens v1 completeness or its release gates.

## Linear Context

<!-- AGENT-START:phase-linear-context -->
- Previous phase: [[02_Phases/Phase_15_v1_5_advanced_research/Phase|PHASE-15 v1.5 Advanced Research]]
- Current phase status: planned
- Next phase: none
<!-- AGENT-END:phase-linear-context -->

## Related Architecture

<!-- AGENT-START:phase-related-architecture -->
- [[01_Architecture/System_Overview|System Overview]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[01_Architecture/Integration_Map|Integration Map]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
<!-- AGENT-END:phase-related-architecture -->

## Related Decisions

<!-- AGENT-START:phase-related-decisions -->
- [[04_Decisions/DEC-0002_prefer-product-local-adapters-before-fred-core-changes|DEC-0002 Prefer Product-Local Adapters Before Fred Core Changes]]
- [[04_Decisions/DEC-0007_compose-a-product-job-journal-with-fred-checkpoints|DEC-0007 Compose a Product Job Journal with Fred Checkpoints]]
<!-- AGENT-END:phase-related-decisions -->

## Related Bugs

<!-- AGENT-START:phase-related-bugs -->
- None yet.
<!-- AGENT-END:phase-related-bugs -->

## Steps

<!-- AGENT-START:phase-steps -->
- [ ] [[02_Phases/Phase_16_v2_scaled_research_platform/Steps/Step_01_partition-and-distribute-research-orchestration|STEP-16-01 Partition and Distribute Research Orchestration]]
- [ ] [[02_Phases/Phase_16_v2_scaled_research_platform/Steps/Step_02_build-multi-tenant-control-plane-quotas-and-placement|STEP-16-02 Build Multi-Tenant Control Plane Quotas and Placement]]
- [ ] [[02_Phases/Phase_16_v2_scaled_research_platform/Steps/Step_03_validate-scale-economics-and-upstream-generic-fred-improvements|STEP-16-03 Validate Scale Economics and Upstream Generic Fred Improvements]]
<!-- AGENT-END:phase-steps -->

## Notes

- Product requirements: authoritative repository document `docs/product-brief.md`.
- Human-readable roadmap: `docs/roadmap.md`; concise index: `docs/implementation-plan.md`.
- Assumption policy: reversible uncertainties use the documented default until spike evidence requires a decision update; no hidden architectural assumption is carried only in chat.
