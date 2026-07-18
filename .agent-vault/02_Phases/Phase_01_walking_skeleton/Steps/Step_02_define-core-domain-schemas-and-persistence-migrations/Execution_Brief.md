# Execution Brief

## Exact Outcome

- Produce the concrete contracts, artifacts, and bounded implementation/design surfaces for Core Domain Schemas and Persistence Migrations that this step is responsible for before any broader follow-on work begins.

## Prerequisites

- Re-read [[02_Phases/Phase_01_walking_skeleton/Phase|Phase 01 walking skeleton]] and confirm the step still matches the current roadmap sequence.
- Confirm the handoff from [[02_Phases/Phase_01_walking_skeleton/Steps/Step_01_scaffold-monorepo-and-runtime-applications|STEP-01-01 Scaffold Monorepo and Runtime Applications]] before widening scope.
- Keep deterministic work in typed Effect services, repositories, and tools; reserve Fred for agentic orchestration only.
- Treat the listed files as planned starting points; create only the smallest set needed to land the slice.

## Planned Starting Files

- Already-existing files from STEP-01-01 (DO NOT recreate — extend only if needed):
  - `packages/domain/src/branded-ids.ts` — branded UUIDs for all walking-slice entities
  - `packages/domain/src/schemas.ts` — Effect Schemas for Workspace, Project, Source, SourceVersion, ResearchThread, ResearchRun, Citation, Finding, Report
  - `packages/domain/src/typed-errors.ts` — Schema.TaggedError classes
  - `packages/persistence/src/index.ts` — placeholder (add repository exports here)
- New files to create:
  - `packages/persistence/src/migrations/0001_enable_pgvector.sql`
  - `packages/persistence/src/migrations/0002_init_tables.sql`
  - `packages/persistence/src/migrations/runner.ts`
  - `packages/persistence/src/repositories/index.ts`
  - `apps/api/src/migrations/run.ts` (referenced by existing `migrations:up`/`migrations:down` scripts in `apps/api/package.json`)

## Required Reading

- [[02_Phases/Phase_01_walking_skeleton/Phase|Phase 01 walking skeleton]]
- [[01_Architecture/System_Overview|System Overview]]
- [[01_Architecture/Code_Map|Code Map]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
- [[02_Phases/Phase_01_walking_skeleton/Steps/Step_01_scaffold-monorepo-and-runtime-applications|STEP-01-01 Scaffold Monorepo and Runtime Applications]]
- `docs/architecture.md` §6.5 (migration ownership, ordering, rollback)
- `docs/repository-contract.md` §1 (migrations:up/down commands)
- `docs/product-brief.md` sections 6-8, 10, 13, 17-19, 23, 26-27, and 29-31.

## Concrete Deliverables

- Branded IDs and Effect Schemas for `Workspace`, `Source`, `ResearchRun`, and `Citation` already exist from STEP-01-01 in `packages/domain/src/branded-ids.ts` and `packages/domain/src/schemas.ts`. Verify they are sufficient; extend only if the migration requires additional fields (e.g., `content_hash` on `SourceVersion`).
- Write two migrations: `packages/persistence/src/migrations/0001_enable_pgvector.sql` (`CREATE EXTENSION IF NOT EXISTS vector;` per architecture.md §6.5) and `packages/persistence/src/migrations/0002_init_tables.sql` (workspace-scoped tables, immutable version references, foreign keys matching the domain model).
- Build a migration runner in `packages/persistence/src/migrations/runner.ts` that `apps/api` invokes via the existing `migrations:up`/`migrations:down` scripts (`tsx src/migrations/run.ts --direction up|down`).
- Expose repository interfaces that decode database rows back into typed domain records without leaking SQL details into app code.

## Smallest Bounded Checklist

- First, verify the existing branded IDs and Effect Schemas in `packages/domain/src/branded-ids.ts` and `packages/domain/src/schemas.ts` cover all fields needed by the migration (add `content_hash` to `SourceVersion` schema if missing).
- Then, write `packages/persistence/src/migrations/0001_enable_pgvector.sql` and `packages/persistence/src/migrations/0002_init_tables.sql` with workspace-scoped tables, immutable version references, and foreign keys that match the domain model.
- Next, build the migration runner and wire it to the existing `apps/api/src/migrations/run.ts` entrypoint (already referenced by `apps/api/package.json` scripts).
- Then, expose repository interfaces that decode database rows back into typed domain records without leaking SQL details into app code.
- Finish by leaving one observable typed path—test, route, worker flow, or UI state—that proves the slice is ready for the next dependent step.

## Concrete Context from STEP-01-01 Scaffold

### Existing scaffold (from STEP-01-01)

The monorepo scaffold already provides:

- `packages/domain/src/branded-ids.ts` — branded UUIDs for WorkspaceId, ProjectId, SourceId, SourceVersionId, ResearchThreadId, ResearchRunId, CitationId, FindingId, ReportId, DatasetId, DatasetSnapshotId, QueryResultSnapshotId, EventJournalId
- `packages/domain/src/schemas.ts` — Effect Schemas for Workspace, Project, Source, SourceVersion, ResearchThread, ResearchRun, Citation, Finding, Report; enums for SourceKind, IngestionStatus, ResearchStatus, CitationStatus
- `packages/domain/src/typed-errors.ts` — Schema.TaggedError classes: NotFoundError, ValidationError, AuthorizationError, CitationValidationError, SourceVersionError
- `packages/persistence/src/index.ts` — placeholder (empty)
- `packages/observability/src/index.ts` — placeholder (empty)
- `apps/api/src/config.ts` — Effect Config.* for API (apiPortConfig only; **databaseUrlConfig does NOT exist yet** — must be added by this step)
- `apps/worker/src/config.ts` — Effect Config.* for worker (workerMetricsPortConfig only; **databaseUrlConfig does NOT exist yet** — must be added by this step)

**Note**: The config files explicitly state "DATABASE_URL is not part of the walking-skeleton boot path; it will be added in STEP-01-02". This step must add it.

### What this step must ADD (not recreate)

1. **Database config**: Add `databaseUrlConfig` to both `apps/api/src/config.ts` and `apps/worker/src/config.ts`:
   ```typescript
   export const databaseUrlConfig = Config.string('DATABASE_URL')
   ```
   This is required for migration runner and repository connections.

2. **Migration runner**: `packages/persistence/src/migrations/` with:
   - `0001_enable_pgvector.sql` — `CREATE EXTENSION IF NOT EXISTS vector;` (must be first; see architecture.md §6.5)
   - `0002_init_tables.sql` — workspace-scoped tables for the walking slice (see table list below)
   - A migration runner that `apps/api` invokes via `bun run migrations:up/down` (sole executor per architecture.md §6.5)

3. **First migration tables** (walking-slice minimum in `0002_init_tables.sql`):
   - `workspaces` (id UUID PK, name TEXT, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ)
   - `projects` (id UUID PK, workspace_id UUID FK→workspaces, name TEXT, created_at, updated_at)
   - `sources` (id UUID PK, project_id UUID FK→projects, name TEXT, kind TEXT CHECK in ('document','dataset','directory','file'), created_at, updated_at)
   - `source_versions` (id UUID PK, source_id UUID FK→sources, version INT, artifact_ref TEXT, content_hash TEXT, created_at) — immutable per DEC-0006
   - `research_threads` (id UUID PK, project_id UUID FK→projects, title TEXT, created_at, updated_at)
   - `research_runs` (id UUID PK, thread_id UUID FK→research_threads, question TEXT, status TEXT CHECK in ('pending','in-progress','completed','failed','cancelled','partial'), created_at, updated_at)
   - `citations` (id UUID PK, run_id UUID FK→research_runs, source_version_id UUID FK→source_versions, locator TEXT, status TEXT CHECK in ('validated','invalid','stale'), created_at)
   - `event_journal` (id UUID PK, workspace_id UUID, entity_type TEXT, entity_id UUID, event_type TEXT, payload JSONB, cursor BIGSERIAL, created_at) — append-only per DEC-0008
   - `job_queue` (id UUID PK, workspace_id UUID, entity_type TEXT, entity_id UUID, status TEXT CHECK in ('pending','in-progress','completed','failed','cancelled'), payload JSONB, attempts INT DEFAULT 0, max_attempts INT DEFAULT 3, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ) — worker job dispatch table

   **Note**: The `job_queue` table is owned by STEP-01-02 (migration) and consumed by STEP-01-03 (worker polling). It must be in the initial migration, not added retroactively.

4. **Repository interfaces**: `packages/persistence/src/repositories/` with typed Effect services:
   - `WorkspaceRepo`, `ProjectRepo`, `SourceRepo`, `SourceVersionRepo`, `ResearchRunRepo`, `CitationRepo`
   - Each returns typed domain records (decoded via Effect Schema), not raw SQL rows
   - Repository interfaces live in `packages/persistence`; SQL connection pool owned by `apps/api`

   **Timestamp decode strategy**: PostgreSQL TIMESTAMPTZ columns return JavaScript `Date` objects. The domain schemas use `Schema.BigIntFromNumber` for timestamps (milliseconds since epoch). Repository decode must convert:
   ```typescript
   // In repository decode logic:
   const decodeRow = (row: { created_at: Date; updated_at: Date }): Workspace => ({
     id: row.id as WorkspaceId,
     name: row.name,
     createdAt: BigInt(row.created_at.getTime()),
     updatedAt: BigInt(row.updated_at.getTime()),
   })
   ```
   Add JSDoc to each repository interface documenting this conversion:
   ```typescript
   /**
    * Repository for Workspace entities.
    *
    * Timestamp conversion: PostgreSQL TIMESTAMPTZ → Date.getTime() → BigInt
    * Domain schemas use Schema.BigIntFromNumber for millisecond-precision timestamps.
    */
   ```

   **Design debt note**: Using BigInt for timestamps is unconventional (most apps use Date or number). This choice was made to avoid Date mutation issues and align with Effect's immutable-by-default philosophy. If this becomes a friction point in later phases, consider a custom `Schema.DateTimeMillis` transform. For now, document the pattern clearly and accept the debt.

4. **pgvector extension**: first migration enables it before any table migrations (architecture.md §6.5)

### Key decisions to follow

- DEC-0006: SourceVersion is immutable. Refresh creates a new version, never updates in place.
- DEC-0003: Use Effect.Service for repositories; Effect.runPromise only at app boundary.
- architecture.md §6.5: apps/api is sole migration executor; apps/worker never runs migrations.
- docs/repository-contract.md §1: `migrations:up` and `migrations:down` are root commands routed through apps/api.

### Packages to install

- `postgres` (npm: `postgres`) — the Bun-native PostgreSQL client. Preferred over `pg` because it has native Bun support, returns typed results, and works well with Effect's `Effect.tryPromise` wrapper. Install in `packages/persistence` as a dependency.
- Do NOT use `@effect/platform` database abstractions — they add indirection without value for this stack.

### Validation commands

- `bun run typecheck` — root typecheck
- `bun run test packages/domain packages/persistence` — unit tests
- `bun run migrations:up && bun run migrations:down && bun run migrations:up` — round-trip migration test (CI gate per repository-contract.md §2.1)
- `bun run lint && bun run lint:imports` — lint + boundary checks

## Constraints and Non-Goals

- Optimize for a thin, end-to-end slice rather than broad but unexecutable scaffolding.
- Keep domain and infrastructure seams typed at the boundary and avoid leaking product behavior into Fred core.
- Each change should leave one user path closer to runnable with persistence, streaming, and citations all visible.

## Related Notes

- Step: [[02_Phases/Phase_01_walking_skeleton/Steps/Step_02_define-core-domain-schemas-and-persistence-migrations|STEP-01-02 Define Core Domain Schemas and Persistence Migrations]]
- Phase: [[02_Phases/Phase_01_walking_skeleton/Phase|Phase 01 walking skeleton]]
