# Execution Brief

## Exact Outcome

- Produce the concrete contracts, artifacts, and bounded implementation/design surfaces for Directory Status Recovery and Controls that this step is responsible for before any broader follow-on work begins.

## Prerequisites

- Re-read [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Phase|Phase 03 durable directory ingestion and source refresh]] and confirm the step still matches the current roadmap sequence.
- Confirm the handoff from [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_04_process-changed-sources-and-preserve-version-lineage|STEP-03-04 Process Changed Sources and Preserve Version Lineage]] before widening scope.
- Keep deterministic work in typed Effect services, repositories, and tools; reserve Fred for agentic orchestration only.
- Treat the listed files as planned starting points; create only the smallest set needed to land the slice.

## Planned Starting Files

- These paths may not exist yet; use them as the first bounded implementation or design surface.
- `apps/api/src/routes/directories.ts`
- `apps/api/src/routes/ingestion-jobs.ts`
- `apps/web/src/components/DirectoryBrowser.tsx`
- `apps/web/src/components/IngestionJobStatus.tsx`
- `apps/web/src/components/SourceControls.tsx`

## Required Reading

- [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Phase|Phase 03 durable directory ingestion and source refresh]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[01_Architecture/System_Overview|System Overview]]
- [[01_Architecture/Code_Map|Code Map]]
- [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_04_process-changed-sources-and-preserve-version-lineage|STEP-03-04 Process Changed Sources and Preserve Version Lineage]]
- `docs/product-brief.md` sections 10, 18-19, 21-25, 26-27, and 29-31.

## Concrete Deliverables

- Implement the narrowest typed slice for Directory Status Recovery and Controls that is callable by the next step without broadening scope.
- Expose only the minimal API surface in `apps/api/src/routes/directories.ts`, `apps/api/src/routes/ingestion-jobs.ts` needed to exercise this step end to end.
- Use `apps/web/src/components/DirectoryBrowser.tsx`, `apps/web/src/components/IngestionJobStatus.tsx`, `apps/web/src/components/SourceControls.tsx` to expose only the UI states required to inspect this step’s output and failures.

## Smallest Bounded Checklist

- First, implement the narrowest typed slice for Directory Status Recovery and Controls that is callable by the next step without broadening scope.
- Then, expose only the minimal API surface in `apps/api/src/routes/directories.ts`, `apps/api/src/routes/ingestion-jobs.ts` needed to exercise this step end to end.
- Next, use `apps/web/src/components/DirectoryBrowser.tsx`, `apps/web/src/components/IngestionJobStatus.tsx`, `apps/web/src/components/SourceControls.tsx` to expose only the UI states required to inspect this step’s output and failures.
- Finish by leaving one observable typed path—test, route, worker flow, or UI state—that proves the slice is ready for the next dependent step.

## Constraints and Non-Goals

- Directory work must begin from manifests, hashing, and deterministic classification before any expensive downstream processing.
- Support partial success, resume, and refresh as first-class workflow behaviors rather than bolted-on retries.
- Never widen filesystem access beyond registered roots and explicit sandbox rules.

## Related Notes

- Step: [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_05_expose-directory-status-recovery-and-controls|STEP-03-05 Expose Directory Status Recovery and Controls]]
- Phase: [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Phase|Phase 03 durable directory ingestion and source refresh]]
