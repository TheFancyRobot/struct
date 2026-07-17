# struct

A trustworthy, source-grounded research workspace for documents, datasets, and directories. Documents are retrieved, datasets are queried, directories are navigated, and large corpora are recursively analyzed — with deterministic computation, verifiable citations, and durable, resumable work.

> **Current state: Phase 0 (architecture spikes and delivery foundations).** This repository is documentation-only. No runtime, package manifest, application entry point, or CI configuration exists yet. The manifests and commands below are the **planned contract** created by STEP-01-01.

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
| [docs/adr/](./docs/adr/) | Architecture decision records (DEC-0001 … DEC-0013). |
| [AGENTS.md](./AGENTS.md) | Repository and Agent Vault operating instructions. |

## Planned repository layout

```
apps/
├── web        # Next.js + Tailwind + DaisyUI (DEC-0013) — research UI, SSE, evidence inspector
├── api        # Effect HTTP boundary — auth, typed query/command, SSE, sole migration executor
└── worker     # Durable ingestion, research, DuckDB worker-child supervisor, recovery

packages/
├── domain · persistence · source-storage · ingestion · document-processing
├── retrieval · data-engine · research-engine · fred-workflows
└── evaluation · observability · shared-ui
```

Package dependency flows downward only; no app imports another app; `domain` is the leaf. Full rules in [docs/architecture.md §4.2](./docs/architecture.md).

## Bootstrap (planned, created by STEP-01-01)

```bash
bun install --frozen-lockfile   # pinned dependencies (Bun 1.3.13, TS 7.0.2)
cp .env.example .env           # then fill in real values (DATABASE_URL, FRED_* provider keys)
docker compose up -d postgres  # PostgreSQL 16 + pgvector (or use a local Postgres install)
bun run migrations:up           # apps/api is the sole migration executor
bun run dev                     # starts worker (3002 metrics), api (3001), web (3000)
```

Docker-unavailable fallback, platform notes, and reset steps are in [docs/local-development.md](./docs/local-development.md).

## Common commands (planned)

```bash
bun run typecheck   # tsc --noEmit across the workspace
bun run lint        # ESLint + import-boundary check
bun test            # unit tests
bun run test:integration   # integration tests (Phase 01+)
bun run test:e2e           # browser/e2e (Phase 01+)
bun run migrations:up      # apply migrations
bun run migrations:down    # roll back one migration
bun run corpus:smoke        # small evaluation subset (Phase 04)
bun run corpus:eval         # full ~25k corpus + quality gates (Phase 09)
```

Full command inventory and CI gates in [docs/repository-contract.md](./docs/repository-contract.md).

## Core invariants (do not change without an ADR)

- Source versions, dataset snapshots, and query-result snapshots are immutable.
- Exact dataset answers come from deterministic read-only SQL, not model estimation.
- Imported content is untrusted evidence; it cannot change permissions, instructions, scope, or limits.
- Long-running work is durable, bounded, and cancellable.
- Citations are validated before finalization.
- The API is the typed boundary; the worker is the durable execution boundary.
