# Validation Plan

## Acceptance Checks

- Confirm this deliverable is present, testable where applicable, and bounded to the step: The narrowest typed slice for Changed Sources and Preserve Version Lineage that is callable by the next step without broadening scope.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: Repository boundaries in `packages/persistence/src/repositories/source-versions.ts` that translate between storage records and typed domain objects.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: `packages/ingestion/src/diff-manifest.ts`, `packages/ingestion/src/apply-refresh.ts` to make discovery, classification, refresh, or job state deterministic before any model-dependent behavior is introduced.
- The step leaves the next dependent step with a stable typed boundary, not a placeholder or undocumented assumption.
- Integration tests cover mixed add/change/remove/unchanged refreshes, replay after partial failure, transaction rollback, and cross-workspace/project isolation.
- Crash tests cover before artifact staging, after artifact staging/before PostgreSQL commit, after PostgreSQL commit/before acknowledgement, and before event publication; every replay must converge without duplicate versions, chunks, indexes, checkpoints, or events.
- An unchanged refresh creates no new artifact, source version, document chunk, or retrieval index record.
- Historical citations against superseded or removed entries still resolve to the original immutable source version.

## Planned Verification

- Planned command once these packages exist: `bun test packages/ingestion packages/persistence packages/source-storage` plus the nearest package-level `bun run typecheck`.
- Planned app/integration coverage once the app surfaces exist: `bun test apps/worker` for the API/worker/web path touched here.

## Edge Cases

- Partial progress, retries, or restarts should leave this step in a typed, inspectable state rather than a silent half-success.

## Regression Expectations

- This step should remain a clean successor to [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_03_build-resumable-idempotent-ingestion-jobs|STEP-03-03 Build Resumable Idempotent Ingestion Jobs]] rather than reworking already-planned scope upstream.
- Do not introduce one-model-call-per-file behavior during directory-scale ingestion.
- Keep existing source-version and citation guarantees intact while adding refresh and lineage logic.
- Make sure large-tree recovery scenarios stay bounded in time, memory, and repeated work.

## Security / Observability / Evaluation Focus

- Protect against symlink escapes, traversal, ignore-rule bypasses, and oversized or noisy trees.
- Persist enough ingestion state to explain partial failure and to resume safely after restart.
- Expose user controls for retry, cancel, and inspection without leaking arbitrary host paths.

## Related Notes

- Step: [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_04_process-changed-sources-and-preserve-version-lineage|STEP-03-04 Process Changed Sources and Preserve Version Lineage]]
- Phase: [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Phase|Phase 03 durable directory ingestion and source refresh]]
