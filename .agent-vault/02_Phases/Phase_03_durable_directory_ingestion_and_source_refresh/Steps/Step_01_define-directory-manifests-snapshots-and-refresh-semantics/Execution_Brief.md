# Execution Brief

## Exact Outcome

- Produce the concrete contracts, artifacts, and bounded implementation/design surfaces for Directory Manifests Snapshots and Refresh Semantics that this step is responsible for before any broader follow-on work begins.

## Prerequisites

- Re-read [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Phase|Phase 03 durable directory ingestion and source refresh]] and confirm the step still matches the current roadmap sequence.
- Confirm the handoff from [[02_Phases/Phase_01_walking_skeleton/Steps/Step_06_automate-vertical-slice-tests-documentation-and-observability|STEP-01-06 Automate Vertical Slice Tests Documentation and Observability]] before widening scope.
- Keep deterministic work in typed Effect services, repositories, and tools; reserve Fred for agentic orchestration only.
- Treat the listed files as planned starting points; create only the smallest set needed to land the slice.

## Planned Starting Files

- These paths may not exist yet; use them as the first bounded implementation or design surface.
- `packages/domain/src/directory-manifest.ts`
- `packages/domain/src/source-version.ts`
- `packages/ingestion/src/refresh-plan.ts`
- `docs/directory-refresh.md`

## Required Reading

- [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Phase|Phase 03 durable directory ingestion and source refresh]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[01_Architecture/System_Overview|System Overview]]
- [[01_Architecture/Code_Map|Code Map]]
- [[02_Phases/Phase_01_walking_skeleton/Steps/Step_06_automate-vertical-slice-tests-documentation-and-observability|STEP-01-06 Automate Vertical Slice Tests Documentation and Observability]]
- `docs/product-brief.md` sections 10, 18-19, 21-25, 26-27, and 29-31.

## Concrete Deliverables

- Define the concrete contract for Directory Manifests Snapshots and Refresh Semantics in the first planned domain, persistence, or documentation files so downstream implementation does not need to rediscover the boundary.
- Define or update typed domain modules for `Directory Manifest`, `SourceVersion` in `packages/domain/src/directory-manifest.ts`, `packages/domain/src/source-version.ts`.
- Use `packages/ingestion/src/refresh-plan.ts` to make discovery, classification, refresh, or job state deterministic before any model-dependent behavior is introduced.
- Capture the durable contract or operator guidance in `docs/directory-refresh.md` rather than burying it in session-only notes.

## Smallest Bounded Checklist

- First, define the concrete contract for Directory Manifests Snapshots and Refresh Semantics in the first planned domain, persistence, or documentation files so downstream implementation does not need to rediscover the boundary.
- Then, define or update typed domain modules for `Directory Manifest`, `SourceVersion` in `packages/domain/src/directory-manifest.ts`, `packages/domain/src/source-version.ts`.
- Next, use `packages/ingestion/src/refresh-plan.ts` to make discovery, classification, refresh, or job state deterministic before any model-dependent behavior is introduced.
- Finish by recording the chosen contract, recommendation, or runbook in the planned docs/ADR artifacts before expanding scope.

## Constraints and Non-Goals

- Directory work must begin from manifests, hashing, and deterministic classification before any expensive downstream processing.
- Support partial success, resume, and refresh as first-class workflow behaviors rather than bolted-on retries.
- Never widen filesystem access beyond registered roots and explicit sandbox rules.

## Related Notes

- Step: [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_01_define-directory-manifests-snapshots-and-refresh-semantics|STEP-03-01 Define Directory Manifests Snapshots and Refresh Semantics]]
- Phase: [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Phase|Phase 03 durable directory ingestion and source refresh]]
