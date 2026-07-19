# struct

A trustworthy, source-grounded research workspace for documents, datasets, and directories. Documents are retrieved, datasets are queried, directories are navigated, and large corpora are recursively analyzed — with deterministic computation, verifiable citations, and durable, resumable work.

> **Current state: Phase 02 document research is implemented through STEP-02-06.** The monorepo now includes versioned document parsing/chunking, PostgreSQL full-text plus pgvector hybrid retrieval, bounded core-Fred evidence workflows, durable research jobs/events, cursor-replayable SSE progress, exact navigable citations, SolidJS research states, and deterministic retrieval/provenance/injection evaluation. All gates pass when validated locally (typecheck, lint, lint:imports, build, native Bun tests, database integration tests, migration up/down/up, Compose config, app smokes).

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
| [docs/domain-model.md](./docs/domain-model.md) | Domain model. |
| [docs/research-execution-model.md](./docs/research-execution-model.md) | Research execution model. |
| [docs/security-model.md](./docs/security-model.md) | Security model and trust boundaries. |
| [docs/evaluation-strategy.md](./docs/evaluation-strategy.md) | Evaluation strategy. |
| [docs/evaluation-corpus-generator.md](./docs/evaluation-corpus-generator.md) | Reproducible 25,000-file JSON corpus generation and verification. |
| [docs/retrieval-evaluation.md](./docs/retrieval-evaluation.md) | Phase 02 deterministic retrieval and injection-resistance gate. |
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
├── fred-workflows · observability  # walking-slice core; Fred pinned at 2.0.0
├── document-processing  # versioned normalization, parsing, and chunking
├── data-engine  # deterministic DuckDB sidecar client, SQL policy, and query evidence
└── evaluation  # deterministic smoke gates and reproducible 25,000-file JSON corpus
```

Package dependency flows downward only; no app imports another app; `domain` is the leaf. Enforced by ESLint `no-restricted-imports`, dependency-cruiser, and `scripts/boundary-check.ts`. Full rules in [docs/architecture.md §4.2](./docs/architecture.md).

## Bootstrap

```bash
bun install --frozen-lockfile   # pinned dependencies (Bun 1.3.13, TS 7.0.2)
cp .env.example .env           # then fill in real values (DATABASE_URL, FRED_* provider keys)
docker compose up -d --wait    # PostgreSQL, data engine, and loopback gateway
bun run dev                     # starts web (3000), api (3001), worker (3002) in parallel
```

> Migrations (`bun run migrations:up` / `bun run migrations:down`) are implemented and executed only through `apps/api` as the sole migration executor. The healthz endpoint works without a database connection.

Docker-unavailable fallback, platform notes, and reset steps are in [docs/local-development.md](./docs/local-development.md).

## Common commands

```bash
bun run typecheck   # tsc --noEmit across all workspace configs
bun run lint        # ESLint flat config (TS/Solid/Effect conventions)
bun run lint:imports  # dependency-cruiser + Bun-aware boundary checker
bun run test        # native Bun unit, integration, and entrypoint tests (serial)
bun run build       # build all apps (web Vite, api/worker tsc)
bun run test:integration   # PostgreSQL-backed integration tests
bun run test:e2e           # Bun-native web navigation test
bun run migrations:up      # apply implemented PostgreSQL/pgvector migrations through apps/api
bun run migrations:down    # roll back one implemented migration through apps/api
bun run corpus:smoke        # deterministic Phase 02 retrieval/provenance/injection gate
bun run corpus:generate --profile full --out /absolute/path/corpus
bun run corpus:compare-hashes /path/a/manifest.json /path/b/manifest.json
bun run corpus:eval         # full corpus quality gates (STEP-04-06)
```

The walking-slice research command accepts `workspaceId`, `projectId`, a non-empty
`sourceVersionIds` array, and `question` at
`POST /api/projects/:projectId/research`. The worker
requires `FRED_PROVIDER_PACKAGE` and `FRED_MODEL` at startup and loads the
configured Fred provider before reporting readiness. Provider-specific credentials
are required before live model execution; tests use a fixed mock provider and
require no provider key.

Full command inventory and CI gates in [docs/repository-contract.md](./docs/repository-contract.md).

## Core invariants (do not change without an ADR)

- Source versions, dataset snapshots, and query-result snapshots are immutable.
- Exact dataset answers come from deterministic read-only SQL, not model estimation.
- Imported content is untrusted evidence; it cannot change permissions, instructions, scope, or limits.
- Long-running work is durable, bounded, and cancellable.
- Citations are validated before finalization.
- The API is the typed boundary; the worker is the durable execution boundary.
