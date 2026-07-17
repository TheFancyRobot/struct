# Validation Plan

## Acceptance Checks

- The slice for Source Change Detection and Refresh is implemented through typed module boundaries in the planned files (`apps/worker/src/jobs/schedule-refresh.ts`, `packages/ingestion/src/watchers/refresh-policy.ts`, `packages/domain/src/scheduled-refresh.ts`...).
- An observable path exists from the new code to the adjacent API, worker, persistence, or UI surface it must support.
- The result advances automated refresh without duplicate side effects or stale claims without bypassing provenance, bounded execution, or validation expectations.

## Planned Verification

- Run the nearest repo-wide or package-targeted `bun run typecheck` command once the touched packages and apps exist.
- Run targeted unit tests for the domain, service, or adapter code introduced by this step.
- Run an integration flow that exercises the API/worker boundary touched by this step, including failure handling.

## Edge Cases

- Partial progress, retries, or restarts should not leave Source Change Detection and Refresh in an ambiguous state.
- The step should surface unsupported, invalid, or adversarial inputs explicitly instead of silently guessing.
- Deleted files, renamed files, permission errors, and partially reachable sources should preserve lineage and recovery paths.

## Regression Expectations

- This step should remain a clean successor to [[02_Phases/Phase_11_v1_2_additional_sources/Steps/Step_03_validate-connector-provenance-security-and-recovery|STEP-11-03 Validate Connector Provenance Security and Recovery]] rather than reworking already-planned scope upstream.
- Do not duplicate side effects or reprocess unchanged data during scheduled refreshes.
- Keep historical research provenance intact even when new versions trigger alerts or reruns.
- Make sure continuous operations remain inspectable and cancellable from the product surface.

## Security / Observability / Evaluation Focus

- Bound scheduled execution, notification fan-out, and automatic rerun depth before enabling unattended operation.
- Protect alert channels and operational metadata from leaking source content unnecessarily.
- Extend recovery tests to cover restarts, missed schedules, and invalidation of stale findings.

## Related Notes

- Step: [[02_Phases/Phase_12_v1_3_continuous_research/Steps/Step_01_schedule-source-change-detection-and-refresh|STEP-12-01 Schedule Source Change Detection and Refresh]]
- Phase: [[02_Phases/Phase_12_v1_3_continuous_research/Phase|Phase 12 v1 3 continuous research]]
