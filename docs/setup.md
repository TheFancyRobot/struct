# Quickstart

## Prerequisites

- Bun 1.3.13 and Docker (for PostgreSQL)
- See [local-development.md §4](./local-development.md#4-startup-shutdown-and-reset) for platform notes.

## Setup

1. `bun install --frozen-lockfile`
2. Copy `.env.example` to `.env` and adjust only what your machine needs.
3. `docker compose up -d postgres`
4. `bun run migrations:up`
5. `bun run dev`

The last command starts the web, API, and worker applications together.

## Environment

- See [local-development.md §3](./local-development.md#3-environment-and-secrets-contract) for variable descriptions and secret-handling rules.

## Walking-skeleton demo

1. Create a project and register one UTF-8 text source.
2. Let the worker ingest and index the immutable source version.
3. Start a research run against that exact version.
4. Watch persisted progress stream over SSE.
5. Open the completed answer's citation and inspect its highlighted source lines.

The API, worker, Fred workflow, retrieval, citation validation, and SSE replay all
correlate on persisted workspace/project/source/run/job identities. Logs never
include provider keys, raw source text, or host paths.

## Testing

- `bun run test` — complete maintained workspace test suite
- `bun run test:integration` — PostgreSQL-backed integration tests
- `bun run test:e2e` — installs pinned Chromium when needed, then runs the
  Bun-native browser test
- See [repository-contract.md §2](./repository-contract.md#2-ci-gate-matrix) for the full gate matrix.

## Known gaps

- PDF and Office parsing begin in Phase 02.
- Structured datasets and vector search arrive in later phases.
- Directory recursion begins in Phase 03.
- The browser test currently covers the completed research-to-citation path; the
  full project/source authoring UI follows the roadmap.
- See [roadmap.md](./roadmap.md) for the full phase plan.
