# Implementation Notes

- Capture durable findings learned during execution. Prefer short bullets with file paths, commands, and observed behavior.
- `packages/data-engine/src/protocol.ts` defines the versioned,
  workspace/project-scoped request and result contract with immutable catalog
  bindings, canonical SQL, schema/result hashes, exact values, and bounds.
- `packages/data-engine/src/client.ts` adds the authenticated Effect service
  operation and rejects response scope or lineage drift.
- `services/data-engine-sidecar/server.mjs` validates the SQL subset lexically
  and again with DuckDB statement/table introspection, then binds only verified
  content-addressed Parquet artifacts with external access disabled.
- The allowlist is intentionally conservative: one SELECT/CTE statement,
  top-level ORDER BY, catalog aliases only, and a bounded scalar/aggregate
  function set. Unsafe statements, comments, paths, URLs, attachments,
  extensions, arbitrary table functions, and catalog escape fail closed.
- `ReadOnlySqlService` is the Bun-side boundary: it authenticates and
  authorizes a user before resolving workspace/project-scoped aliases through
  `DatasetMaterializationRepo.resolveQuerySnapshots`, then sends only the
  resolved schema hash and Parquet digest to the internal sidecar client.
- No public dataset-query HTTP endpoint is exposed in this step because the app
  does not yet have real user-auth middleware. Callers must provide the
  runtime-injected authentication and authorization infrastructure services;
  missing or invalid credentials fail before catalog lookup or execution.
- All client I/O phases share one deadline. Artifact handoff reads distinguish
  missing files from internal failures, and query schema hashes fingerprint the
  actual projected result columns rather than input bindings.

## Related Notes

- Step: [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_03_implement-allowlisted-read-only-sql-service|STEP-04-03 Implement Allowlisted Read-Only SQL Service]]
- Phase: [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Phase|Phase 04 structured datasets and deterministic sql]]
