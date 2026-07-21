# struct

A trustworthy, source-grounded research workspace for documents, datasets, and directories. Documents are retrieved, datasets are queried, directories are navigated, and large corpora are recursively analyzed — with deterministic computation, verifiable citations, and durable, resumable work.

> **Current state: the complete v1 product is implemented and has passed the 23-gate release campaign.** The monorepo includes versioned document and dataset ingestion, directory and recursive analysis, PostgreSQL hybrid retrieval, an isolated DuckDB data plane, schema-validated bounded core-Fred orchestration, durable checkpoints, authenticated cursor-replayable progress, exact citations, durable findings and reports, and a responsive SolidJS research workspace. The final release action is intentionally not performed; see the release checklist.

## Canonical documents

| Document | Purpose |
| --- | --- |
| [docs/product-brief.md](./docs/product-brief.md) | Authoritative requirements and preferred technical direction. |
| [docs/architecture.md](./docs/architecture.md) | Architecture contract: repository, runtime, data/storage, migration ownership. |
| [docs/repository-contract.md](./docs/repository-contract.md) | Root command inventory, CI gate matrix, Phase 1 handoff. |
| [docs/setup.md](./docs/setup.md) | Concise first-run setup and walking-skeleton demo. |
| [docs/local-development.md](./docs/local-development.md) | Local service table, environment/secrets, platform fallbacks. |
| [docs/implementation-plan.md](./docs/implementation-plan.md) | Phase sequence, dependencies, risks. |
| [docs/roadmap.md](./docs/roadmap.md) | Horizons and release checkpoints. |
| [docs/release-policy.md](./docs/release-policy.md) | Pre-1.0, `v1.0.0-rc.N`, and v1.0 versioning policy. |
| [docs/domain-model.md](./docs/domain-model.md) | Domain model. |
| [docs/research-execution-model.md](./docs/research-execution-model.md) | Research execution model. |
| [docs/security-model.md](./docs/security-model.md) | Security model and trust boundaries. |
| [docs/accessibility.md](./docs/accessibility.md) | Keyboard, focus, semantics, contrast, reduced-motion, reflow, and screenshot evidence. |
| [docs/release-checklist.md](./docs/release-checklist.md) | Final evidenced v1 go/no-go checklist; release action remains unchecked. |
| [docs/evaluation-strategy.md](./docs/evaluation-strategy.md) | Evaluation strategy. |
| [docs/evaluation-corpus-generator.md](./docs/evaluation-corpus-generator.md) | Reproducible 25,000-file JSON corpus generation and verification. |
| [docs/retrieval-evaluation.md](./docs/retrieval-evaluation.md) | Phase 02 deterministic retrieval and injection-resistance gate. |
| [docs/benchmarks/research-planning.md](./docs/benchmarks/research-planning.md) | Phase 05 deterministic planning/replay release gate and measured evidence. |
| [docs/operations/research-recovery.md](./docs/operations/research-recovery.md) | Automated and operator research-recovery procedures. |
| [docs/citation-and-provenance.md](./docs/citation-and-provenance.md) | Citation and provenance. |
| [docs/adr/](./docs/adr/) | Architecture decision records (DEC-0001 … DEC-0014). |
| [AGENTS.md](./AGENTS.md) | Repository and Agent Vault operating instructions. |

## Repository layout

```
apps/
├── web        # SolidJS 1.9 + Vite 8 + Solid Router + Tailwind 4 + DaisyUI (DEC-0013, DEC-0014)
├── api        # Bun HTTP + Effect Config — healthz, migrations, project-scoped source/research/SSE/citation APIs
└── worker     # Durable text-ingestion and bounded research job execution

packages/
├── domain · persistence · source-storage · ingestion · retrieval · research-engine
├── workflows · observability       # walking-slice core; Fred pinned at 2.0.0
├── document-processing  # versioned normalization, parsing, and chunking
├── data-engine  # deterministic DuckDB sidecar client, SQL policy, and query evidence
└── evaluation  # deterministic smoke gates and reproducible 25,000-file JSON corpus
```

Package dependency flows downward only; no app imports another app; `domain` is the leaf. Enforced by ESLint `no-restricted-imports`, dependency-cruiser, and `scripts/boundary-check.ts`. Full rules in [docs/architecture.md §4.2](./docs/architecture.md).

## Bootstrap

```bash
bun install --frozen-lockfile   # pinned dependencies (Bun 1.3.13, TS 7.0.2)
cp .env.example .env           # then fill in real values (DATABASE_URL, FRED_* provider keys)
bun run ops stack:up           # prepare storage and verify PostgreSQL/data-engine readiness
bun run dev                     # starts web (3000), api (3001), worker (3002) in parallel
```

> Schema creation runs only through `apps/api`. Greenfield reset is guarded by
> the root operations command; see the deployment recovery runbook. The healthz
> endpoint works without a database connection.

Docker-unavailable fallback, platform notes, and reset steps are in [docs/local-development.md](./docs/local-development.md).

## Common commands

```bash
bun run typecheck   # tsc --noEmit across all workspace configs
bun run lint        # ESLint flat config (TS/Solid/Effect conventions)
bun run lint:imports  # dependency-cruiser + Bun-aware boundary checker
bun run test        # native Bun unit, integration, and entrypoint tests (serial)
bun run build       # build all apps (web Vite, api/worker tsc)
bun run test:integration   # PostgreSQL-backed integration tests
bun run test:e2e           # production-bundle Playwright journeys and responsive screenshots
bun run migrations:up      # apply implemented PostgreSQL/pgvector migrations through apps/api
bun run ops database:reset # guarded greenfield drop/recreate + current schema
bun run corpus:smoke        # deterministic Phase 02 retrieval/provenance/injection gate
bun run corpus:generate --profile full --out /absolute/path/corpus
bun run corpus:compare-hashes /path/a/manifest.json /path/b/manifest.json
bun run corpus:eval         # full corpus quality gates (STEP-04-06)
bun run v1:performance      # live performance, capacity, and resilience gate
bun run v1:evaluate         # bounded 23-gate v1 release campaign
```

The walking-slice research command accepts `workspaceId`, `projectId`, a non-empty
`sourceVersionIds` array, and `question` at
`POST /api/projects/:projectId/research`. The worker
requires `FRED_PROVIDER_PACKAGE` and `FRED_MODEL` at startup and loads the
configured Fred provider before reporting readiness. Provider-specific credentials
are required before live model execution; tests use a fixed mock provider and
require no provider key.

Research progress replays from
`GET /api/projects/:projectId/runs/:runId/events?cursor=<cursor>`. Cancellation is
an idempotent `POST /api/projects/:projectId/runs/:runId/cancel?workspaceId=<id>`
with `Authorization: Bearer <API_AUTH_TOKEN>` and an `Idempotency-Key` header.
The local Vite proxy adds the bearer credential server-side for browser SSE.

Full command inventory and CI gates in [docs/repository-contract.md](./docs/repository-contract.md).

## Core invariants (do not change without an ADR)

- Source versions, dataset snapshots, and query-result snapshots are immutable.
- Exact dataset answers come from deterministic read-only SQL, not model estimation.
- Imported content is untrusted evidence; it cannot change permissions, instructions, scope, or limits.
- Long-running work is durable, bounded, and cancellable.
- Citations are validated before finalization.
- The API is the typed boundary; the worker is the durable execution boundary.
