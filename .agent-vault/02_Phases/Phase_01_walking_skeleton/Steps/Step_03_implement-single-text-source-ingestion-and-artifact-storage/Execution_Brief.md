# Execution Brief

## Exact Outcome

- Implement and verify a single, restart-tolerant plain-text ingestion path: the API registers one `.txt`/`.md` source, enqueues a durable `job_queue` ingestion job, the worker claims the job, stores raw and normalized content-addressed artifacts under `ARTIFACT_STORAGE_ROOT`, creates one immutable `SourceVersion` with a stable content hash, records sanitized ingestion events, and leaves the system ready for STEP-01-04 retrieval work without adding broad document/directory parsing.

## Prerequisites

- Re-read [[02_Phases/Phase_01_walking_skeleton/Phase|Phase 01 walking skeleton]] and confirm the step still matches the current roadmap sequence.
- Confirm the handoff from [[02_Phases/Phase_01_walking_skeleton/Steps/Step_02_define-core-domain-schemas-and-persistence-migrations|STEP-01-02 Define Core Domain Schemas and Persistence Migrations]] before widening scope: STEP-01-02 implemented `source_versions(id, source_id, version, artifact_ref, content_hash, created_at)`, `event_journal`, `job_queue`, typed row decoders, and postgres-backed repositories for Workspace/Project/Source/SourceVersion/ResearchThread/ResearchRun/Citation.
- Keep deterministic work in typed Effect services, repositories, and tools; reserve Fred for agentic orchestration only.
- Enforce the zero-defect gate before implementation: if any confirmed code/test/build/security/docs/vault defect is found, fix and validate it before advancing this step.
- Treat the listed files as planned starting points; create only the smallest set needed to land the slice.

## Planned Starting Files

- These paths may not exist yet; use them as the first bounded implementation or design surface.
- `apps/api/src/routes/sources.ts`
- `apps/api/src/config.ts` and `apps/api/package.json` if upload staging reads `ARTIFACT_STORAGE_ROOT` or imports `@struct/source-storage`.
- `apps/worker/src/config.ts`, `apps/worker/src/main.ts`, `apps/worker/src/jobs/ingest-source.ts`, and `apps/worker/package.json` (`@struct/persistence`, `postgres`, `@struct/source-storage`, and `@struct/ingestion` will be needed once worker polling is real).
- `packages/source-storage/package.json`, `packages/source-storage/tsconfig.json`, `packages/source-storage/src/object-store.ts`, and focused storage tests.
- `packages/ingestion/package.json`, `packages/ingestion/tsconfig.json`, `packages/ingestion/src/ingest-text-source.ts`, `packages/ingestion/src/file-classifier.ts`, and focused ingestion tests.
- `packages/persistence/src/repositories/` for typed `job_queue` and `event_journal` repositories against the existing STEP-01-02 tables. Do not add or edit migrations unless implementation proves the current schema cannot meet this step; if that happens, record a blocker before changing scope.
- `packages/domain/src/schemas.ts` and `packages/domain/src/typed-errors.ts` only for canonical request/job/artifact/event schemas and specific typed errors needed by the new services (for example `StorageConfigurationError`, `StorageWriteError`, `UnsupportedSourceTypeError`, `JobClaimError`).
- Root `package.json`, package manifests, `.env.example`, and TypeScript references/scripts if new packages are scaffolded; root `bun run typecheck` must include the new packages or they are not covered by the gate.

## Required Reading

- [[02_Phases/Phase_01_walking_skeleton/Phase|Phase 01 walking skeleton]]
- [[01_Architecture/System_Overview|System Overview]]
- [[01_Architecture/Code_Map|Code Map]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
- [[02_Phases/Phase_01_walking_skeleton/Steps/Step_02_define-core-domain-schemas-and-persistence-migrations|STEP-01-02 Define Core Domain Schemas and Persistence Migrations]]
- `docs/architecture.md` §6.2 (artifact storage), §8 (ingestion architecture)
- `docs/local-development.md` §3.2 (ARTIFACT_STORAGE_ROOT env var)
- DEC-0006: SourceVersion is immutable; refresh creates a new version.
- DEC-0009: Sandbox filesystem roots; registered roots only.
- `docs/product-brief.md` sections 6-8, 10, 13, 17-19, 23, 26-27, and 29-31.

## Concrete Deliverables

- Add one API path that registers a single text source and hands off a typed ingestion request to the worker side.
- Define an object-storage adapter and text-ingestion service that persist the raw artifact plus normalized text for later retrieval.
- Keep the file classifier and ingestion job narrow: one supported text format, one happy path, and explicit failure states.

## Concrete Context from Architecture and Decisions

### New packages to scaffold (deferred from STEP-01-01 per repository-contract.md §3.2)

- `packages/source-storage/` — artifact storage adapter (local FS adapter for dev; S3-compatible for production)
- `packages/ingestion/` — source classification, manifest creation, extraction routing

### Ingestion flow (architecture.md §8.1, narrowed for walking slice)

1. API receives source registration command (one bounded text upload or pre-staged artifact ref under the configured artifact root; no arbitrary host path input).
2. API validates workspace/project ownership using the existing Project/Source repositories. Until production auth lands, the walking-slice request must carry explicit `workspaceId` and `projectId`; the API must reject mismatches instead of trusting client-provided scope.
3. API creates the logical `Source` record only. Do **not** create a pending `SourceVersion`: the current STEP-01-02 schema has no source-version status and requires non-null `artifact_ref` and `content_hash`, so a `SourceVersion` is created only after artifacts and hashes exist.
4. API dispatches an ingestion job to the worker via the **`job_queue` table** (created by STEP-01-02 in `0002_init_tables.sql`). Insert a job row with `entity_type='ingestion'`, `entity_id=<sourceId>`, `status='pending'`, and a bounded JSON payload containing the request metadata and staged upload reference. The payload must not contain source text, secrets, or unsanitized absolute host paths.
5. Worker polls this table on a fixed interval using `Config.number('WORKER_POLL_INTERVAL_MS')` with default `1000` and claims jobs atomically (see job lifecycle below).
6. Worker reads only the staged upload/artifact reference produced by the API or test fixture; it must not accept arbitrary host paths or model-proposed paths.
7. Worker stores the raw artifact via the `source-storage` adapter, normalizes text, and stores normalized content as a second content-addressed artifact.
8. Worker creates an immutable `SourceVersion` with `artifact_ref` pointing to a source-version manifest artifact that references both raw and normalized artifact refs, and `content_hash` set to the canonical `sha256:<64 lowercase hex>` of the normalized text bytes.
9. Worker emits sanitized ingestion events to the `event_journal` table.
10. Worker updates the job row to terminal `completed` or `failed`; because `source_versions` has no status column, completion/failure state for this slice lives in `job_queue` plus `event_journal`.

**Job queue ownership**: The `job_queue` table is created by STEP-01-02 (migration) and consumed by STEP-01-03 (worker polling). STEP-01-03 does NOT modify migrations; it only implements the worker polling logic.

### Artifact storage details (architecture.md §6.2, docs/local-development.md §3.2)

- Dev adapter: local filesystem under `ARTIFACT_STORAGE_ROOT` (default: `./.local/artifacts`)
- Content-addressed: store by hash (e.g., SHA-256) to deduplicate
- Two artifacts per source version: raw original + normalized text
- The adapter interface is in `packages/source-storage`; apps/worker writes finalized content-addressed objects. If the API must stage uploads for worker handoff, it may use only a bounded staging method from `packages/source-storage` under `ARTIFACT_STORAGE_ROOT`; the API must not run ingestion/normalization or write final SourceVersion artifacts.

### File classifier scope (walking-slice minimum)

- Support: `.txt` and `.md` files only (plain text)
- Classify as `document` kind
- Reject binary/unknown types with a typed `ValidationError`
- No PDF/Office parsing (deferred to Phase 02)

### Event journal events (architecture.md §7.2, narrowed)

- `ingestion-requested` — emitted by API when dispatching job
- `file-processed` — emitted by worker after successful normalization
- `ingestion-completed` — emitted by worker when source version is finalized
- `ingestion-failed` — emitted by worker on failure

### Security constraints (DEC-0009, architecture.md §3.2)

- No ad-hoc filesystem access; only staged upload/artifact refs under `ARTIFACT_STORAGE_ROOT` are allowed in this walking slice. Registered directory roots remain Phase 03 scope.
- Worker must not read arbitrary host paths; only the uploaded/staged artifact reference created by the API/test fixture.
- Source content is untrusted evidence (architecture.md §1). Never feed source text into logs, event payloads, config errors, or future model/system prompts.
- File uploads via API must validate extension and media type against the allowed list (`.txt`, `.md`, `text/plain`, `text/markdown`) before staging bytes.
- Add a walking-slice byte cap (for example `MAX_TEXT_SOURCE_BYTES` defaulting to `1048576`) and reject larger uploads with a typed validation error. Do not leave uploads unbounded.
- Sanitize errors: expose typed error tags and stable IDs/hashes only; do not expose `DATABASE_URL`, absolute host paths, stack traces, or raw source snippets.

### ARTIFACT_STORAGE_ROOT configuration (worker config + adapter startup checks)

Add to `apps/worker/src/config.ts`:
```typescript
export const artifactStorageRootConfig = Config.string('ARTIFACT_STORAGE_ROOT').pipe(
  Config.withDefault('./.local/artifacts')
)
```

The `source-storage` adapter must perform startup validation when instantiated:
1. **Exists**: Verify the directory exists (create if missing via `fs.mkdir(root, { recursive: true })`).
2. **Writable**: Verify write permissions (attempt a test write of a zero-byte file, then delete).
3. **Canonical root**: Resolve and retain the canonical storage root. Reject a storage root that resolves outside the project-local configured root policy, and reject unsafe symlink roots unless explicitly justified in a decision note.
4. **Root containment**: All read/write/delete operations must resolve candidate paths and verify they stay within the canonical root; reject `../`, absolute-path injection, encoded traversal, NUL bytes, and mixed separators.
5. **Symlink safety**: Do not follow user-controlled symlinks for staged uploads or object paths. Use `lstat`/`realpath` checks where paths can pre-exist.
6. **Atomic content-addressed writes**: Compute SHA-256 before finalization; write to a temporary file under the same root, verify bytes/hash, then `rename` into the final content-addressed path. If the target already exists, verify it matches and return the existing ref. Never expose partial temp files as artifact refs.

Example adapter startup validation:
```typescript
const validateStorageRoot = Effect.fn('ArtifactStorage.validateRoot')(function* (root: string) {
  yield* Effect.tryPromise(() => fs.mkdir(root, { recursive: true }))
  const testPath = path.join(root, `.write-test-${Date.now()}`)
  yield* Effect.tryPromise(() => fs.writeFile(testPath, ''))
  yield* Effect.tryPromise(() => fs.unlink(testPath))
  return root
})
```

If validation fails, the adapter must fail fast with a typed `StorageConfigurationError` (add to `packages/domain/src/typed-errors.ts`).

### Current schema constraints from STEP-01-02

- Existing migrations are `packages/persistence/src/migrations/0001_enable_pgvector.sql` and `0002_init_tables.sql`; `apps/api` is the only migration executor (`bun run migrations:up` / `bun run migrations:down`). STEP-01-03 consumes these tables and should not run migrations from `apps/worker`.
- `source_versions` is immutable and currently has no status column. Create it only after raw + normalized artifact refs and `contentHash` are known.
- `job_queue` columns available now: `id`, `workspace_id`, `entity_type`, `entity_id`, `status`, `payload`, `attempts`, `max_attempts`, `created_at`, `updated_at`. There is no `locked_at`, `locked_by`, `run_after`, or `last_error`; implement claim/retry/failure ownership with these existing columns and sanitized `event_journal` entries.
- `event_journal` columns available now: `id`, `workspace_id`, `entity_type`, `entity_id`, `event_type`, `payload`, `cursor`, `created_at`. Event payloads must stay small and sanitized.
- Existing repositories cover Workspace/Project/Source/SourceVersion/ResearchThread/ResearchRun/Citation only. This step should add typed JobQueue/EventJournal accessors or equivalent persistence services before API/worker code emits raw SQL ad hoc.

### Job lifecycle and retry ownership

- API owns enqueue: create Source, insert `job_queue` pending row, append `ingestion-requested` event in the same failure-aware command path. If event append fails after job insert, surface a typed failure; do not claim user-visible success without a durable event.
- Worker owns claim: atomically claim one pending ingestion job with a single SQL statement using `FOR UPDATE SKIP LOCKED`, set `status='in-progress'`, increment `attempts`, and update `updated_at`. Never process jobs selected by a non-locking read.
- Worker owns stale recovery: on startup and before each poll, requeue `in-progress` ingestion jobs whose `updated_at` is older than `WORKER_JOB_STALE_MS` and `attempts < max_attempts`; mark stale jobs `failed` when attempts are exhausted and append `ingestion-failed`.
- Worker owns terminal commit: after artifact writes and SourceVersion creation succeed, append `file-processed` and `ingestion-completed`, then set job `completed`. On failure, append sanitized `ingestion-failed`; set job back to `pending` only if attempts remain and the error is retryable, otherwise set `failed`.
- Retryability is fail-closed and typed: only declared retryable failures or known transient persistence, storage I/O, and indexing failures may return to `pending`. Validation, authorization, path/ref, unsupported input, schema/hash/integrity/conflict, and unknown failures become `failed` on the current attempt.
- The bounded failure event includes authoritative `jobId` and `attempt`, an alphanumeric error tag, the fixed message `Ingestion failed`, and a boolean `retryable`. Persistence rejects `pending` with `retryable: false`, `pending` without budget, and `failed` with `retryable: true` while budget remains.
- Idempotency: if a retry sees already-written content-addressed artifacts, verify hashes and reuse them; if it sees an existing SourceVersion for the same Source/version/content, do not mutate it. Prefer a new immutable version for a new accepted ingest, and rely on `UNIQUE(source_id, version)` plus bounded retry if two workers race.

### API and worker startup validation

- API startup remains latency-oriented; it may validate Config values, DB connection, and storage staging root if the API stages uploads, but it must not run ingestion work inline.
- Worker startup must validate `DATABASE_URL`, `ARTIFACT_STORAGE_ROOT`, `WORKER_POLL_INTERVAL_MS`, `WORKER_JOB_STALE_MS`, storage writability/containment, and repository layers before logging ready.
- Config must use `Effect Config.*`; do not read `process.env` directly in services. App entrypoints may translate boot failures to a nonzero process exit.

## Constraints and Non-Goals

- Optimize for a thin, end-to-end slice rather than broad but unexecutable scaffolding.
- Keep domain and infrastructure seams typed at the boundary and avoid leaking product behavior into Fred core.
- Each change should leave one user path closer to runnable with persistence, streaming, and citations all visible.

## Related Notes

- Step: [[02_Phases/Phase_01_walking_skeleton/Steps/Step_03_implement-single-text-source-ingestion-and-artifact-storage|STEP-01-03 Implement Single Text Source Ingestion and Artifact Storage]]
- Phase: [[02_Phases/Phase_01_walking_skeleton/Phase|Phase 01 walking skeleton]]
