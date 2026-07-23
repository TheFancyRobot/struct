# Execution Brief

## Exact Outcome

- Materialize cataloged JSON, JSONL/NDJSON, and CSV snapshots to immutable Parquet artifacts, preserve stable per-record original-source lineage (source input/file identity, record ordinal/pointer, and stable record identity) suitable for citation reopening, and store deterministic profiles through one isolated DuckDB Docker Compose sidecar.

## Prerequisites

- STEP-04-01 is merged and its catalog contracts are stable.
- Read the parent phase, Integration Map, DEC-0003, DEC-0005, DEC-0006, and DEC-0009.

## Deliverables

- Add a pinned DuckDB sidecar image and pinned internal adapter runtime in Docker Compose; Bun remains the only host runtime.
- Isolate the service on an internal Compose network with no network egress, least privilege, bounded CPU/memory, read-only root filesystem, and only explicit artifact scratch mounts.
- Add a versioned request/response protocol decoded with Effect `Schema`; authenticate every request with a configured service credential and reject missing/invalid credentials.
- Add a typed Bun client as an `Effect.Service` with scoped transport, timeouts, interruption, explicit retries only for safe transient failures, and specific `Schema.TaggedError` failures.
- Add deterministic JSON, JSONL/NDJSON, and CSV import, schema-family assignment, stable per-record original-source lineage columns (source input/file identity, record ordinal/pointer, and stable record identity), Parquet materialization, profile statistics, content hashes, artifact persistence, and resumable worker/job-journal integration.

## Constraints and Non-Goals

- Do not install or run Node/Python/DuckDB on the host. The sidecar owns its pinned internal runtime.
- No arbitrary host paths, arbitrary SQL, internet access, legacy-database handling, distributed scheduler, or second queue.
- Profile only bounded facts needed by downstream SQL and citations.

## Handoff

- STEP-04-03 receives authenticated typed client operations over allowlisted snapshot/artifact identifiers and immutable Parquet/profile outputs.

## Related Notes

- Step: [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_02_implement-parquet-materialization-and-data-profiling|STEP-04-02 Implement Parquet Materialization and Data Profiling]]
- Phase: [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Phase|Phase 04 structured datasets and deterministic sql]]
