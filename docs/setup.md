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

Set a real provider key in `.env`, then seed the Phase 01 project fixture:

```sh
docker compose exec -T postgres psql -U struct -d struct -c \
  "INSERT INTO workspaces (id, name) VALUES ('310e8400-e29b-41d4-a716-446655440000', 'Demo') ON CONFLICT DO NOTHING; INSERT INTO projects (id, workspace_id, name) VALUES ('310e8400-e29b-41d4-a716-446655440001', '310e8400-e29b-41d4-a716-446655440000', 'Walking skeleton') ON CONFLICT DO NOTHING;"
```

Register one UTF-8 source and let the running worker ingest it:

```sh
curl -sS -X POST http://localhost:3001/api/projects/310e8400-e29b-41d4-a716-446655440001/sources \
  -H 'content-type: application/json' \
  -d '{"workspaceId":"310e8400-e29b-41d4-a716-446655440000","projectId":"310e8400-e29b-41d4-a716-446655440001","name":"launch.txt","mediaType":"text/plain","contentBase64":"VGhlIGxhdW5jaCBkYXRlIGlzIEp1bHkgMTgu"}'
sleep 2
SOURCE_VERSION_ID=$(docker compose exec -T postgres psql -U struct -d struct -Atc \
  "SELECT sv.id FROM source_versions sv JOIN sources s ON s.id = sv.source_id WHERE s.project_id = '310e8400-e29b-41d4-a716-446655440001' ORDER BY sv.version DESC LIMIT 1" | tr -d '\r')
curl -sS -X POST http://localhost:3001/api/projects/310e8400-e29b-41d4-a716-446655440001/research \
  -H 'content-type: application/json' \
  -d "{\"workspaceId\":\"310e8400-e29b-41d4-a716-446655440000\",\"projectId\":\"310e8400-e29b-41d4-a716-446655440001\",\"sourceVersionIds\":[\"$SOURCE_VERSION_ID\"],\"question\":\"What is the launch date?\"}"
```

Use the returned `runId` to stream
`/api/projects/<projectId>/runs/<runId>/events`; the completed event supplies
the thread and citation route rendered by the web app.

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
