# Local Development and Local Stack

This document is the Phase 0 **local-stack contract** for [`architecture.md`](./architecture.md). It fixes local service ownership, ports, volumes, health checks, startup/shutdown/reset behavior, environment/secrets policy, and platform fallbacks so a first-day developer can bootstrap without guessing.

> **Phase 0 status:** this is a documentation contract only. The manifests and compose file named here (`docker-compose.yml`, `.env.example`, `package.json`, `apps/*/package.json`) are **created by STEP-01-01**, not by this step. No path below is described as already implemented. Runtime performance thresholds are machine-specific and stay with the owning spike/evaluation phase.

## 1. Local service table

All services run on the developer host. Only PostgreSQL uses a container; DuckDB runs as an in-process child of the worker (STEP-00-03 selected the `worker` topology — isolated child process, JSON-over-stdio IPC — *not* a standalone service and *not* the in-process `direct` topology, which fails the crash-containment gate).

| Service | Owner (lifecycle/config) | Port / socket | Volume / root | Health check | Startup order | Shutdown | Reset behavior |
| --- | --- | --- | --- | --- | --- | --- | --- |
| PostgreSQL 16 + pgvector | `apps/api` (migrations/schema) | `5432` (host→container) | `./.local/pgdata` (gitignored, persistent) | `pg_isready -h localhost -p 5432 -U struct` or `SELECT 1` | 1 (first) | stop container / `pg_ctl stop` | drop volume, then `migrations:up` |
| Artifact storage (dev FS adapter) | `packages/source-storage` adapter; written by `apps/worker`, read by `apps/api` | none (filesystem path) | `./.local/artifacts` (gitignored, persistent) | directory exists and is writable | 2 (after PG, before worker) | no process to stop | delete `./.local/artifacts` |
| DuckDB worker child | `apps/worker` (spawns + supervises) | none — JSON-over-stdio IPC, no TCP port | `./.local/duckdb-sandbox` (gitignored, ephemeral) | parent reports child liveness; child survives forced `exit 137` and respawns (STEP-00-03) | spawned on demand by worker (3) | parent kills child + removes `.tmp-*` partials | delete `./.local/duckdb-sandbox` |
| `apps/worker` | itself | no inbound HTTP; optional metrics on `3002` | reads `./.local/artifacts`, `./.local/duckdb-sandbox` | `GET /healthz` on metrics port (optional) or process liveness | 3 (after PG + storage dirs) | `SIGTERM`; finish in-flight, checkpoint, exit | stop process |
| `apps/api` | itself | `3001` (HTTP) | reads PG + artifact refs | `GET /healthz` → `200` | 4 (after worker) | `SIGTERM`; drain SSE, exit | stop process |
| `apps/web` | itself | `3000` (Vite 8 dev) | none | `GET /` → `200` | 5 (after API) | `SIGTERM`; exit | stop process |

Ownership rules captured by the table:

- **PostgreSQL** is shared by `apps/api` and `apps/worker`, but only `apps/api` owns schema migrations (see [`architecture.md` §6.5](./architecture.md)). `apps/worker` connects as a read/write client for domain data; it never runs migrations.
- **DuckDB is not a Docker service.** It is a child process spawned by `apps/worker` with JSON-over-stdio IPC. All DuckDB data, temp, and Parquet files live under one sandbox root (`./.local/duckdb-sandbox`); nothing outside it is reachable (STEP-00-03 hardening: `SET allowed_directories` then `SET enable_external_access=false`).
- **Artifact storage** uses the local filesystem adapter in development; production uses an S3-compatible abstraction. The rest of the product depends on stable object references, never raw host paths.

## 2. Startup, shutdown, and reset

**Startup order:** PostgreSQL → artifact + DuckDB sandbox directories → `apps/worker` → `apps/api` → `apps/web`.

**Shutdown order:** reverse — `apps/web` → `apps/api` → `apps/worker` → PostgreSQL. The worker must finish or checkpoint in-flight jobs before exit; the API must drain SSE streams.

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
| `ARTIFACT_STORAGE_ROOT` | `packages/source-storage`, `apps/worker` | dev FS artifact root | `./.local/artifacts` |
| `DUCKDB_SANDBOX_ROOT` | `packages/data-engine`, `apps/worker` | DuckDB allowlist root | `./.local/duckdb-sandbox` |
| `API_PORT` | `apps/api` | HTTP port | `3001` |
| `WEB_PORT` | `apps/web` | Vite 8 dev port | `3000` |
| `WORKER_METRICS_PORT` | `apps/worker` | optional metrics/health port | `3002` |
| `FRED_*` / provider keys | `apps/worker`, `packages/fred-workflows` | model provider config via Fred registry | (secret) |

Additional variables (budgets, limits, log level) are added as their owning phases require them; each must appear in `.env.example` with a placeholder before it is consumed.

### 3.3 Safe volumes and temp roots

- All local state lives under `./.local/`, which is gitignored. This preserves STEP-00-03/STEP-00-05 isolation: local convenience never widens production permissions.
- DuckDB temp files, staged Parquet, and query snapshots stay under `DUCKDB_SANDBOX_ROOT`. Parquet writes use atomic promote (`<dest>.tmp-<pid>-<ts>` then `rename` on the same filesystem) with a byte cap; no partial is ever promoted as a dataset snapshot (STEP-00-03).
- No service writes outside its declared root. A path-traversal guard rejects `../` and out-of-root writes (STEP-00-03 `security.ts`).

### 3.4 Log and event sanitization

- Logs and metrics never include secrets, API keys, or `DATABASE_URL` passwords.
- Host paths outside the sandbox root are redacted before logging or exposure.
- The product event journal stores **sanitized** projections; large intermediate outputs are stored by reference, never inlined (STEP-00-02; checkpoints stay under 64 KiB).
- SSE error responses are sanitized before client exposure: infrastructure details, stack traces, and internal identifiers are redacted; only typed domain errors reach the client (DEC-0008).

## 4. Platform notes and fallbacks

### 4.1 Apple Silicon (macOS arm64)

- Bun runs natively on arm64; no Rosetta required.
- DuckDB native arm64 builds are available (`@duckdb/node-api` 1.5.4-r.1, verified in STEP-00-03).
- `pgvector/pgvector:pg16` provides an arm64 PostgreSQL image.
- DuckDB and all apps run without Docker; only PostgreSQL optionally uses a container.

### 4.2 Linux (x86_64 / arm64)

- Standard Bun, Node, DuckDB, and PostgreSQL builds apply.
- Same service table, ports, and volumes as macOS.

### 4.3 Docker-unavailable fallback

If Docker is unavailable, only PostgreSQL is affected:

- Use a local PostgreSQL 16 install (Postgres.app on macOS, system package or `pg_ctl` on Linux) with the `pgvector` extension compiled/installed.
- Set `DATABASE_URL` to the local instance in `.env`.
- Everything else (artifact storage, DuckDB worker child, `apps/api`, `apps/worker`, `apps/web`) runs natively via `bun run dev` with no container dependency.
- DuckDB is never containerized in v1; the worker-child topology needs only a Bun/Node runtime.

### 4.4 Reproduction blockers (explicit)

- **Performance numbers are machine-specific.** Re-run `bun run src/benchmarks/run.ts` on the target host for that host's evidence (STEP-00-03). Do not cite spike timings as universal claims.
- **Full evaluation requires the ~25,000-file corpus.** Corpus generation and the quality gates are owned by STEP-00-06 / Phase 04; a local dev box without the corpus cannot run the pre-release evaluation gate.
- **Model-dependent paths require provider API keys.** Any research/ingestion path that calls a model needs `FRED_*` provider keys; absence is a reproduction blocker, not a bug.
- **Irreversible migrations need an ADR.** A local rollback that hits an irreversible migration cannot proceed without the matching decision record (see [`architecture.md` §6.5](./architecture.md)).

## 5. DuckDB local boundary (from STEP-00-03)

The chosen DuckDB runtime boundary, restated for local development:

- **Topology:** isolated child process spawned by `apps/worker`, JSON-over-stdio IPC. Rejected: in-process `direct` (native crash not containable).
- **Hardening order (enforced by `createHardenedConnection`):** create instance with `allow_community_extensions=false` + `allow_unsigned_extensions=false` (external access on) → `SET allowed_directories=['<sandboxRoot>']` → `SET enable_external_access=false`.
- **Resource limits:** `memory_limit`, `threads` (e.g. `2`), wall-clock `timeoutMs`, `maxRows` read cap, `maxOutputBytes` byte cap.
- **Cancellation:** child `conn.interrupt()` plus parent kill + respawn as a hard fallback.
- **Node fallback:** the worker child spawns via `bun` when available and falls back to `node`; the boundary contains no Bun-only APIs, so a Node-compatible product-local boundary is viable.

## Related

- [`architecture.md`](./architecture.md) — repository, runtime, data/storage, and migration contracts.
- [`docs/repository-contract.md`](./repository-contract.md) — root command inventory, CI gate matrix, and Phase 1 handoff.
- [`docs/spikes/duckdb-bun-parquet-and-isolation-topology.md`](./spikes/duckdb-bun-parquet-and-isolation-topology.md) — DuckDB topology evidence.
- [`docs/spikes/fred-runtime-and-workflow-integration.md`](./spikes/fred-runtime-and-workflow-integration.md) — Fred boundary and pins.
