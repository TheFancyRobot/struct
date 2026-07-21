# Quickstart

## Prerequisites

- Bun 1.3.13 and Docker with Compose (for PostgreSQL and the isolated data engine)
- See [local-development.md §4](./local-development.md#4-platform-notes-and-fallbacks) for platform notes.

## Setup

1. `bun install --frozen-lockfile`
2. Copy `.env.example` to `.env` and adjust only what your machine needs.
3. `bun run ops stack:up`
4. `STRUCT_ALLOW_DESTRUCTIVE_RESET=struct bun run ops database:reset` (the default `DATABASE_URL` must end in `/struct`; otherwise use its exact database name)
5. `bun run dev`

The last command starts the web, API, and worker applications together.

## Environment

- See [local-development.md §3](./local-development.md#3-environment-secrets-and-safe-volumes) for variable descriptions and secret-handling rules.

## Walking-skeleton demo

Set a real provider key in `.env`, then seed the Phase 01 project fixture:

Keep `API_WORKSPACE_ID=310e8400-e29b-41d4-a716-446655440000` in `.env` so the
API identity owns the fixture workspace seeded below. Export the same API
credential configured in `.env` for the direct API calls:

```sh
export API_AUTH_TOKEN='replace-with-the-value-from-.env'
```

```sh
docker compose exec -T postgres psql -U struct -d struct -c \
  "INSERT INTO workspaces (id, name) VALUES ('310e8400-e29b-41d4-a716-446655440000', 'Demo') ON CONFLICT DO NOTHING; INSERT INTO projects (id, workspace_id, name) VALUES ('310e8400-e29b-41d4-a716-446655440001', '310e8400-e29b-41d4-a716-446655440000', 'Walking skeleton') ON CONFLICT DO NOTHING;"
```

Register one UTF-8 source and let the running worker ingest it:

```sh
curl -sS -X POST http://localhost:3001/api/projects/310e8400-e29b-41d4-a716-446655440001/sources \
  -H "authorization: Bearer $API_AUTH_TOKEN" \
  -H 'content-type: application/json' \
  -d '{"workspaceId":"310e8400-e29b-41d4-a716-446655440000","projectId":"310e8400-e29b-41d4-a716-446655440001","name":"launch.txt","mediaType":"text/plain","contentBase64":"VGhlIGxhdW5jaCBkYXRlIGlzIEp1bHkgMTgu"}'
SOURCE_VERSION_ID=
for attempt in $(seq 1 30); do
  SOURCE_VERSION_ID=$(docker compose exec -T postgres psql -U struct -d struct -Atc \
    "SELECT sv.id FROM source_versions sv JOIN sources s ON s.id = sv.source_id WHERE s.project_id = '310e8400-e29b-41d4-a716-446655440001' ORDER BY sv.version DESC LIMIT 1" | tr -d '\r')
  [ -n "$SOURCE_VERSION_ID" ] && break
  sleep 1
done
[ -n "$SOURCE_VERSION_ID" ] || { echo "Source ingestion timed out" >&2; exit 1; }
RESEARCH_RESPONSE=$(curl -sS -X POST http://localhost:3001/api/projects/310e8400-e29b-41d4-a716-446655440001/research \
  -H "authorization: Bearer $API_AUTH_TOKEN" \
  -H 'content-type: application/json' \
  -d "{\"workspaceId\":\"310e8400-e29b-41d4-a716-446655440000\",\"projectId\":\"310e8400-e29b-41d4-a716-446655440001\",\"sourceVersionIds\":[\"$SOURCE_VERSION_ID\"],\"question\":\"What is the launch date?\"}")
RUN_ID=$(RESEARCH_RESPONSE="$RESEARCH_RESPONSE" bun -e \
  'console.log(JSON.parse(Bun.env.RESEARCH_RESPONSE).runId)')
THREAD_ID=$(RESEARCH_RESPONSE="$RESEARCH_RESPONSE" bun -e \
  'console.log(JSON.parse(Bun.env.RESEARCH_RESPONSE).threadId)')
curl -N \
  -H "authorization: Bearer $API_AUTH_TOKEN" \
  "http://localhost:3001/api/projects/310e8400-e29b-41d4-a716-446655440001/runs/$RUN_ID/events"
```

The `research-completed` event contains citation IDs in `data.citations[].id`.
Fetch a cited excerpt at
`/api/projects/310e8400-e29b-41d4-a716-446655440001/research/$THREAD_ID/citation/<citationId>`
with the same bearer header.

The API, worker, Fred workflow, retrieval, citation validation, and SSE replay all
correlate on persisted workspace/project/source/run/job identities. Logs never
include provider keys, raw source text, or host paths.

## Testing

- `bun run test` — complete maintained workspace test suite
- `bun run test:integration` — PostgreSQL-backed integration tests
- `bun run test:e2e` — installs pinned Chromium when needed, builds the web
  app, then runs the maintained Playwright browser journeys
- See [repository-contract.md §2](./repository-contract.md#2-gate-matrix) for the full gate matrix.

## Known limits

- v1 is a single-node deployment. Bun hosts web/API/worker; Compose hosts
  PostgreSQL and the authenticated, no-egress DuckDB data engine.
- Authentication is one operator-managed bearer credential bound to the
  configured workspace, not a self-service multi-user identity system.
- Local content-addressed disk is the artifact store. Back it up and restore it
  with the paired PostgreSQL archive described in
  [deployment-recovery.md](./operations/deployment-recovery.md).
- URL ingestion, archive expansion, OCR for scanned PDFs, Office formats, and
  SQLite import are unsupported. Supported document paths fail explicitly when
  their type, media type, or configured byte limits are invalid.
- Project/source creation and research initiation are API/operator driven. The
  browser covers research progress, exact citations, mixed-source evidence,
  notebooks, and report workflows.
- See [release-checklist.md](./release-checklist.md) for the complete accepted
  v1 boundary and release evidence.
