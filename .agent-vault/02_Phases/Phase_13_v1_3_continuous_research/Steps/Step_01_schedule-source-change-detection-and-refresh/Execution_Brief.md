# Execution Brief

## Exact Outcome

- Implement the smallest coherent slice for Source Change Detection and Refresh that advances v1.3 Continuous Research while preserving automated refresh without duplicate side effects or stale claims.

## Prerequisites

- Re-read [[02_Phases/Phase_13_v1_3_continuous_research/Phase|Phase 13 v1 3 continuous research]] and confirm the step still matches the current roadmap sequence.
- Confirm the handoff from [[02_Phases/Phase_12_v1_2_additional_sources/Steps/Step_03_validate-connector-provenance-security-and-recovery|STEP-12-03 Validate Connector Provenance Security and Recovery]] before widening scope.
- Keep deterministic work in typed Effect services, repositories, and tools; reserve Fred for agentic orchestration only.
- Treat the listed files as planned starting points; create only the smallest set needed to land the slice.

## Planned Starting Files

- These paths may not exist yet; use them as the first bounded implementation or design surface.
- `apps/worker/src/jobs/schedule-refresh.ts`
- `packages/ingestion/src/watchers/refresh-policy.ts`
- `packages/domain/src/scheduled-refresh.ts`
- `packages/persistence/src/repositories/refresh-schedules.ts`

## Required Reading

- [[02_Phases/Phase_13_v1_3_continuous_research/Phase|Phase 13 v1 3 continuous research]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[02_Phases/Phase_12_v1_2_additional_sources/Steps/Step_03_validate-connector-provenance-security-and-recovery|STEP-12-03 Validate Connector Provenance Security and Recovery]]
- `docs/product-brief.md` sections 10, 18-25, 28-29, and 31.

## Smallest Bounded Checklist

- Define typed schedules, connector cursors, refresh policies, leases, and idempotency keys scoped to a workspace and source.
- Dispatch scheduled or event-driven checks through the existing durable ingestion path so every change creates a new immutable version.
- Enforce concurrency, backoff, jitter, cost, quiet-hour, and cancellation policies with observable next-run and failure state.
- Test duplicate triggers, missed schedules, clock changes, worker restarts, revoked connectors, no-change runs, and safe replay.

## Constraints and Non-Goals

- Continuous research must build on immutable source-version changes, not mutate old runs in place.
- Scheduling, alerts, and reruns need explicit staleness semantics, budgets, and operator controls.
- Automated reruns should reuse existing deterministic tooling and workflow recovery paths rather than fork new logic.

## Related Notes

- Step: [[02_Phases/Phase_13_v1_3_continuous_research/Steps/Step_01_schedule-source-change-detection-and-refresh|STEP-13-01 Schedule Source Change Detection and Refresh]]
- Phase: [[02_Phases/Phase_13_v1_3_continuous_research/Phase|Phase 13 v1 3 continuous research]]
