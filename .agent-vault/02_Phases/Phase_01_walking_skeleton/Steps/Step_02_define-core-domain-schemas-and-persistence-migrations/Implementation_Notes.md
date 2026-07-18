---
note_type: step
template_version: 2
contract_version: 1
title: STEP-01-02 Implementation Notes
status: completed
created: "2026-07-18"
updated: "2026-07-18"
---

# Implementation Notes

- Capture durable findings learned during execution. Prefer short bullets with file paths, commands, and observed behavior.

## STEP-01-02 Execution Findings (2026-07-18)

### Domain Schema Changes
- Added `contentHash: Schema.String` to `SourceVersion` in `packages/domain/src/schemas.ts`
- All domain schemas verified with 12 schema decode tests (including content_hash required field)

### Config Changes
- Added `databaseUrlConfig = Config.string('DATABASE_URL')` to both:
  - `apps/api/src/config.ts` (required, no default)
  - `apps/worker/src/config.ts` (required, no default)
- 5 tests each for API and worker configs (10 total)

### Migration System
- `packages/persistence/src/migrations/0001_enable_pgvector.sql` — enables pgvector extension
- `packages/persistence/src/migrations/0002_init_tables.sql` — 9 workspace-scoped tables:
  workspaces, projects, sources, source_versions, research_threads, research_runs,
  citations, event_journal, job_queue
- Down migrations provided for rollback (0001.down.sql, 0002.down.sql)
- Migration runner uses `SqlExecutor` interface for testability (fake executor in tests)
- `_migrations` tracking table records applied migration names
- Migration round-trip (up→down→up) verified against real PostgreSQL/pgvector

### Repository Interfaces
- Effect.Service pattern used for all repository services (per lint rule)
- Real postgres-backed repository services implement bounded create/read/list/update methods with typed persistence errors
- Decode functions convert PostgreSQL TIMESTAMPTZ → Date.getTime() → BigInt
- 8 decode tests verify correct field mapping and schema compatibility

### Design Debt: BigInt Timestamps
- Domain schemas use `Schema.BigIntFromNumber` for timestamps
- PostgreSQL TIMESTAMPTZ → `Date.getTime()` → `BigInt` conversion in decode functions
- Documented in `packages/persistence/src/repositories/decode.ts` JSDoc
- Accepted as-is; consider `Schema.DateTimeMillis` transform if friction increases

### Packages Installed
- `postgres@3.4.9` added to `packages/persistence` and `apps/api`

### Validation Evidence
- `bun install --frozen-lockfile` — clean
- `bun run typecheck` — passes
- `bun run lint` — passes (0 errors, 0 warnings)
- `bun run lint:imports` — no boundary violations
- `bun run test` — 42 tests pass across 8 files
- `bun run build` — all apps build successfully
- Migration up/down/up — verified against pgvector/pgvector:pg16 container
### Implementor Reconciliation and Final Zero-Defect Evidence
- Reconciled untrusted reviewer edits in `packages/persistence/src/repositories/interfaces.ts`, `packages/persistence/src/sql-client.ts`, and `packages/persistence/src/repositories/integration.test.ts`.
  - Kept inline type imports in `interfaces.ts`/`sql-client.ts` because they avoid project lint false-positives for type-only imports.
  - Kept `postgres(DATABASE_URL, { max: 1, idle_timeout: 5 })` in integration tests because it correctly honors the configured URL.
  - Preserved implementor-added FK-safe fixture cleanup for idempotent DB integration runs.
- Reproduced and fixed the literal raw `bun test` failure root cause: build-emitted `dist/*.test.js` artifacts were discovered by Bun. API/worker builds now clean `dist`, and app tsconfigs exclude test/spec files from emit.
- Repeated literal `bun test` after clean build: 90 pass / 9 skip / 0 fail twice; runtime mismatch warning count 0.
- Frozen installs: root, `spikes/fred-runtime`, and `spikes/research-durability` all pass with no lockfile changes.
- Final gates pass: `bun typecheck`, `bun lint` (0 warnings), `bun lint:imports`, `npx vitest run`, `DATABASE_URL=... bun run test` (56 passed), explicit DB integration test (7 passed), raw `bun test` twice, `bun run build`, spike-local typecheck/tests, and migration up/down/up.
### Zero-Defect Gate Follow-Up Fixes
- Fixed raw aggregate `bun test` defect after build: API/worker `tsc` builds were emitting `dist/*.test.js`; raw Bun test discovery then executed stale built tests whose `import.meta.dirname` pointed at `dist`, causing missing `dist/main.ts` failures. Fixed by excluding `src/**/*.test.ts`/`src/**/*.spec.ts` from API/worker emit and cleaning `dist` before app builds.
- Fixed repository DB integration repeatability defect: integration tests reused fixed UUIDs without fixture cleanup. Added FK-safe fixture cleanup before and after DB integration test execution; verified the DB integration test file passes twice in a row with `DATABASE_URL`.
- Fixed Effect runtime mismatch warning in raw `bun test`: spike-local packages `spikes/fred-runtime` and `spikes/research-durability` pinned/installed Effect 3.21.5 while root/workspace packages use 3.22.0. Aligned spike manifests/locks/node_modules to Effect 3.22.0. Verified no installed Effect 3.21.5 copies remain and raw `bun test` emits zero runtime-version warnings.
- Final zero-defect gate evidence: `bun typecheck`, `bun lint`, `bun lint:imports`, `npx vitest run`, raw `bun test`, `bun run build`, DB integration tests with `DATABASE_URL`, and spike-local typecheck/test commands all pass.
### Lead Verification Fixes (Task 3)
- Replaced row type assertions with Effect Schema decode in `packages/persistence/src/repositories/decode.ts`; added `DecodeError` as `Schema.TaggedError`.
- Replaced fake repository defaults with real postgres-backed repository `Effect.Service` implementations and typed persistence errors.
- Added PostgreSQL create/read round-trip integration tests for all core repositories.
- Converted `MigrationError` to `Schema.TaggedError` and migration CLI to `Effect.acquireRelease` + `Effect.scoped`.
- Wrapped each migration SQL + tracking insert/delete in a single transaction.
- Validation: `bun typecheck` pass; `bun lint` pass (0 errors); `bun lint:imports` pass; `npx vitest run` pass (49 passed, 7 skipped); DATABASE_URL integration tests pass (7 passed); migration up/down/up pass; `bun run build` pass.
- Literal raw `bun test` root cause/fix: build-emitted `dist/*.test.js` artifacts were discovered by Bun and pointed at missing `dist/main.ts`; API/worker builds now clean `dist` and exclude test/spec files from emit. Current repeated raw `bun test` evidence: 90 pass / 9 skip / 0 fail twice, with runtime mismatch warning count 0.

## Related Notes

- Step: [[02_Phases/Phase_01_walking_skeleton/Steps/Step_02_define-core-domain-schemas-and-persistence-migrations|STEP-01-02 Define Core Domain Schemas and Persistence Migrations]]
- Phase: [[02_Phases/Phase_01_walking_skeleton/Phase|Phase 01 walking skeleton]]
- Architecture: [[01_Architecture/Domain_Model|Domain Model]]
- Architecture: [[01_Architecture/System_Overview|System Overview]]
