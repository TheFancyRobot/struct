# Validation Plan

## Acceptance Checks

- Fixed JSON/CSV fixtures produce byte-stable logical schemas, profiles, result metadata, and content-addressed Parquet references across repeated runs.
- The Bun client and sidecar reject protocol-version mismatch, malformed payloads, missing/invalid credentials, unknown snapshot/artifact IDs, and stale lineage.
- Worker retry after an injected interruption reuses or safely replaces partial artifacts without duplicate snapshots or completion events.

## Negative and Security Cases

- Prove the sidecar has no external network path, cannot read arbitrary host paths, runs least-privileged, and cannot escape explicit mounts.
- Enforce input bytes/rows, output bytes, time, memory, and concurrency limits; cancellation must clean up.
- CSV/JSON type conflicts, corrupt input, empty data, schema drift, and unsupported encodings fail explicitly.

## Deterministic Evidence

- Store fixture hashes and exact expected profile/schema JSON in tests.
- Run: `docker compose config`
- Run: `docker compose up -d --wait` and the sidecar health/auth integration tests, then `docker compose down`
- Run: `bun test packages/data-engine apps/worker`
- Run: `bun run test:integration`
- Run: `bun run typecheck && bun run lint && bun run lint:imports && bun run build`
- Run: `bun run docs:lint && bun run secrets:scan`

## Completion Gate

- Record image/runtime pins, limit values, fixture hashes, and exact test results in Outcome.md; no known isolation or recovery defect may remain.
