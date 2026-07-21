# Execution Brief

## Exact Outcome

- Implement the smallest coherent slice for Incremental Research from Version Changes that advances v1.3 Continuous Research while preserving automated refresh without duplicate side effects or stale claims.

## Prerequisites

- Re-read [[02_Phases/Phase_13_v1_3_continuous_research/Phase|Phase 13 v1 3 continuous research]] and confirm the step still matches the current roadmap sequence.
- Confirm the handoff from [[02_Phases/Phase_13_v1_3_continuous_research/Steps/Step_01_schedule-source-change-detection-and-refresh|STEP-13-01 Schedule Source Change Detection and Refresh]] before widening scope.
- Keep deterministic work in typed Effect services, repositories, and tools; reserve Fred for agentic orchestration only.
- Treat the listed files as planned starting points; create only the smallest set needed to land the slice.

## Planned Starting Files

- These paths may not exist yet; use them as the first bounded implementation or design surface.
- `packages/research-engine/src/research-invalidation.ts`
- `apps/worker/src/jobs/rerun-research.ts`
- `apps/api/src/routes/research-refresh.ts`
- `packages/domain/src/research-rerun.ts`

## Required Reading

- [[02_Phases/Phase_13_v1_3_continuous_research/Phase|Phase 13 v1 3 continuous research]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[02_Phases/Phase_13_v1_3_continuous_research/Steps/Step_01_schedule-source-change-detection-and-refresh|STEP-13-01 Schedule Source Change Detection and Refresh]]
- `docs/product-brief.md` sections 10, 18-25, 28-29, and 31.

## Smallest Bounded Checklist

- Build an impact graph from changed source versions to derived indexes, query artifacts, evidence, citations, findings, reports, and plan branches.
- Present the affected scope and estimated budget before rerunning only invalidated branches under explicit workspace policy or user approval.
- Reuse unchanged deterministic and Fred artifacts by verified identity while preserving the prior run and linking the new run as a successor.
- Test additions, deletions, schema drift, contradictory changes, partial reruns, cancellation, model/provider changes, and crash recovery.

## Constraints and Non-Goals

- Continuous research must build on immutable source-version changes, not mutate old runs in place.
- Scheduling, alerts, and reruns need explicit staleness semantics, budgets, and operator controls.
- Automated reruns should reuse existing deterministic tooling and workflow recovery paths rather than fork new logic.

## Related Notes

- Step: [[02_Phases/Phase_13_v1_3_continuous_research/Steps/Step_02_rerun-incremental-research-from-version-changes|STEP-13-02 Rerun Incremental Research from Version Changes]]
- Phase: [[02_Phases/Phase_13_v1_3_continuous_research/Phase|Phase 13 v1 3 continuous research]]
