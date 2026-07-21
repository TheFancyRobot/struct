# Execution Brief

## Exact Outcome

- Implement the smallest coherent slice for Multi-Tenant Control Plane Quotas and Placement that advances v2 Scaled Research Platform while preserving distributed scale with quotas, reproducibility, and upstream clarity.

## Prerequisites

- Re-read [[02_Phases/Phase_16_v2_scaled_research_platform/Phase|Phase 16 v2 scaled research platform]] and confirm the step still matches the current roadmap sequence.
- Confirm the handoff from [[02_Phases/Phase_16_v2_scaled_research_platform/Steps/Step_01_partition-and-distribute-research-orchestration|STEP-16-01 Partition and Distribute Research Orchestration]] before widening scope.
- Keep deterministic work in typed Effect services, repositories, and tools; reserve Fred for agentic orchestration only.
- Treat the listed files as planned starting points; create only the smallest set needed to land the slice.

## Planned Starting Files

- These paths may not exist yet; use them as the first bounded implementation or design surface.
- `packages/domain/src/quota-policy.ts`
- `apps/api/src/routes/control-plane.ts`
- `apps/worker/src/orchestration/placement.ts`
- `packages/persistence/src/repositories/tenant-quotas.ts`

## Required Reading

- [[02_Phases/Phase_16_v2_scaled_research_platform/Phase|Phase 16 v2 scaled research platform]]
- [[01_Architecture/System_Overview|System Overview]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[02_Phases/Phase_16_v2_scaled_research_platform/Steps/Step_01_partition-and-distribute-research-orchestration|STEP-16-01 Partition and Distribute Research Orchestration]]
- `docs/product-brief.md` sections 7, 18-25, 28-31.

## Smallest Bounded Checklist

- Define tenant quota, placement, region, capacity, metering, residency, encryption-key, and policy schemas separate from research-domain records.
- Implement admission control and scheduling that enforce per-tenant budgets, noisy-neighbor isolation, data locality, and capability requirements.
- Expose safe administrative controls, usage attribution, saturation signals, and auditable placement decisions without leaking tenant data.
- Test quota races, placement failure, region evacuation, metering reconciliation, key revocation, noisy neighbors, and control-plane rollback.

## Constraints and Non-Goals

- Scale work should extend the proven local model rather than replacing it with distributed complexity prematurely.
- Control-plane placement, quotas, and dispatch must preserve the same typed workflow semantics and evidence guarantees.
- Identify which improvements belong upstream in generic Fred versus staying product-local.

## Related Notes

- Step: [[02_Phases/Phase_16_v2_scaled_research_platform/Steps/Step_02_build-multi-tenant-control-plane-quotas-and-placement|STEP-16-02 Build Multi-Tenant Control Plane Quotas and Placement]]
- Phase: [[02_Phases/Phase_16_v2_scaled_research_platform/Phase|Phase 16 v2 scaled research platform]]
