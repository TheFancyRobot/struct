# Execution Brief

## Exact Outcome

- Produce the concrete contracts, artifacts, and bounded implementation/design surfaces for Single Text Source Ingestion and Artifact Storage that this step is responsible for before any broader follow-on work begins.

## Prerequisites

- Re-read [[02_Phases/Phase_01_walking_skeleton/Phase|Phase 01 walking skeleton]] and confirm the step still matches the current roadmap sequence.
- Confirm the handoff from [[02_Phases/Phase_01_walking_skeleton/Steps/Step_02_define-core-domain-schemas-and-persistence-migrations|STEP-01-02 Define Core Domain Schemas and Persistence Migrations]] before widening scope.
- Keep deterministic work in typed Effect services, repositories, and tools; reserve Fred for agentic orchestration only.
- Treat the listed files as planned starting points; create only the smallest set needed to land the slice.

## Planned Starting Files

- These paths may not exist yet; use them as the first bounded implementation or design surface.
- `apps/api/src/routes/sources.ts`
- `apps/worker/src/jobs/ingest-source.ts`
- `packages/source-storage/src/object-store.ts`
- `packages/ingestion/src/ingest-text-source.ts`
- `packages/ingestion/src/file-classifier.ts`

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

1. API receives source registration command (one text file upload or path)
2. API validates workspace ownership and creates a pending `SourceVersion` record
3. API dispatches an ingestion job to the worker via the **`job_queue` table** (created by STEP-01-02 in `0002_init_tables.sql`). The API inserts a job row with `entity_type='ingestion'`, `entity_id=<sourceVersionId>`, `status='pending'`. The worker polls this table on a fixed interval (configurable via `Config.number('WORKER_POLL_INTERVAL_MS')` with default 1000).
4. Worker reads the text file, stores the raw artifact via `source-storage` adapter
5. Worker normalizes text and stores normalized content as a content-addressed artifact
6. Worker creates an immutable `SourceVersion` with `artifact_ref` and `content_hash`
7. Worker emits ingestion events to the `event_journal` table
8. Worker marks the source version `completed` (or `failed`) and updates the job row to `status='completed'` (or `'failed'`)

**Job queue ownership**: The `job_queue` table is created by STEP-01-02 (migration) and consumed by STEP-01-03 (worker polling). STEP-01-03 does NOT modify migrations; it only implements the worker polling logic.

### Artifact storage details (architecture.md §6.2, docs/local-development.md §3.2)

- Dev adapter: local filesystem under `ARTIFACT_STORAGE_ROOT` (default: `./.local/artifacts`)
- Content-addressed: store by hash (e.g., SHA-256) to deduplicate
- Two artifacts per source version: raw original + normalized text
- The adapter interface is in `packages/source-storage`; apps/worker writes, apps/api reads refs

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

- No ad-hoc filesystem access; only registered roots may be traversed
- Worker must not read arbitrary host paths; only the uploaded/staged artifact
- Source content is untrusted evidence (architecture.md §1)
- File uploads via API must validate content-type against the allowed list (`.txt`, `.md`) before writing to disk

### ARTIFACT_STORAGE_ROOT configuration (worker config + adapter startup checks)

Add to `apps/worker/src/config.ts`:
```typescript
export const artifactStorageRootConfig = Config.string('ARTIFACT_STORAGE_ROOT').pipe(
  Config.withDefault('./.local/artifacts')
)
```

The `source-storage` adapter must perform startup validation when instantiated:
1. **Exists**: Verify the directory exists (create if missing via `fs.mkdirSync(root, { recursive: true })`).
2. **Writable**: Verify write permissions (attempt a test write of a zero-byte file, then delete).
3. **Root containment**: All write operations must validate the target path is within the configured root (reject `../` traversal).

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

## Constraints and Non-Goals

- Optimize for a thin, end-to-end slice rather than broad but unexecutable scaffolding.
- Keep domain and infrastructure seams typed at the boundary and avoid leaking product behavior into Fred core.
- Each change should leave one user path closer to runnable with persistence, streaming, and citations all visible.

## Related Notes

- Step: [[02_Phases/Phase_01_walking_skeleton/Steps/Step_03_implement-single-text-source-ingestion-and-artifact-storage|STEP-01-03 Implement Single Text Source Ingestion and Artifact Storage]]
- Phase: [[02_Phases/Phase_01_walking_skeleton/Phase|Phase 01 walking skeleton]]
