# Validation Plan

## Acceptance Checks

- Confirm this deliverable is present, testable where applicable, and bounded to the step: The narrowest typed slice for Resumable Idempotent Ingestion Jobs that is callable by the next step without broadening scope.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: update typed domain modules for `Ingestion Job` in `packages/domain/src/ingestion-job.ts`.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: Repository boundaries in `packages/persistence/src/repositories/ingestion-jobs.ts`, `packages/persistence/src/repositories/idempotency-keys.ts` that translate between storage records and typed domain objects.
- The step leaves the next dependent step with a stable typed boundary, not a placeholder or undocumented assumption.
- PostgreSQL integration tests cover lease expiry and reclaim, worker restart after checkpoint, duplicate delivery, concurrent claims, retry-budget exhaustion, cancellation, and invalid transitions.
- Replaying the same idempotency key yields one committed job and one checkpoint sequence.
- Effect service/layer and typed-error patterns follow repository conventions and the Effect skills; no promise or thrown-error escape path bypasses the job state machine.

## Planned Verification

- Planned command once these packages exist: `bun test packages/domain packages/ingestion packages/persistence` plus the nearest package-level `bun run typecheck`.
- Planned app/integration coverage once the app surfaces exist: `bun test apps/worker` for the API/worker/web path touched here.

## Edge Cases

- Partial progress, retries, or restarts should leave this step in a typed, inspectable state rather than a silent half-success.
- Deleted files, renames, permission errors, and partially processed trees must preserve lineage and remain safe to retry.

## Regression Expectations

- This step should remain a clean successor to [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_02_implement-sandboxed-recursive-discovery-and-hashing|STEP-03-02 Implement Sandboxed Recursive Discovery and Hashing]] rather than reworking already-planned scope upstream.
- Do not introduce one-model-call-per-file behavior during directory-scale ingestion.
- Keep existing source-version and citation guarantees intact while adding refresh and lineage logic.
- Make sure large-tree recovery scenarios stay bounded in time, memory, and repeated work.

## Security / Observability / Evaluation Focus

- Protect against symlink escapes, traversal, ignore-rule bypasses, and oversized or noisy trees.
- Persist enough ingestion state to explain partial failure and to resume safely after restart.
- Expose user controls for retry, cancel, and inspection without leaking arbitrary host paths.

## Related Notes

- Step: [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_03_build-resumable-idempotent-ingestion-jobs|STEP-03-03 Build Resumable Idempotent Ingestion Jobs]]
- Phase: [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Phase|Phase 03 durable directory ingestion and source refresh]]
