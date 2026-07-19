# Implementation Notes

- Capture durable findings learned during execution. Prefer short bullets with file paths, commands, and observed behavior.

## Related Notes

- Step: [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_05_expose-directory-status-recovery-and-controls|STEP-03-05 Expose Directory Status Recovery and Controls]]
- Phase: [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Phase|Phase 03 durable directory ingestion and source refresh]]

- `packages/domain/src/directory-controls.ts` defines honest aggregate counts, scoped status projections, entry failures, commands, and progress events.
- `packages/persistence/src/repositories/directory-controls.ts` owns atomic registration, scoped reads, latest-per-entry outcomes, command idempotency, and event replay.
- `apps/api/src/routes/directories.ts`, `ingestion-jobs.ts`, and `directory-events.ts` expose the bounded HTTP/SSE surface.
- `apps/web/src/components/DirectoryBrowser.tsx`, `IngestionJobStatus.tsx`, `SourceControls.tsx`, and `DirectoryControlPanel.tsx` use Solid signals/control flow and the existing SSE hook.
