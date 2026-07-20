# Execution Brief

## Exact Outcome

- Implement the smallest coherent slice for and Distribute Research Orchestration that advances v2 Scaled Research Platform while preserving distributed scale with quotas, reproducibility, and upstream clarity.

## Prerequisites

- Re-read [[02_Phases/Phase_15_v2_scaled_research_platform/Phase|Phase 15 v2 scaled research platform]] and confirm the step still matches the current roadmap sequence.
- Confirm the handoff from [[02_Phases/Phase_14_v1_5_advanced_research/Steps/Step_03_evaluate-advanced-models-tools-and-research-modes|STEP-14-03 Evaluate Advanced Models Tools and Research Modes]] before widening scope.
- Keep deterministic work in typed Effect services, repositories, and tools; reserve Fred for agentic orchestration only.
- Treat the listed files as planned starting points; create only the smallest set needed to land the slice.

## Planned Starting Files

- These paths may not exist yet; use them as the first bounded implementation or design surface.
- `apps/worker/src/orchestration/distributed-dispatch.ts`
- `packages/workflows/src/graphs/distributed-research.ts`
- `docs/architecture/v2-distribution.md`
- `packages/domain/src/distributed-run.ts`

## Required Reading

- [[02_Phases/Phase_15_v2_scaled_research_platform/Phase|Phase 15 v2 scaled research platform]]
- [[01_Architecture/System_Overview|System Overview]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[02_Phases/Phase_14_v1_5_advanced_research/Steps/Step_03_evaluate-advanced-models-tools-and-research-modes|STEP-14-03 Evaluate Advanced Models Tools and Research Modes]]
- `docs/product-brief.md` sections 7, 18-25, 28-31.

## Smallest Bounded Checklist

- Define distributed job, lease, partition, event-ordering, checkpoint, artifact-placement, cancellation, and reconciliation contracts that preserve v1 identities.
- Introduce partition-aware scheduling behind existing service interfaces with idempotent ownership transfer and bounded retries.
- Keep large results in content-addressed storage and prove workflow/job recovery across worker and failure-domain loss.
- Run fault-injection tests for duplicate delivery, split ownership, delayed events, partial checkpoints, regional loss, and safe rollback to the single-region path.

## Constraints and Non-Goals

- Scale work should extend the proven local model rather than replacing it with distributed complexity prematurely.
- Control-plane placement, quotas, and dispatch must preserve the same typed workflow semantics and evidence guarantees.
- Identify which improvements belong upstream in generic Fred versus staying product-local.

## Related Notes

- Step: [[02_Phases/Phase_15_v2_scaled_research_platform/Steps/Step_01_partition-and-distribute-research-orchestration|STEP-15-01 Partition and Distribute Research Orchestration]]
- Phase: [[02_Phases/Phase_15_v2_scaled_research_platform/Phase|Phase 15 v2 scaled research platform]]
