# Execution Brief

## Exact Outcome

- Produce the concrete contracts, artifacts, and bounded implementation/design surfaces for Sandboxed Recursive Discovery and Hashing that this step is responsible for before any broader follow-on work begins.

## Prerequisites

- Re-read [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Phase|Phase 03 durable directory ingestion and source refresh]] and confirm the step still matches the current roadmap sequence.
- Confirm the handoff from [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_01_define-directory-manifests-snapshots-and-refresh-semantics|STEP-03-01 Define Directory Manifests Snapshots and Refresh Semantics]] before widening scope.
- Keep deterministic work in typed Effect services, repositories, and tools; reserve Fred for agentic orchestration only.
- Treat the listed files as planned starting points; create only the smallest set needed to land the slice.

## Planned Starting Files

- These paths may not exist yet; use them as the first bounded implementation or design surface.
- `packages/ingestion/src/discover-directory.ts`
- `packages/ingestion/src/path-safety.ts`
- `packages/ingestion/src/hash-file.ts`
- `packages/ingestion/src/ignore-rules.ts`
- `apps/worker/src/jobs/scan-directory.ts`

## Required Reading

- [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Phase|Phase 03 durable directory ingestion and source refresh]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[01_Architecture/System_Overview|System Overview]]
- [[01_Architecture/Code_Map|Code Map]]
- [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_01_define-directory-manifests-snapshots-and-refresh-semantics|STEP-03-01 Define Directory Manifests Snapshots and Refresh Semantics]]
- `docs/product-brief.md` sections 10, 18-19, 21-25, 26-27, and 29-31.

## Concrete Deliverables

- Implement the narrowest typed slice for Sandboxed Recursive Discovery and Hashing that is callable by the next step without broadening scope.
- Use `packages/ingestion/src/discover-directory.ts`, `packages/ingestion/src/path-safety.ts`, `packages/ingestion/src/hash-file.ts` to make discovery, classification, refresh, or job state deterministic before any model-dependent behavior is introduced.
- Constrain worker-side execution in `apps/worker/src/jobs/scan-directory.ts` to one resumable, observable path for this slice.

## Smallest Bounded Checklist

- First, implement the narrowest typed slice for Sandboxed Recursive Discovery and Hashing that is callable by the next step without broadening scope.
- Then, use `packages/ingestion/src/discover-directory.ts`, `packages/ingestion/src/path-safety.ts`, `packages/ingestion/src/hash-file.ts` to make discovery, classification, refresh, or job state deterministic before any model-dependent behavior is introduced.
- Next, constrain worker-side execution in `apps/worker/src/jobs/scan-directory.ts` to one resumable, observable path for this slice.
- Finish by leaving one observable typed path—test, route, worker flow, or UI state—that proves the slice is ready for the next dependent step.

## Constraints and Non-Goals

- Directory work must begin from manifests, hashing, and deterministic classification before any expensive downstream processing.
- Support partial success, resume, and refresh as first-class workflow behaviors rather than bolted-on retries.
- Never widen filesystem access beyond registered roots and explicit sandbox rules.

## Related Notes

- Step: [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_02_implement-sandboxed-recursive-discovery-and-hashing|STEP-03-02 Implement Sandboxed Recursive Discovery and Hashing]]
- Phase: [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Phase|Phase 03 durable directory ingestion and source refresh]]
