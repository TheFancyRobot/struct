# Validation Plan

## Acceptance Checks

- The slice for Incremental Research from Version Changes is implemented through typed module boundaries in the planned files (`packages/research-engine/src/research-invalidation.ts`, `apps/worker/src/jobs/rerun-research.ts`, `apps/api/src/routes/research-refresh.ts`...).
- An observable path exists from the new code to the adjacent API, worker, persistence, or UI surface it must support.
- The result advances automated refresh without duplicate side effects or stale claims without bypassing provenance, bounded execution, or validation expectations.

## Planned Verification

- Run the nearest repo-wide or package-targeted `bun run typecheck` command once the touched packages and apps exist.
- Run targeted unit tests for the domain, service, or adapter code introduced by this step.
- Run an integration flow that exercises the API/worker boundary touched by this step, including failure handling.

## Edge Cases

- Partial progress, retries, or restarts should not leave Incremental Research from Version Changes in an ambiguous state.
- The step should surface unsupported, invalid, or adversarial inputs explicitly instead of silently guessing.
- Cancellation, duplicate actions, and no-progress loops should stop cleanly without duplicating side effects.

## Regression Expectations

- This step should remain a clean successor to [[02_Phases/Phase_13_v1_3_continuous_research/Steps/Step_01_schedule-source-change-detection-and-refresh|STEP-13-01 Schedule Source Change Detection and Refresh]] rather than reworking already-planned scope upstream.
- Do not duplicate side effects or reprocess unchanged data during scheduled refreshes.
- Keep historical research provenance intact even when new versions trigger alerts or reruns.
- Make sure continuous operations remain inspectable and cancellable from the product surface.

## Security / Observability / Evaluation Focus

- Bound scheduled execution, notification fan-out, and automatic rerun depth before enabling unattended operation.
- Protect alert channels and operational metadata from leaking source content unnecessarily.
- Extend recovery tests to cover restarts, missed schedules, and invalidation of stale findings.

## Related Notes

- Step: [[02_Phases/Phase_13_v1_3_continuous_research/Steps/Step_02_rerun-incremental-research-from-version-changes|STEP-13-02 Rerun Incremental Research from Version Changes]]
- Phase: [[02_Phases/Phase_13_v1_3_continuous_research/Phase|Phase 13 v1 3 continuous research]]
