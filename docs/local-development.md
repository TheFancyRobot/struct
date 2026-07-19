# Local Development and Local Stack

This document is the Phase 0 **local-stack contract** for [`architecture.md`](./architecture.md). It fixes local service ownership, ports, volumes, health checks, startup/shutdown/reset behavior, environment/secrets policy, and platform fallbacks so a first-day developer can bootstrap without guessing.

> **Current status:** STEP-01-01 created the host applications and a
> `docker-compose.yml` that provisions PostgreSQL only. The DuckDB data-plane
> service described below is a Phase-04 plan, not a claim about the current
> Compose stack. Runtime performance thresholds remain machine-specific and
> stay with the owning implementation/evaluation phase.

## 1. Local service table

Maintained host applications, scripts, and tests run on Bun. The current
Compose stack contains only PostgreSQL. Phase 04 will add DuckDB as an isolated
container/sidecar rather than loading its native adapter into a maintained host
process. The sidecar may use the runtime required by its adapter, but that
runtime remains inside the image and is not a host prerequisite. STEP-00-03's
child-process result remains useful historical evidence for protocol,
hardening, cancellation, and crash-containment requirements; it is not the
selected production topology.

| Service | Owner (lifecycle/config) | Port / socket | Volume / root | Health check | Startup order | Shutdown | Reset behavior |
| --- | --- | --- | --- | --- | --- | --- | --- |
| PostgreSQL 16 + pgvector | `apps/api` (migrations/schema) | `5432` (host→container) | `./.local/pgdata` (gitignored, persistent) | `pg_isready -h localhost -p 5432 -U struct` or `SELECT 1` | 1 (first) | stop container / `pg_ctl stop` | drop volume, then `migrations:up` |
| Artifact storage (dev FS adapter) | `packages/source-storage` adapter; written by `apps/worker`, read by `apps/api` | none (filesystem path) | `./.local/artifacts` (gitignored, persistent) | directory exists and is writable | 2 (after PG, before worker) | no process to stop | delete `./.local/artifacts` |
| DuckDB data-plane sidecar (**planned for Phase 04; absent from current Compose**) | `packages/data-engine` owns the typed client/policy; Compose owns service lifecycle | narrow private service endpoint; exact transport selected during Phase-04 refinement | container-mounted `./.local/duckdb-sandbox` only (gitignored, ephemeral) | authenticated readiness plus a bounded query probe; container crash/restart recovery | after PostgreSQL + storage dirs, before worker | stop/restart container; remove unpromoted partials | remove the sidecar volume/root |
| `apps/worker` | itself | no inbound HTTP; optional metrics on `3002` | reads `./.local/artifacts`, `./.local/duckdb-sandbox` | `GET /healthz` on metrics port (optional) or process liveness | 3 (after PG + storage dirs) | `SIGTERM`; finish in-flight, checkpoint, exit | stop process |
| `apps/api` | itself | `3001` (HTTP) | reads PG + artifact refs | `GET /healthz` → `200` | 4 (after worker) | `SIGTERM`; drain SSE, exit | stop process |
| `apps/web` | itself | `3000` (Vite 8 dev) | none | `GET /` → `200` | 5 (after API) | `SIGTERM`; exit | stop process |

Ownership rules captured by the table:

- **PostgreSQL** is shared by `apps/api` and `apps/worker`, but only `apps/api` owns schema migrations (see [`architecture.md` §6.5](./architecture.md)). `apps/worker` connects as a read/write client for domain data; it never runs migrations.
- **DuckDB is not implemented in the current Compose stack.** Phase 04 owns
  adding the isolated sidecar, its pinned image/runtime, private authenticated
  protocol, health check, resource limits, and lifecycle. All DuckDB data,
  temp, and Parquet files must remain under the one mounted sandbox root;
  nothing else from the host is mounted or reachable.
- **Artifact storage** uses the local filesystem adapter in development; production uses an S3-compatible abstraction. The rest of the product depends on stable object references, never raw host paths.

## 2. Startup, shutdown, and reset

**Current startup order:** PostgreSQL → artifact directory → `apps/worker` →
`apps/api` → `apps/web`. **Planned Phase-04 order:** PostgreSQL → artifact +
DuckDB sandbox directories → DuckDB sidecar → `apps/worker` → `apps/api` →
`apps/web`.

**Shutdown order:** reverse. Once the Phase-04 sidecar exists, stop it after
the worker and before PostgreSQL. The worker must finish or checkpoint
in-flight jobs before exit; the API must drain SSE streams.

**Reset (clean local state):**

```bash
# planned commands, created by STEP-01-01
bun run dev:stop              # stop web/api/worker
docker compose down -v        # stop and remove PG container + volume (or stop local PG)
rm -rf ./.local               # remove pgdata, artifacts, duckdb-sandbox
docker compose up -d postgres # start PG (or start local PG)
bun run migrations:up         # apps/api rebuilds schema + pgvector extension
bun run dev                   # start worker, api, web
```

Reset is a destructive local-only operation. It must never be wired to a production path.

## 3. Environment, secrets, and safe volumes

### 3.1 Example-file and secrets policy

- `.env.example` is **checked in** and contains every required variable with non-sensitive placeholder values. It is the contract for local configuration.
- `.env` is **gitignored** and holds real local values (real `DATABASE_URL`, provider API keys). It is never committed.
- `.env.local` is **gitignored** and holds personal dev overrides, including the dev-only Fred local link (see [`architecture.md` §4.4](./architecture.md)). It is never committed and never used by releases.
- Secrets enter the system as environment variables only. A secret-scan CI gate rejects any committed secret-like string (see [`docs/repository-contract.md`](./repository-contract.md)).

### 3.2 Required environment variables (contract)

| Variable | Owner | Purpose | Example |
| --- | --- | --- | --- |
| `DATABASE_URL` | `apps/api`, `apps/worker` | PostgreSQL connection | `postgres://struct:struct@localhost:5432/struct` |
| `ARTIFACT_STORAGE_ROOT` | `packages/source-storage`, `apps/api`, `apps/worker` | dev FS artifact root and upload staging root | `./.local/artifacts` |
| `MAX_TEXT_SOURCE_BYTES` | `apps/api`, `packages/ingestion` | walking-slice upload byte cap | `1048576` |
| `DUCKDB_SANDBOX_ROOT` (**planned Phase 04**) | `packages/data-engine`, DuckDB sidecar | container-mounted DuckDB allowlist root | `./.local/duckdb-sandbox` |
| `API_PORT` | `apps/api` | HTTP port | `3001` |
| `WEB_PORT` | `apps/web` | Vite 8 dev port | `3000` |
| `WORKER_METRICS_PORT` | `apps/worker` | optional metrics/health port | `3002` |
| `WORKER_POLL_INTERVAL_MS` | `apps/worker` | ingestion job polling interval | `1000` |
| `WORKER_JOB_STALE_MS` | `apps/worker` | in-progress job stale recovery threshold; research requires at least `RESEARCH_MAX_ELAPSED_MS + max(30000, 2 * WORKER_POLL_INTERVAL_MS)` | `300000` |
| `FRED_*` / provider keys | `apps/worker`, `packages/fred-workflows` | model provider config via Fred registry | (secret) |
| `FRED_PROVIDER_PACKAGE` | `packages/fred-workflows` | installed Fred provider package loaded for research jobs | required for research execution |
| `FRED_MODEL` | `packages/fred-workflows` | provider model identifier for the answer synthesizer | required for research execution |
| `RESEARCH_MAX_ELAPSED_MS` | `packages/fred-workflows` | elapsed-time budget for one walking-slice run | `60000` |

Research jobs renew their attempt-fenced lease at most every 10 seconds while
Fred is active. Stale recovery compares `updated_at` to PostgreSQL `NOW()`, so
replicas share one clock; a lease lost to recovery interrupts the old worker
without allowing a late event or terminal write. The startup timing invariant
above is defense in depth for scheduling jitter and terminal persistence.

Additional variables (budgets, limits, log level) are added as their owning phases require them; each must appear in `.env.example` with a placeholder before it is consumed.

### 3.3 Safe volumes and temp roots

- All local state lives under `./.local/`, which is gitignored. This preserves STEP-00-03/STEP-00-05 isolation: local convenience never widens production permissions.
- The local artifact adapter creates and startup-validates `ARTIFACT_STORAGE_ROOT`, rejects symlink roots and out-of-root refs, and returns stable logical refs such as `artifact://sha256/<hash>` and `staged://<uuid>/<name>` rather than host paths.
- Once implemented in Phase 04, DuckDB temp files, staged Parquet, and query
  snapshots stay under the sidecar's `DUCKDB_SANDBOX_ROOT` mount. No source
  tree, home directory, Docker socket, or unrelated artifact root is mounted.
  Parquet writes use atomic promote (`<dest>.tmp-<pid>-<ts>` then `rename` on
  the same filesystem) with a byte cap; no partial is ever promoted as a
  dataset snapshot (invariant proven by STEP-00-03 and carried forward).
- No service writes outside its declared root. A path-traversal guard rejects `../` and out-of-root writes (STEP-00-03 `security.ts`).

### 3.4 Log and event sanitization

- Logs and metrics never include secrets, API keys, or `DATABASE_URL` passwords.
- Host paths outside the sandbox root are redacted before logging or exposure.
- The product event journal stores **sanitized** projections; large intermediate outputs are stored by reference, never inlined (STEP-00-02; checkpoints stay under 64 KiB).
- SSE error responses are sanitized before client exposure: infrastructure details, stack traces, and internal identifiers are redacted; only typed domain errors reach the client (DEC-0008).

## 4. Platform notes and fallbacks

### 4.1 Apple Silicon (macOS arm64)

- Bun runs natively on arm64; no Rosetta required.
- STEP-00-03 verified an arm64 DuckDB adapter build. Phase 04 must publish a
  multi-architecture sidecar image (including arm64) before declaring the
  data plane ready.
- `pgvector/pgvector:pg16` provides an arm64 PostgreSQL image.
- The current Bun applications run natively and only PostgreSQL requires
  Compose. The planned Phase-04 DuckDB path additionally requires its sidecar
  container; it does not require Node or another adapter runtime on the host.

### 4.2 Linux (x86_64 / arm64)

- Bun remains the only maintained host runtime. PostgreSQL and, once
  implemented, DuckDB run in containers; the DuckDB image carries its own
  pinned adapter runtime.
- Same service table, ports, and volumes as macOS.

### 4.3 Docker-unavailable fallback

Today, a Docker-unavailable environment affects only PostgreSQL:

- Use a local PostgreSQL 16 install (Postgres.app on macOS, system package or `pg_ctl` on Linux) with the `pgvector` extension compiled/installed.
- Set `DATABASE_URL` to the local instance in `.env`.
- Artifact storage and the Bun applications run natively via `bun run dev`.
- After Phase 04, deterministic DuckDB execution is unavailable without a
  compatible container runtime. Do not install Node or load a native DuckDB
  adapter into the host worker as a fallback; fail readiness for data-plane
  features while leaving unrelated product paths available.

### 4.4 Reproduction blockers (explicit)

- **Performance numbers are machine-specific.** Re-run `bun run src/benchmarks/run.ts` on the target host for that host's evidence (STEP-00-03). Do not cite spike timings as universal claims.
- **Full evaluation requires the ~25,000-file corpus.** Corpus generation and the quality gates are owned by STEP-00-06 / Phase 04; a local dev box without the corpus cannot run the pre-release evaluation gate.
- **Model-dependent paths require provider API keys.** Any research/ingestion path that calls a model needs `FRED_*` provider keys; absence is a reproduction blocker, not a bug.
- **Irreversible migrations need an ADR.** A local rollback that hits an irreversible migration cannot proceed without the matching decision record (see [`architecture.md` §6.5](./architecture.md)).

### Source text reindexing after upgrade

Migration `0003_research_text_index` does not assume an empty installation. It
creates one `source_text_reindex_jobs` row for every existing immutable
`SourceVersion`, and a trigger creates the same durable state for future
versions. The worker reads the stored manifest and normalized artifact, verifies
the normalized bytes against `content_hash`, indexes in the recorded workspace
and project scope, and atomically marks the row `completed`.

Check upgrade progress and failures with:

```sql
SELECT status, last_error_code, count(*)
FROM source_text_reindex_jobs
GROUP BY status, last_error_code
ORDER BY status, last_error_code;
```

Migration `0004_event_journal_commit_order` replaces the `BIGSERIAL` column
default with a `BEFORE INSERT` allocator. The allocator takes a
transaction-scoped PostgreSQL advisory lock before calling the owned sequence,
so no higher event cursor can commit and become a reconnect checkpoint while a
lower cursor transaction is still open. The trigger intentionally overrides
caller-supplied cursors, applies to every insert path, and permits gaps when a
transaction rolls back.

`artifact-unavailable` is an explicit terminal/retry state, not a silently empty
index. It means the deployment's `ARTIFACT_STORAGE_ROOT` does not contain the
content-addressed objects referenced by the source-version manifest. Restore or
mount the original artifact store first, then requeue only the affected rows:

```sql
UPDATE source_text_reindex_jobs
SET status = 'pending', last_error_code = NULL, updated_at = NOW()
WHERE status = 'failed'
  AND last_error_code = 'artifact-unavailable'
  AND attempts < max_attempts;
```

Do not requeue hash mismatches until the immutable artifact/content-hash
inconsistency has been investigated, and never reset `attempts`: it is the
durable retry/lease-fencing history. If the attempt budget is exhausted, use an
explicit audited operator decision before increasing `max_attempts`.

Retrieval readiness follows the tenant-scoped immutable
`source_text_index` row, not the background lease status. Indexed content is
searchable while its reindex job is `pending` or `in-progress`; a missing index
row fails closed instead of being reported as ordinary zero-result evidence.

## 5. Planned DuckDB local boundary (Phase 04)

Phase 04 must refine and implement this boundary before DuckDB is added to
Compose:

- **Topology:** isolated container/sidecar with a narrow private authenticated
  protocol. The maintained Bun worker uses a typed client and never loads the
  native DuckDB adapter. The sidecar may use the runtime required by the
  selected adapter, pinned inside its image.
- **Current-state guard:** `docker-compose.yml` contains PostgreSQL only. No
  DuckDB service, image, protocol, or health endpoint is implemented yet.
- **Hardening order:** create the engine with
  `allow_community_extensions=false` + `allow_unsigned_extensions=false`
  (external access on) → `SET allowed_directories=['<sandboxRoot>']` →
  `SET enable_external_access=false`. Phase 04 must enforce and re-test this
  inside the container.
- **Resource limits:** `memory_limit`, `threads` (e.g. `2`), wall-clock `timeoutMs`, `maxRows` read cap, `maxOutputBytes` byte cap.
- **Isolation:** no network egress, no Docker socket, a read-only root
  filesystem where practical, a non-root user, explicit CPU/memory/process
  limits, and only approved artifact/sandbox mounts.
- **Cancellation:** adapter interrupt plus container termination/restart as the
  hard fallback.
- **Historical evidence:** STEP-00-03 rejected in-process `direct` execution
  because a native crash was not containable and proved useful JSON-over-stdio
  worker behavior. Phase 04 may reuse the bounded protocol semantics without
  promoting the historical host child process or its Node fallback.

## Related

- [`architecture.md`](./architecture.md) — repository, runtime, data/storage, and migration contracts.
- [`docs/repository-contract.md`](./repository-contract.md) — root command inventory, CI gate matrix, and Phase 1 handoff.
- [`docs/spikes/duckdb-bun-parquet-and-isolation-topology.md`](./spikes/duckdb-bun-parquet-and-isolation-topology.md) — DuckDB topology evidence.
- [`docs/spikes/fred-runtime-and-workflow-integration.md`](./spikes/fred-runtime-and-workflow-integration.md) — Fred boundary and pins.
