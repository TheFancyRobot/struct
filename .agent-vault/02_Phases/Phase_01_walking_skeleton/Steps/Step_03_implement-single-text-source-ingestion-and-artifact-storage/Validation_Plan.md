# Validation Plan

## Acceptance Checks

- Confirm this deliverable is present, testable, and bounded to the step: one API path registers a single `.txt`/`.md` source, verifies project/workspace ownership, stages or references the upload without arbitrary path access, inserts a `job_queue` row with `entity_type='ingestion'`, `entity_id=<sourceId>`, `status='pending'`, and appends an `ingestion-requested` event.
- Confirm this deliverable is present, testable, and bounded to the step: worker polling claims ingestion jobs atomically from the existing `job_queue` schema, increments attempts, handles stale in-progress rows, retries only while attempts remain, and records terminal `completed`/`failed` state without relying on non-existent migration columns.
- Confirm this deliverable is present, testable, and bounded to the step: an object-storage adapter and text-ingestion service persist both raw and normalized text as content-addressed artifacts; `SourceVersion.artifactRef` points to a manifest artifact that references both, and `SourceVersion.contentHash` is a deterministic `sha256:<64 lowercase hex>` of normalized bytes.
- Confirm this deliverable is present, testable, and bounded to the step: `ARTIFACT_STORAGE_ROOT` Config.string is added where consumed (worker and API if API stages uploads) with default `'./.local/artifacts'`; worker also has positive-number config for `WORKER_POLL_INTERVAL_MS` (default `1000`) and `WORKER_JOB_STALE_MS` (default `300000`).
- Confirm this deliverable is present, testable, and bounded to the step: source-storage adapter performs startup validation (exists/create, writable, canonical root, root containment, symlink safety) and fails fast with typed `StorageConfigurationError` if validation fails.
- Confirm this deliverable is present, testable, and bounded to the step: content-addressed writes are atomic (`tmp` under same root, verify, rename), dedupe verifies existing hashes, and partial temp files are not returned as artifact refs.
- Confirm this deliverable is present, testable, and bounded to the step: the file classifier and ingestion job remain narrow (`.txt` and `.md` only), with explicit typed failures for unsupported type, over byte cap, unreadable/stale staged ref, storage write failure, DB failure, and exhausted retries.
- Confirm new packages are included in package manifests and root gates: root `bun run typecheck` must cover `packages/source-storage` and `packages/ingestion`, and dependency-boundary checks must still prevent API/worker/package cross-import violations.
- The step leaves STEP-01-04 with a stable typed boundary for retrieval: SourceVersion id, contentHash, source-version manifest artifact ref, normalized text artifact ref, event cursors, and job terminal state are documented and tested.

## Planned Verification

- Unit tests:
  - `packages/source-storage`: startup validation, root containment, traversal/NUL/absolute-path rejection, symlink rejection, atomic write temp cleanup, existing-object hash verification, write failure -> typed error.
  - `packages/ingestion`: `.txt`/`.md` classification, unsupported extension/media type rejection, normalization determinism, content hash determinism, no source text in error messages/events.
  - `packages/persistence`: JobQueue/EventJournal repository claim/retry/status SQL with mocked SQL plus decode tests for job/event rows if schemas are added.
- App tests:
  - API route creates Source, job_queue pending row, and `ingestion-requested`; rejects workspace/project mismatch and unsupported/oversized upload before enqueue.
  - Worker job loop claims exactly one pending job atomically, ignores already-claimed jobs, requeues stale in-progress jobs with attempts remaining, and final-fails exhausted jobs.
- Real DB integration test: with PostgreSQL + migrations applied, register one text file via the API/service boundary, run one worker poll/claim cycle, verify raw + normalized artifacts exist, `SourceVersion` exists with immutable contentHash/manifest ref, event_journal contains `ingestion-requested`, `file-processed`, `ingestion-completed`, and job_queue is `completed`.
- Failure-path DB integration tests: unsupported file type (`.exe`), unreadable/missing staged ref, storage write failure, and invalid workspace/project scope each produce a typed error, sanitized `ingestion-failed` where a job exists, and a correct `failed` or non-enqueued job state.
- Dedupe/versioning test: re-ingesting identical content creates a new immutable `SourceVersion` version number for a new accepted ingest while artifact storage reuses verified content-addressed objects; no existing SourceVersion row is updated.
- Restart/retry test: simulate worker crash after claim by leaving a job `in-progress`; after `WORKER_JOB_STALE_MS`, the next worker poll requeues or final-fails according to attempts and emits sanitized recovery/failure events.
- Planned package commands once packages exist:
  - `bun run --filter @struct/source-storage typecheck && bun run --filter @struct/source-storage test`
  - `bun run --filter @struct/ingestion typecheck && bun run --filter @struct/ingestion test`
  - `bun run --filter @struct/persistence test`
  - `bun run --filter @struct/api test && bun run --filter @struct/worker test`
- Planned root gates before completion: `bun install --frozen-lockfile`, `bun run typecheck`, `bun run lint`, `bun run lint:imports`, `npx vitest run`, raw `bun test`, and `bun run build`.
- Real DB setup/commands for integration evidence:
  - `docker compose up -d postgres`
  - `DATABASE_URL=postgres://struct:struct@localhost:5432/struct bun run migrations:up`
  - `DATABASE_URL=postgres://struct:struct@localhost:5432/struct bun run test`
  - migration smoke remains owned by apps/api: `DATABASE_URL=postgres://struct:struct@localhost:5432/struct bun run migrations:down && DATABASE_URL=postgres://struct:struct@localhost:5432/struct bun run migrations:up`

## Edge Cases

- A second accepted ingest of the same file creates a new immutable SourceVersion version number; artifact storage may dedupe identical bytes but must verify hashes and never mutate older versions.
- Storage failure after Source creation/job enqueue must leave the job retryable or failed with sanitized event_journal evidence; no half-created SourceVersion is allowed.
- Normalized text must retain a durable pointer back to the original artifact through the SourceVersion manifest artifact for later citation work.
- API/job payloads must not contain raw source text, secrets, or unsanitized absolute host paths.
- Worker crash after atomic artifact write but before DB terminal update must be safe to retry: re-run verifies existing artifact hashes and either completes the SourceVersion creation or fails without duplicate mutable side effects.
- Concurrent workers must not process the same job; claim SQL must be locking, not read-then-update.
- Existing `job_queue` lacks `last_error`; failures must be represented by typed/sanitized event_journal payloads and logs rather than schema assumptions.
- Current `source_versions` lacks status; do not assert source-version `pending`/`failed` states in tests unless a migration/blocker is explicitly approved.

## Regression Expectations

- This step should remain a clean successor to [[02_Phases/Phase_01_walking_skeleton/Steps/Step_02_define-core-domain-schemas-and-persistence-migrations|STEP-01-02 Define Core Domain Schemas and Persistence Migrations]] rather than reworking already-planned scope upstream.
- Do not break the planned monorepo boundaries between apps and reusable packages.
- Do not bypass deterministic retrieval or provenance rules just to make the first demo easier.
- Keep the walking skeleton small enough that the next phase can iterate on a real slice instead of replacing throwaway code.

## Security / Observability / Evaluation Focus

- Preserve workspace scoping, typed failures, and source-version lineage even in the first runnable slice.
- Make progress streaming and citation rendering observable and restart-aware from day one by writing journal events before claiming user-visible completion.
- Do not introduce hidden model loops or ad-hoc filesystem access in the name of speed.
- Confirm no raw source content appears in logs, event payloads, API error responses, or test snapshots.
- Confirm artifact refs are stable logical refs/hashes, not raw host paths.
- Confirm new errors follow Effect best practices: `Schema.TaggedError` with specific tags and `message`, handled with `catchTag`/`catchTags` rather than broad `catchAll` remapping.

## Related Notes

- Step: [[02_Phases/Phase_01_walking_skeleton/Steps/Step_03_implement-single-text-source-ingestion-and-artifact-storage|STEP-01-03 Implement Single Text Source Ingestion and Artifact Storage]]
- Phase: [[02_Phases/Phase_01_walking_skeleton/Phase|Phase 01 walking skeleton]]
