# Execution Brief

## Exact Outcome

- Produce the concrete contracts, artifacts, and bounded implementation/design surfaces for Changed Sources and Preserve Version Lineage that this step is responsible for before any broader follow-on work begins.

## Prerequisites

- Re-read [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Phase|Phase 03 durable directory ingestion and source refresh]] and confirm the step still matches the current roadmap sequence.
- Confirm the handoff from [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_03_build-resumable-idempotent-ingestion-jobs|STEP-03-03 Build Resumable Idempotent Ingestion Jobs]] before widening scope.
- Keep deterministic work in typed Effect services, repositories, and tools; reserve Fred for agentic orchestration only.
- Treat the listed files as planned starting points; create only the smallest set needed to land the slice.

## Planned Starting Files

- These paths may not exist yet; use them as the first bounded implementation or design surface.
- `packages/ingestion/src/diff-manifest.ts`
- `packages/ingestion/src/apply-refresh.ts`
- `packages/persistence/src/repositories/source-versions.ts`
- `packages/source-storage/src/versioned-artifacts.ts`
- `apps/worker/src/jobs/refresh-directory.ts`

## Required Reading

- [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Phase|Phase 03 durable directory ingestion and source refresh]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[01_Architecture/System_Overview|System Overview]]
- [[01_Architecture/Code_Map|Code Map]]
- [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_03_build-resumable-idempotent-ingestion-jobs|STEP-03-03 Build Resumable Idempotent Ingestion Jobs]]
- `docs/product-brief.md` sections 10, 18-19, 21-25, 26-27, and 29-31.

## Concrete Deliverables

- Implement the narrowest typed slice for Changed Sources and Preserve Version Lineage that is callable by the next step without broadening scope.
- Add repository boundaries in `packages/persistence/src/repositories/source-versions.ts` that translate between storage records and typed domain objects.
- Use `packages/ingestion/src/diff-manifest.ts`, `packages/ingestion/src/apply-refresh.ts` to make discovery, classification, refresh, or job state deterministic before any model-dependent behavior is introduced.
- Constrain worker-side execution in `apps/worker/src/jobs/refresh-directory.ts` to one resumable, observable path for this slice.
- Compute a pure manifest diff, then apply it transactionally through existing source, artifact, chunk, and retrieval services.
- Reuse unchanged artifacts and source versions, create immutable versions only for changed or added content, and record removals in snapshot history without deleting prior provenance.
- Keep rename handling conservative: classify only when stable identity proves it; otherwise represent removal plus addition rather than guessing.

## Smallest Bounded Checklist

- First, implement the narrowest typed slice for Changed Sources and Preserve Version Lineage that is callable by the next step without broadening scope.
- Then, add repository boundaries in `packages/persistence/src/repositories/source-versions.ts` that translate between storage records and typed domain objects.
- Next, use `packages/ingestion/src/diff-manifest.ts`, `packages/ingestion/src/apply-refresh.ts` to make discovery, classification, refresh, or job state deterministic before any model-dependent behavior is introduced.
- Finish by leaving one observable typed path—test, route, worker flow, or UI state—that proves the slice is ready for the next dependent step.

## Constraints and Non-Goals

- Directory work must begin from manifests, hashing, and deterministic classification before any expensive downstream processing.
- Support partial success, resume, and refresh as first-class workflow behaviors rather than bolted-on retries.
- Never widen filesystem access beyond registered roots and explicit sandbox rules.

## Related Notes

- Step: [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_04_process-changed-sources-and-preserve-version-lineage|STEP-03-04 Process Changed Sources and Preserve Version Lineage]]
- Phase: [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Phase|Phase 03 durable directory ingestion and source refresh]]
