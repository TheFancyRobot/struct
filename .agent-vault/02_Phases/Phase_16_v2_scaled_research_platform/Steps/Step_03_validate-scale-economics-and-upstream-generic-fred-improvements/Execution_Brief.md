# Execution Brief

## Exact Outcome

- Validate and harden Scale Economics and Upstream Generic Fred Improvements with explicit evidence, remaining gaps, and next actions before the roadmap moves past v2 Scaled Research Platform.

## Prerequisites

- Re-read [[02_Phases/Phase_16_v2_scaled_research_platform/Phase|Phase 16 v2 scaled research platform]] and confirm the step still matches the current roadmap sequence.
- Confirm the handoff from [[02_Phases/Phase_16_v2_scaled_research_platform/Steps/Step_02_build-multi-tenant-control-plane-quotas-and-placement|STEP-16-02 Build Multi-Tenant Control Plane Quotas and Placement]] before widening scope.
- Keep deterministic work in typed Effect services, repositories, and tools; reserve Fred for agentic orchestration only.
- Treat the listed files as planned starting points; create only the smallest set needed to land the slice.

## Planned Starting Files

- These paths may not exist yet; use them as the first bounded implementation or design surface.
- `packages/evaluation/src/scale-economics.ts`
- `docs/adr/ADR-xxxx-fred-upstream-candidates.md`
- `docs/benchmarks/v2-scale.md`
- `docs/operations/distributed-research.md`

## Required Reading

- [[02_Phases/Phase_16_v2_scaled_research_platform/Phase|Phase 16 v2 scaled research platform]]
- [[01_Architecture/System_Overview|System Overview]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[02_Phases/Phase_16_v2_scaled_research_platform/Steps/Step_02_build-multi-tenant-control-plane-quotas-and-placement|STEP-16-02 Build Multi-Tenant Control Plane Quotas and Placement]]
- `docs/product-brief.md` sections 7, 18-25, 28-31.

## Smallest Bounded Checklist

- Assemble the representative success, failure, recovery, and adversarial scenarios for this slice.
- Run or script the targeted checks called out in the validation plan and collect durable evidence.
- Remediate blocking issues that belong in-scope or record precise follow-ups for work that does not.
- Avoid net-new feature scope while closing the validation and hardening pass.

## Constraints and Non-Goals

- Scale work should extend the proven local model rather than replacing it with distributed complexity prematurely.
- Control-plane placement, quotas, and dispatch must preserve the same typed workflow semantics and evidence guarantees.
- Identify which improvements belong upstream in generic Fred versus staying product-local.

## Related Notes

- Step: [[02_Phases/Phase_16_v2_scaled_research_platform/Steps/Step_03_validate-scale-economics-and-upstream-generic-fred-improvements|STEP-16-03 Validate Scale Economics and Upstream Generic Fred Improvements]]
- Phase: [[02_Phases/Phase_16_v2_scaled_research_platform/Phase|Phase 16 v2 scaled research platform]]
