# Repository Contract

This document is the Phase 0 **repository-level delivery contract** for [`architecture.md`](./architecture.md). It fixes the planned root command inventory, the CI gate matrix, and the Phase 1 handoff so later implementation does not re-litigate layout, gates, or bootstrap order.

> **Phase 0 status:** this is a documentation contract only. The root `package.json` workspace scripts, CI workflow files, and app manifests named here are **created by STEP-01-01**, not by this step. Every command below is *planned*; none are described as already implemented. A command that would invoke a nonexistent package is explicitly marked as future.

## 1. Planned root command inventory

All commands run from the repository root via the Bun workspace scripts that STEP-01-01 will define. They are grouped by purpose; each names its owner and intent.

| Command (planned) | Intent | Owner | Phase introduced |
| --- | --- | --- | --- |
| `bun install --frozen-lockfile` | Install pinned dependencies from the committed lockfile | root `package.json` | STEP-01-01 |
| `bun run dev` | Start worker, API, and web concurrently for local development | root scripts | STEP-01-01 |
| `bun run dev:stop` | Stop local web/api/worker | root scripts | STEP-01-01 |
| `bun run build` | Build all apps and packages | root scripts | STEP-01-01 |
| `bun run typecheck` | `tsc --noEmit` across the workspace via `tsconfig.base.json` | root scripts | STEP-01-01 |
| `bun run lint` | ESLint + import-boundary check (`dependency-cruiser`/`eslint-plugin-import`) | root scripts | STEP-01-01 |
| `bun run lint:imports` | Enforce package dependency directions and forbid cross-app/deep-path imports | root scripts | STEP-01-01 |
| `bun run test` / `bun test` | Unit tests across packages | root scripts | STEP-01-01 |
| `bun run test:integration` | Integration tests (apps/api, apps/worker, persistence, data-engine) | root scripts | Phase 01+ |
| `bun run test:e2e` | Browser/end-to-end tests for visible UI states | root scripts | Phase 01+ |
| `bun run migrations:up` | Apply pending migrations (sole executor: `apps/api`) | `apps/api` | STEP-01-01 |
| `bun run migrations:down` | Roll back exactly one migration (sole executor: `apps/api`) | `apps/api` | STEP-01-01 |
| `bun run migrations:create` | Scaffold a new timestamped migration in `packages/persistence` | `packages/persistence` | Phase 02+ |
| `bun run corpus:smoke` | Run a small synthetic subset of the evaluation corpus | `packages/evaluation` | Phase 04 |
| `bun run corpus:eval` | Run the full ~25,000-file evaluation corpus and quality gates | `packages/evaluation` | Phase 04 / Phase 09 |
| `bun run bench` | Run performance benchmarks (machine-specific; regenerate local evidence) | owning package | Phase 04+ |
| `bun run secrets:scan` | Scan for committed secrets and `.env`/`.env.local` leakage | root scripts / CI | STEP-01-01 |
| `bun run docs:lint` | Lint and link-check canonical docs | root scripts / CI | STEP-01-01 |

Notes:

- `migrations:*` commands route through `apps/api` only (see [`architecture.md` §6.5](./architecture.md)). A static check verifies no other app imports the migration runner.
- `lint:imports` enforces the dependency directions in [`architecture.md` §4.2](./architecture.md).
- `corpus:*` and `bench` are owned by later phases; their absence in Phase 1 is a deferral, not a gap.

## 2. CI gate matrix

Three gate tiers. Each check names its owner. Gate-tier *thresholds* (pass/fail numbers) are finalized by STEP-00-06; this matrix fixes *which checks run in which tier and who owns them*.

### 2.1 PR gate (every pull request, required to merge)

| Check | Owner | Notes |
| --- | --- | --- |
| `bun install --frozen-lockfile` | root | lockfile must resolve with no changes |
| `bun run typecheck` | root | TS 7.0.2, `tsc --noEmit` |
| `bun run lint` + `lint:imports` | root | ESLint + dependency-direction enforcement |
| `bun run test` (unit) | packages | all package unit tests |
| `bun run build` | root | all apps + packages build |
| `bun run secrets:scan` | CI | reject committed secrets / `.env` leakage |
| `bun run docs:lint` | docs | link-check canonical docs |
| migration round-trip | `apps/api` + `packages/persistence` | `migrations:up && migrations:down && migrations:up` on ephemeral PG; idempotent + clean |
| executor-uniqueness check | CI | migration-runner imports live only in `apps/api` |
| release-lockfile check | CI | release lockfile resolves to published Fred pins, not a `file:` link (DEC-0001) |

### 2.2 Nightly gate (scheduled, full integration + recovery + evaluation smoke)

| Check | Owner | Notes |
| --- | --- | --- |
| `bun run test:integration` | apps + persistence | API, worker, persistence, data-engine integration |
| recovery / cancellation replay | `apps/worker` | restart-safe scenarios from STEP-00-02 (two-process resume, exit `86`→`0`, duplicate side-effect rate `0`) |
| DuckDB topology regression | `packages/data-engine` | `worker` topology wins; `direct` (crashContained=null) cannot win (STEP-00-03) |
| `bun run corpus:smoke` | `packages/evaluation` | small synthetic corpus subset (full corpus deferred) |
| injection-resistance smoke | `packages/data-engine` + security | DuckDB `read_json_auto('/etc/passwd')` DENIED; `ATTACH`/`INSTALL` DENIED (STEP-00-03) |
| docs build | docs | full docs site builds |

### 2.3 Pre-release gate (before any v1 release tag)

| Check | Owner | Notes |
| --- | --- | --- |
| `bun run corpus:eval` | `packages/evaluation` | full ~25,000-file corpus; exactness, semantic coverage, provenance, injection resistance, recovery (DEC-0011) |
| security review | STEP-00-05 owner | threat-model and trust-boundary verification matrix sign-off |
| `bun run bench` | owning package | performance benchmarks on the release hardware; results recorded with machine metadata |
| migration forward + rollback on production-like | `apps/api` | reversible set verified; irreversible steps have ADRs |
| release notes + docs | docs | architecture, roadmap, implementation-plan, and ADRs consistent with the tag |
| release lockfile pinned | CI | published Fred pins only; no dev-only local link |

Gate-tier thresholds and the exact pass/fail numbers for the evaluation gate are finalized by **STEP-00-06** (downstream of STEP-00-05, downstream of this step). Until then, the matrix above fixes the check set and ownership.

## 3. Phase 1 handoff

This section names the exact files STEP-01-01 creates and the intentional deferrals, so Phase 1 can start without re-litigating repository layout.

### 3.1 Exact initial files (created by STEP-01-01)

Repository root:

- `package.json` — Bun workspace manifest, pinned engines, root scripts from §1.
- `bunfig.toml` — Bun configuration.
- `tsconfig.base.json` — shared TS 7.0.2 base config; per-package `tsconfig.json` extend it.
- `docker-compose.yml` — PostgreSQL + pgvector service only (see [`docs/local-development.md`](./local-development.md)).
- `.env.example` — checked-in env contract (no secrets).
- `.gitignore` — ignores `.local/`, `.env`, `.env.local`, `node_modules/`, build output.
- `README.md` — bootstrap quick-start (already authored in Phase 0).

Applications (minimal surfaces for the walking skeleton):

- `apps/web/package.json` — Next.js + Tailwind CSS + DaisyUI (DEC-0013), typed client, SSE consumption; no direct DB or orchestration.
- `apps/api/package.json` — Effect HTTP boundary, auth, typed query/command, SSE, sole migration executor.
- `apps/worker/package.json` — durable ingestion, research execution, DuckDB worker-child supervisor, recovery.

Packages (only the minimal set the walking skeleton needs):

- `packages/domain/package.json` — canonical identifiers, Effect Schemas, typed errors, value/event contracts.
- `packages/persistence/package.json` — repository interfaces, migrations, checkpoint records.
- `packages/observability/package.json` — trace/log/metric wiring.

### 3.2 Intentional deferrals (created by their owning phase, not Phase 1)

- `packages/source-storage`, `ingestion`, `document-processing`, `retrieval`, `data-engine`, `research-engine`, `fred-workflows`, `evaluation`, `shared-ui` — scaffolded when their phase needs them; not empty Phase 1 stubs.
- `packages/data-engine` DuckDB worker child — Phase 04 owns production data-plane code; STEP-00-03 owns the spike contract.
- `packages/evaluation` corpus generator + CI gate implementation — Phase 04 / Phase 09; STEP-00-06 owns the spec.
- Production S3 artifact adapter — Phase 09; the dev FS adapter is sufficient until then.
- Gate-tier thresholds and adversarial fixture matrix — STEP-00-06 (downstream).
- Security enforcement code (auth, filesystem walker, SQL policy executor) — STEP-00-05 finalizes ownership; Phase 09 hardens; Phase 0 is spec-only.

### 3.3 Explicitly excluded infrastructure (rejected, not deferred)

The following are **rejected for v1** and must not be added without a new ADR. They are recorded here so later steps do not re-litigate them:

- **Kafka** or any distributed message broker — the product event journal is an append-only PostgreSQL-backed journal (DEC-0007); no external broker.
- **Kubernetes** — v1 is a single-node product; container orchestration is post-v1 (Phase 15).
- **A dedicated vector database** — initial retrieval uses PostgreSQL full-text search + pgvector (DEC-0004); no separate vector store.
- **A distributed workflow engine** — Fred orchestrates within the worker process (DEC-0012); no separate distributed engine.

### 3.4 STEP-00-05 / STEP-00-06 reconciliation

STEP-00-05 (security threat model) depends on this step and finalizes enforcement ownership for the trust boundaries in [`architecture.md` §3.2](./architecture.md). STEP-00-06 (evaluation corpus + gates) depends on STEP-00-05 and finalizes gate-tier thresholds. This contract names those steps as the owners and keeps the security/evaluation *constraints* consistent with the existing `docs/security-model.md` and `docs/evaluation-strategy.md` (DEC-0009, DEC-0011). No boundary in this contract contradicts those documents; finalization is an explicit deferral with a named owner.

## Related

- [`architecture.md`](./architecture.md) — repository, runtime, data/storage, and migration contracts.
- [`docs/local-development.md`](./local-development.md) — local service table, environment/secrets, platform fallbacks.
- [`docs/implementation-plan.md`](./implementation-plan.md) — phase sequence and dependencies.
- [`docs/roadmap.md`](./roadmap.md) — horizon and release checkpoints.
