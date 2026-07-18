# struct

A trustworthy, source-grounded research workspace for documents, datasets, and directories. Documents are retrieved, datasets are queried, directories are navigated, and large corpora are recursively analyzed — with deterministic computation, verifiable citations, and durable, resumable work.

> **Current state: Phase 01 (walking skeleton) — STEP-01-01 scaffold complete.** The monorepo has Bun workspace manifests, three runtime apps (`apps/web`, `apps/api`, `apps/worker`), and three packages (`domain`, `persistence`, `observability`). All gates pass (typecheck, lint, lint:imports, build, test, Compose config, app smokes). Persistence migrations, API endpoints, and CI are not yet implemented.

## Canonical documents

| Document | Purpose |
| --- | --- |
| [docs/product-brief.md](./docs/product-brief.md) | Authoritative requirements and preferred technical direction. |
| [docs/architecture.md](./docs/architecture.md) | Architecture contract: repository, runtime, data/storage, migration ownership. |
| [docs/repository-contract.md](./docs/repository-contract.md) | Root command inventory, CI gate matrix, Phase 1 handoff. |
| [docs/local-development.md](./docs/local-development.md) | Local service table, environment/secrets, platform fallbacks. |
| [docs/implementation-plan.md](./docs/implementation-plan.md) | Phase sequence, dependencies, risks. |
| [docs/roadmap.md](./docs/roadmap.md) | Horizons and release checkpoints. |
| [docs/domain-model.md](./docs/domain-model.md) | Domain model. |
| [docs/research-execution-model.md](./docs/research-execution-model.md) | Research execution model. |
| [docs/security-model.md](./docs/security-model.md) | Security model and trust boundaries. |
| [docs/evaluation-strategy.md](./docs/evaluation-strategy.md) | Evaluation strategy. |
| [docs/citation-and-provenance.md](./docs/citation-and-provenance.md) | Citation and provenance. |
| [docs/adr/](./docs/adr/) | Architecture decision records (DEC-0001 … DEC-0014). |
| [AGENTS.md](./AGENTS.md) | Repository and Agent Vault operating instructions. |

## Repository layout

```
apps/
├── web        # SolidJS 1.9 + Vite 8 + Solid Router + Tailwind 4 + DaisyUI (DEC-0013, DEC-0014)
├── api        # Bun HTTP + Effect Config — healthz, SSE placeholder (migration executor in later steps)
└── worker     # Effect Config skeleton — durable execution (jobs in later steps)

packages/
├── domain · persistence · observability          # scaffolded (STEP-01-01)
├── source-storage · ingestion · document-processing  # planned (STEP-01-03+)
├── retrieval · data-engine · research-engine · fred-workflows  # planned (STEP-01-04+)
└── evaluation · shared-ui                              # planned (later phases)
```

Package dependency flows downward only; no app imports another app; `domain` is the leaf. Enforced by ESLint `no-restricted-imports`, dependency-cruiser, and `scripts/boundary-check.ts`. Full rules in [docs/architecture.md §4.2](./docs/architecture.md).

## Bootstrap

```bash
bun install --frozen-lockfile   # pinned dependencies (Bun 1.3.13, TS 7.0.2)
cp .env.example .env           # then fill in real values (DATABASE_URL, FRED_* provider keys)
docker compose up -d postgres  # PostgreSQL 16 + pgvector (or use a local Postgres install)
bun run dev                     # starts web (3000), api (3001), worker (3002) concurrently
```

> Migrations (`bun run migrations:up`) are defined in the root script but require
> `packages/persistence` migration implementation (STEP-01-02). The healthz endpoint
> works without a database connection.

Docker-unavailable fallback, platform notes, and reset steps are in [docs/local-development.md](./docs/local-development.md).

## Common commands

```bash
bun run typecheck   # tsc --noEmit across all 7 workspace configs
bun run lint        # ESLint flat config (TS/Solid/Effect conventions)
bun run lint:imports  # dependency-cruiser + Bun-aware boundary checker
bun run test        # vitest unit + entrypoint tests
bun run build       # build all apps (web Vite, api/worker tsc)
bun run test:integration   # integration tests (planned, Phase 01+)
bun run test:e2e           # browser/e2e (planned, Phase 01+)
bun run migrations:up      # apply migrations (planned, STEP-01-02)
bun run migrations:down    # roll back one migration (planned, STEP-01-02)
bun run corpus:smoke        # small evaluation subset (planned, Phase 04)
bun run corpus:eval         # full ~25k corpus + quality gates (planned, Phase 09)
```

Full command inventory and CI gates in [docs/repository-contract.md](./docs/repository-contract.md).

## Core invariants (do not change without an ADR)

- Source versions, dataset snapshots, and query-result snapshots are immutable.
- Exact dataset answers come from deterministic read-only SQL, not model estimation.
- Imported content is untrusted evidence; it cannot change permissions, instructions, scope, or limits.
- Long-running work is durable, bounded, and cancellable.
- Citations are validated before finalization.
- The API is the typed boundary; the worker is the durable execution boundary.
