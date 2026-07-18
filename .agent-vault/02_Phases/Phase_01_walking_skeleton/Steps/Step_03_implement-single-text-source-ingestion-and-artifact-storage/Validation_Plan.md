# Validation Plan

## Acceptance Checks

- Confirm this deliverable is present, testable where applicable, and bounded to the step: One API path that registers a single text source and hands off a typed ingestion request to the worker side via the `job_queue` table (created by STEP-01-02, not modified by this step).
- Confirm this deliverable is present, testable where applicable, and bounded to the step: An object-storage adapter and text-ingestion service that persist the raw artifact plus normalized text for later retrieval.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: `ARTIFACT_STORAGE_ROOT` Config.string added to `apps/worker/src/config.ts` with default `'./.local/artifacts'`.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: Source-storage adapter performs startup validation (exists, writable, root containment) and fails fast with a typed `StorageConfigurationError` if validation fails.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: The file classifier and ingestion job narrow: one supported text format, one happy path, and explicit failure states.
- The step leaves the next dependent step with a stable typed boundary, not a placeholder or undocumented assumption.

## Planned Verification

- Plan an integration test that registers one text file via the API route, inserts a job row into `job_queue`, and verifies the worker picks it up, stores the artifact, and creates the `SourceVersion`.
- Plan a failure-path test for unsupported file type (`.exe`), unreadable content, and storage write failure — each must produce a typed error and a `failed` job row.
- Plan a dedupe test: re-ingesting the same file content produces a new `SourceVersion` (immutable per DEC-0006), not an update to the existing one.
- Planned command once these packages exist: `bun test packages/ingestion packages/source-storage` plus the nearest package-level `bun run typecheck`.
- Planned app/integration coverage once the app surfaces exist: `bun test apps/api apps/worker` for the API/worker/web path touched here.

## Edge Cases

- A second ingest of the same file should not create conflicting mutable state; decide whether dedupe or a new source version wins.
- Storage failure after metadata persistence must leave the run retryable and observable instead of half-complete.
- Normalized text must retain a durable pointer back to the original artifact for later citation work.

## Regression Expectations

- This step should remain a clean successor to [[02_Phases/Phase_01_walking_skeleton/Steps/Step_02_define-core-domain-schemas-and-persistence-migrations|STEP-01-02 Define Core Domain Schemas and Persistence Migrations]] rather than reworking already-planned scope upstream.
- Do not break the planned monorepo boundaries between apps and reusable packages.
- Do not bypass deterministic retrieval or provenance rules just to make the first demo easier.
- Keep the walking skeleton small enough that the next phase can iterate on a real slice instead of replacing throwaway code.

## Security / Observability / Evaluation Focus

- Preserve workspace scoping, typed failures, and source-version lineage even in the first runnable slice.
- Make progress streaming and citation rendering observable and restart-aware from day one.
- Do not introduce hidden model loops or ad-hoc filesystem access in the name of speed.

## Related Notes

- Step: [[02_Phases/Phase_01_walking_skeleton/Steps/Step_03_implement-single-text-source-ingestion-and-artifact-storage|STEP-01-03 Implement Single Text Source Ingestion and Artifact Storage]]
- Phase: [[02_Phases/Phase_01_walking_skeleton/Phase|Phase 01 walking skeleton]]
