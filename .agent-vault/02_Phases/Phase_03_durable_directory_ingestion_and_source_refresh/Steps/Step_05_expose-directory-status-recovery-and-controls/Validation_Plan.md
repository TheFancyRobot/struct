# Validation Plan

## Acceptance Checks

- Confirm this deliverable is present, testable where applicable, and bounded to the step: The narrowest typed slice for Directory Status Recovery and Controls that is callable by the next step without broadening scope.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: Only the minimal API surface in `apps/api/src/routes/directories.ts`, `apps/api/src/routes/ingestion-jobs.ts` needed to exercise this step end to end.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: `apps/web/src/components/DirectoryBrowser.tsx`, `apps/web/src/components/IngestionJobStatus.tsx`, `apps/web/src/components/SourceControls.tsx` to expose only the UI states required to inspect this step’s output and failures.
- The step leaves the next dependent step with a stable typed boundary, not a placeholder or undocumented assumption.
- API tests reject cross-scope reads and commands plus invalid state transitions while preserving idempotent command retries.
- SolidJS tests render every required state, expose honest aggregate/per-entry counts, and prove controls remain disabled or enabled according to persisted job state.
- Reconnect tests replay from the last event cursor without duplicated progress or loss of terminal state.

## Planned Verification

- Run the nearest repo-wide or package-targeted `bun run typecheck` command once the touched packages and apps exist.
- Planned app/integration coverage once the app surfaces exist: `bun test apps/api apps/web` for the API/worker/web path touched here.
- Add a browser/e2e or component-level check that exercises the visible UI state introduced by this step and one failure presentation path.

## Edge Cases

- Partial progress, retries, or restarts should leave this step in a typed, inspectable state rather than a silent half-success.
- Deleted files, renames, permission errors, and partially processed trees must preserve lineage and remain safe to retry.

## Regression Expectations

- This step should remain a clean successor to [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_04_process-changed-sources-and-preserve-version-lineage|STEP-03-04 Process Changed Sources and Preserve Version Lineage]] rather than reworking already-planned scope upstream.
- Do not introduce one-model-call-per-file behavior during directory-scale ingestion.
- Keep existing source-version and citation guarantees intact while adding refresh and lineage logic.
- Make sure large-tree recovery scenarios stay bounded in time, memory, and repeated work.

## Security / Observability / Evaluation Focus

- Protect against symlink escapes, traversal, ignore-rule bypasses, and oversized or noisy trees.
- Persist enough ingestion state to explain partial failure and to resume safely after restart.
- Expose user controls for retry, cancel, and inspection without leaking arbitrary host paths.
- Trace every restart, cancel, and replay decision with run/step identifiers so operators can reconstruct the timeline after failure.

## Related Notes

- Step: [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_05_expose-directory-status-recovery-and-controls|STEP-03-05 Expose Directory Status Recovery and Controls]]
- Phase: [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Phase|Phase 03 durable directory ingestion and source refresh]]
