# Execution Brief

## Exact Outcome

- Produce the concrete contracts, artifacts, and bounded implementation/design surfaces for Resumable Idempotent Ingestion Jobs that this step is responsible for before any broader follow-on work begins.

## Prerequisites

- Re-read [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Phase|Phase 03 durable directory ingestion and source refresh]] and confirm the step still matches the current roadmap sequence.
- Confirm the handoff from [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_02_implement-sandboxed-recursive-discovery-and-hashing|STEP-03-02 Implement Sandboxed Recursive Discovery and Hashing]] before widening scope.
- Keep deterministic work in typed Effect services, repositories, and tools; reserve Fred for agentic orchestration only.
- Treat the listed files as planned starting points; create only the smallest set needed to land the slice.

## Planned Starting Files

- These paths may not exist yet; use them as the first bounded implementation or design surface.
- `apps/worker/src/jobs/ingest-directory.ts`
- `packages/domain/src/ingestion-job.ts`
- `packages/ingestion/src/job-state.ts`
- `packages/persistence/src/repositories/ingestion-jobs.ts`
- `packages/persistence/src/repositories/idempotency-keys.ts`

## Required Reading

- [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Phase|Phase 03 durable directory ingestion and source refresh]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[01_Architecture/System_Overview|System Overview]]
- [[01_Architecture/Code_Map|Code Map]]
- [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_02_implement-sandboxed-recursive-discovery-and-hashing|STEP-03-02 Implement Sandboxed Recursive Discovery and Hashing]]
- `docs/product-brief.md` sections 10, 18-19, 21-25, 26-27, and 29-31.

## Concrete Deliverables

- Implement the narrowest typed slice for Resumable Idempotent Ingestion Jobs that is callable by the next step without broadening scope.
- Define or update typed domain modules for `Ingestion Job` in `packages/domain/src/ingestion-job.ts`.
- Add repository boundaries in `packages/persistence/src/repositories/ingestion-jobs.ts`, `packages/persistence/src/repositories/idempotency-keys.ts` that translate between storage records and typed domain objects.
- Use `packages/ingestion/src/job-state.ts` to make discovery, classification, refresh, or job state deterministic before any model-dependent behavior is introduced.
- Extend the existing PostgreSQL job journal with directory-refresh state, leases, attempt budgets, per-entry checkpoints, and idempotency keys; do not add another queue or database.
- Persist progress before acknowledgement so a Bun worker restart resumes from the last committed checkpoint and duplicate delivery cannot duplicate committed work.
- Model pause, resume, retry, cancel, exhausted, and terminal completion as validated transitions with typed Effect errors.

## Smallest Bounded Checklist

- First, implement the narrowest typed slice for Resumable Idempotent Ingestion Jobs that is callable by the next step without broadening scope.
- Then, define or update typed domain modules for `Ingestion Job` in `packages/domain/src/ingestion-job.ts`.
- Next, add repository boundaries in `packages/persistence/src/repositories/ingestion-jobs.ts`, `packages/persistence/src/repositories/idempotency-keys.ts` that translate between storage records and typed domain objects.
- Finish by leaving one observable typed path—test, route, worker flow, or UI state—that proves the slice is ready for the next dependent step.

## Constraints and Non-Goals

- Directory work must begin from manifests, hashing, and deterministic classification before any expensive downstream processing.
- Support partial success, resume, and refresh as first-class workflow behaviors rather than bolted-on retries.
- Never widen filesystem access beyond registered roots and explicit sandbox rules.

## Related Notes

- Step: [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_03_build-resumable-idempotent-ingestion-jobs|STEP-03-03 Build Resumable Idempotent Ingestion Jobs]]
- Phase: [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Phase|Phase 03 durable directory ingestion and source refresh]]
