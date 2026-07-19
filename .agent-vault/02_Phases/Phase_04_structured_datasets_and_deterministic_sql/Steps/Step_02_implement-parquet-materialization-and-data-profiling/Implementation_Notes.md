# Implementation Notes

- Capture durable findings learned during execution. Prefer short bullets with file paths, commands, and observed behavior.

- Added `packages/data-engine` with an Effect `Service`, Config/Redacted credential handling, exact Effect Schema protocol decoding, typed transport/protocol/resource failures, artifact download, lineage verification, and content-addressed artifact persistence.
- Added `services/data-engine-sidecar` with a Node `24.18.0` runtime pinned to the published multi-architecture image digest and `@duckdb/node-api` `1.5.4-r.1`. The service exposes only authenticated version-1 materialization and artifact-read operations; it has no arbitrary SQL endpoint.
- Compose keeps the DuckDB sidecar internal/no-egress with no published port. A no-mount, fixed-target, loopback-only TCP gateway exposes the authenticated protocol to the host Bun worker without widening DuckDB's network access. Both containers run non-root with read-only roots, all capabilities dropped, no-new-privileges, explicit CPU/memory/PID limits, and only the sidecar receives the read-only artifact and read/write scratch mounts.
- Materialization imports cataloged JSON, JSONL, or CSV with explicit schema casts; orders output deterministically; emits immutable Parquet and bounded profiles; verifies hashes at client and persistence boundaries; and removes partial outputs on failure.
- Added migration `0011_dataset_materializations`, durable database-clock leases, heartbeat renewal, expired-lease recovery, ownership fencing, idempotent atomic completion/event persistence, and the materialization worker poll loop.
- Adding migration 0011 exposed fixed-count rollback assumptions in two older migration tests. Updated those tests to roll back the new materialization migration before exercising their owned historical migration.
- Root pre-publication review added hard server-side request caps, authenticated health checks, pre-allocation input/output size checks, deterministic `npm ci`, and an exact Node `24.18.0` LTS image pin.
- Root pre-publication review also added atomic failure transitions: only explicitly transient transport, engine cancellation, and artifact-write failures retry; all other failures terminal-fail by default. Every transition is attempt/lease fenced and journaled, so an operational materialization error cannot terminate the worker or strand the job.

## Related Notes

- Step: [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_02_implement-parquet-materialization-and-data-profiling|STEP-04-02 Implement Parquet Materialization and Data Profiling]]
- Phase: [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Phase|Phase 04 structured datasets and deterministic sql]]
