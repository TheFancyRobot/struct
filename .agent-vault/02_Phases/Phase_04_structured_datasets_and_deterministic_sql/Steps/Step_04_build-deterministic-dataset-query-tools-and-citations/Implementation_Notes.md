# Implementation Notes

- Capture durable findings learned during execution. Prefer short bullets with file paths, commands, and observed behavior.
- Added immutable query-result and dataset-citation domain schemas with scoped IDs, canonical SQL, engine/config identity, exact input snapshot lineage, output schema, result-artifact hash, selected columns, and cited row ranges.
- Extended the DuckDB sidecar query protocol to return pinned engine identity plus deterministic configuration, result-artifact, and overall result hashes; the TypeScript client independently recomputes and verifies both hashes.
- Added `DeterministicDatasetQueryService` with `Effect.Service` and `Effect.fn` typed boundaries. It reuses the allowlisted read-only SQL service, requires at least one citation, rejects truncated or mismatched evidence, rejects ambiguous duplicate selected columns, and persists immutable evidence before returning exact-value instructions.
- Added migration `0012_dataset_query_evidence` and `DatasetQueryEvidenceRepo` with transactional first-write/replay semantics, immutable database triggers, metadata-only history, scoped citation reopening, and full lineage validation. Replay ignores generated IDs and execution timestamps while returning the original stored immutable identity.
- Added the narrow Fred `struct.query-dataset` adapter and production API read routes for bounded query history and exact citation reopening.
- API evidence reads require a redacted bearer token, constant-time credential comparison, and project/workspace authorization before repository access.
- The sidecar rejects unused catalog bindings, and the tool requires one full-result citation per referenced snapshot so every exact cell exposed to Fred has complete immutable lineage.
- Added unit, PostgreSQL integration, API-dispatch, Fred-adapter, migration, tamper-detection, golden replay, malicious-prompt, scope, rollback, join-lineage, and live-sidecar coverage.

## Related Notes

- Step: [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_04_build-deterministic-dataset-query-tools-and-citations|STEP-04-04 Build Deterministic Dataset Query Tools and Citations]]
- Phase: [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Phase|Phase 04 structured datasets and deterministic sql]]
