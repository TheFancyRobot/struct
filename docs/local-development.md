# Local Development and Local Stack

This document is the Phase 0 **local-stack contract** for [`architecture.md`](./architecture.md). It fixes local service ownership, ports, volumes, health checks, startup/shutdown/reset behavior, environment/secrets policy, and platform fallbacks so a first-day developer can bootstrap without guessing.

> **Current status:** Phase 04 adds the DuckDB data-plane sidecar to
> `docker-compose.yml`. PostgreSQL remains the durable application database;
> DuckDB is an isolated materialization and allowlisted read-only query engine
> and is never loaded into a maintained host process.

## 1. Local service table

Maintained host applications, scripts, and tests run on Bun. DuckDB runs in an
isolated container/sidecar rather than loading its native adapter into a
maintained host process. The sidecar pins Node `24.18.0` and
`@duckdb/node-api` `1.5.4-r.1` inside the image; neither is a host prerequisite.
STEP-00-03's
child-process result remains useful historical evidence for protocol,
hardening, cancellation, and crash-containment requirements; it is not the
selected production topology.

| Service | Owner (lifecycle/config) | Port / socket | Volume / root | Health check | Startup order | Shutdown | Reset behavior |
| --- | --- | --- | --- | --- | --- | --- | --- |
| PostgreSQL 16 + pgvector | `apps/api` (migrations/schema) | `5432` (host→container) | `./.local/pgdata` (gitignored bind mount) | `pg_isready -h localhost -p 5432 -U struct` and operator `SELECT 1` | 1 (first) | stop container / `pg_ctl stop` | guarded database drop/recreate, then `migrations:up` |
| Artifact storage (dev FS adapter) | `packages/source-storage` adapter; written by `apps/worker`, read by `apps/api` | none (filesystem path) | `./.local/artifacts` (gitignored, persistent) | directory exists and is writable | 2 (after PG, before worker) | no process to stop | delete `./.local/artifacts` |
| DuckDB data-plane sidecar | `packages/data-engine` owns the typed client/protocol; Compose owns service lifecycle | sidecar is internal/no-egress; fixed-target gateway publishes authenticated `127.0.0.1:4300` and has no mounts | `./.local/artifacts` read-only and the `data-engine-scratch` local Docker volume read/write | authenticated `GET /healthz`; host Bun-client materialization/query integration probe | after artifact storage, before worker | stop/restart sidecar and gateway; remove unpromoted partials | `docker compose down -v` removes scratch |
| `apps/worker` | itself | no inbound HTTP; optional metrics on `3002`; authenticated data-engine access through the loopback gateway | reads `./.local/artifacts` | `GET /healthz` on metrics port (optional) or process liveness | 3 (after PG + storage dirs) | `SIGTERM`; finish in-flight, checkpoint, exit | stop process |
| `apps/api` | itself | `3001` (HTTP) | reads PG + artifact refs | `GET /healthz` → `200` | 4 (after worker) | `SIGTERM`; drain SSE, exit | stop process |
| `apps/web` | itself | `3000` (Vite 8 dev or Bun production server) | none | `GET /` → `200` | 5 (after API) | `SIGTERM`; exit | stop process |

Ownership rules captured by the table:

- **PostgreSQL** is shared by `apps/api` and `apps/worker`, but only `apps/api` owns schema migrations (see [`architecture.md` §6.5](./architecture.md)). `apps/worker` connects as a read/write client for domain data; it never runs migrations.
- **DuckDB is isolated in the Compose stack.** The sidecar accepts only
  authenticated version-1 materialization and allowlisted read-only query
  operations. It derives source paths from catalog hashes, reads the artifact
  mount, and writes temporary/final outputs only under its scratch mount. It
  does not expose an unrestricted raw-SQL endpoint.
- **Artifact storage** uses the local filesystem adapter in development; production uses an S3-compatible abstraction. The rest of the product depends on stable object references, never raw host paths.

## 2. Startup, shutdown, and reset

**Startup order:** PostgreSQL → artifact directory + data-engine scratch volume →
DuckDB sidecar → `apps/worker` → `apps/api` → `apps/web`.

`bun run ops stack:up` prepares and verifies the host-user-writable PostgreSQL
and artifact roots, validates the Compose model, waits for all container health
checks, and probes PostgreSQL plus the authenticated data-engine gateway.

**Shutdown order:** reverse. Stop the sidecar after the worker and before
PostgreSQL. The worker must finish or checkpoint
in-flight jobs before exit; the API must drain SSE streams.

**Reset (clean local state):**

```bash
# local-only default; DATABASE_URL must end in /struct (otherwise use its exact database name)
bun run dev:stop
bun run ops stack:up
STRUCT_ALLOW_DESTRUCTIVE_RESET=struct bun run ops database:reset
bun run dev
```

Reset is an explicit greenfield drop/recreate operation. It is limited to a
loopback `struct*` PostgreSQL database and fails unless the approval value
exactly matches the target. It does not delete the `./.local/pgdata` bind mount;
`docker compose down -v` removes only Compose-managed scratch volumes. See the
[deployment and recovery runbook](./operations/deployment-recovery.md) for
backup, restore, restart, and rollback procedures.

For a built web process, run `bun run --filter @struct/web build` followed by
`bun run --filter @struct/web start`. The Bun server serves the generated
`dist/` SPA and proxies same-origin `/api` requests to `API_ORIGIN`, adding the
server-only `API_AUTH_TOKEN` without placing it in the browser bundle.

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
| `API_AUTH_TOKEN` | `apps/api`, `apps/web` server | bearer credential for protected API reads; the web server injects it without exposing it to browser code (minimum 16 characters) | local secret |
| `API_WORKSPACE_ID` | `apps/api` | workspace UUID owned by the configured bearer identity | local configuration |
| `API_ORIGIN` | `apps/web` production server | upstream API origin for the same-origin credential bridge | `http://127.0.0.1:3001` |
| `MAX_TEXT_SOURCE_BYTES` | `apps/api`, `packages/ingestion` | walking-slice upload byte cap | `1048576` |
| `DATA_ENGINE_URL` | `packages/data-engine`, `apps/worker` | authenticated loopback gateway | `http://127.0.0.1:4300` |
| `DATA_ENGINE_TOKEN` | `packages/data-engine`, DuckDB sidecar | shared bearer credential (minimum 16 characters) | local secret |
| `API_PORT` | `apps/api` | HTTP port | `3001` |
| `WEB_PORT` | `apps/web` | Vite 8 development or Bun production server port | `3000` |
| `WORKER_METRICS_PORT` | `apps/worker` | optional metrics/health port | `3002` |
| `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` | `apps/api`, `apps/worker`, `packages/workflows` | optional OTLP HTTP trace collector; stdout tracing is the local fallback | `http://localhost:4318/v1/traces` |
| `WORKER_POLL_INTERVAL_MS` | `apps/worker` | ingestion job polling interval | `1000` |
| `WORKER_JOB_STALE_MS` | `apps/worker` | in-progress job stale recovery threshold; research requires at least `RESEARCH_MAX_ELAPSED_MS + max(30000, 2 * WORKER_POLL_INTERVAL_MS)` | `300000` |
| `FRED_*` / provider keys | `apps/worker`, `packages/workflows` | model provider config via Fred registry | (secret) |
| `FRED_PROVIDER_PACKAGE` | `packages/workflows` | installed Fred provider package loaded for research jobs | required for research execution |
| `FRED_MODEL` | `packages/workflows` | provider model identifier for the answer synthesizer | required for research execution |
| `RESEARCH_MAX_ELAPSED_MS` | `packages/workflows` | elapsed-time budget for one walking-slice run | `60000` |

Research jobs renew their attempt-fenced lease at most every 10 seconds while
Fred is active. Stale recovery compares `updated_at` to PostgreSQL `NOW()`, so
replicas share one clock; a lease lost to recovery interrupts the old worker
without allowing a late event or terminal write. The startup timing invariant
above is defense in depth for scheduling jitter and terminal persistence.

Additional variables (budgets, limits, log level) are added as their owning phases require them; each must appear in `.env.example` with a placeholder before it is consumed.

### 3.3 Safe volumes and temp roots

- Host-visible local state lives under `./.local/`, which is gitignored; isolated
  data-engine scratch state lives in the Compose-managed local volume and is
  removed by `docker compose down -v`. This preserves STEP-00-03/STEP-00-05
  isolation: local convenience never widens production permissions.
- The local artifact adapter creates and startup-validates `ARTIFACT_STORAGE_ROOT`, rejects symlink roots and out-of-root refs, and returns stable logical refs such as `artifact://sha256/<hash>` and `staged://<uuid>/<name>` rather than host paths.
- DuckDB temp files, staged Parquet, and profiles stay under the sidecar's
  local Docker volume at `/scratch`. The image seeds that volume with UID 1000
  ownership so a clean checkout starts under the non-root runtime. No source
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
- The sidecar Dockerfile supports arm64 and amd64 and pins the published
  Node `24.18.0` multi-architecture image digest.
- `pgvector/pgvector:pg16` provides an arm64 PostgreSQL image.
- Bun applications run natively; PostgreSQL and DuckDB require Compose. The
  sidecar does not require Node or another adapter runtime on the host.

### 4.2 Linux (x86_64 / arm64)

- Bun remains the only maintained host runtime. PostgreSQL and DuckDB run in
  containers; the DuckDB image carries its own
  pinned adapter runtime.
- Same service table, ports, and volumes as macOS.

### 4.3 Docker-unavailable fallback

Without Docker, deterministic DuckDB materialization is unavailable:

- Use a local PostgreSQL 16 install (Postgres.app on macOS, system package or `pg_ctl` on Linux) with the `pgvector` extension compiled/installed.
- Set `DATABASE_URL` to the local instance in `.env`.
- Artifact storage and the Bun applications run natively via `bun run dev`.
- Do not install Node or load a native DuckDB
  adapter into the host worker as a fallback; fail readiness for data-plane
  features while leaving unrelated product paths available.

### 4.4 Reproduction blockers (explicit)

- **Performance numbers are machine-specific.** Re-run `bun run src/benchmarks/run.ts` on the target host for that host's evidence (STEP-00-03). Do not cite spike timings as universal claims.
- **Full evaluation requires the ~25,000-file corpus.** Corpus generation and the quality gates are owned by STEP-00-06 / Phase 04; a local dev box without the corpus cannot run the pre-release evaluation gate.
- **Model-dependent paths require provider API keys.** Any research/ingestion path that calls a model needs `FRED_*` provider keys; absence is a reproduction blocker, not a bug.
- **Schema development is greenfield.** Breaking changes use guarded
  drop/recreate. There is no legacy database, compatibility layer, upgrade
  reindex procedure, or data-preservation script to operate.

## 5. DuckDB local boundary

- **Topology:** isolated container/sidecar with a narrow private authenticated
  protocol. The maintained Bun worker uses a typed client and never loads the
  native DuckDB adapter. The sidecar image pins Node `24.18.0` and DuckDB
  `1.5.4-r.1`.
- **Protocol:** version-1 authenticated materialization and allowlisted
  read-only query requests. Inputs are content-addressed JSON, JSONL, or CSV
  artifacts; outputs are deterministic Parquet, bounded profiles, and bounded
  query results. Query SQL is parser-checked, total-order-required, and bound
  only to catalog-authorized immutable snapshots.
- **Resource limits:** container `1` CPU, `256 MiB`, and `64` PIDs; DuckDB
  `192MB`, one thread, and one concurrent request; request body `256 KiB`;
  worker defaults of `64 MiB` input, `1,000,000` rows, `128 MiB` output, and
  `60s` wall-clock timeout; `/tmp` is a `16 MiB` tmpfs.
- **Isolation:** no network egress, no Docker socket, a read-only root
  filesystem where practical, a non-root user, explicit CPU/memory/process
  limits, and only approved artifact/sandbox mounts.
- **Cancellation:** adapter interrupt on timeout or client disconnect; durable
  worker leases fence late completion and permit recovery.
- **Historical evidence:** STEP-00-03 rejected in-process `direct` execution
  because a native crash was not containable and proved useful JSON-over-stdio
  worker behavior. Phase 04 may reuse the bounded protocol semantics without
  promoting the historical host child process or its Node fallback.

## Related

- [`architecture.md`](./architecture.md) — repository, runtime, data/storage, and migration contracts.
- [`docs/repository-contract.md`](./repository-contract.md) — root command inventory, CI gate matrix, and Phase 1 handoff.
- [`docs/spikes/duckdb-bun-parquet-and-isolation-topology.md`](./spikes/duckdb-bun-parquet-and-isolation-topology.md) — DuckDB topology evidence.
- [`docs/spikes/fred-runtime-and-workflow-integration.md`](./spikes/fred-runtime-and-workflow-integration.md) — Fred boundary and pins.
