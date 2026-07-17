# Validation Plan

## Acceptance Checks

- Confirm this deliverable is present, testable where applicable, and bounded to the step: The concrete contract for Dataset Assets Schemas and Versioned Catalog in the first planned domain, persistence, or documentation files so downstream implementation does not need to rediscover the boundary.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: update typed domain modules for `Dataset`, `Dataset Snapshot`, `Schema Family` in `packages/domain/src/dataset.ts`, `packages/domain/src/dataset-snapshot.ts`, `packages/domain/src/schema-family.ts`.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: The migration contract in `packages/persistence/src/migrations/0004_dataset_catalog.sql` and make the schema changes explicit about workspace scoping, immutable versioning, and foreign-key shape where relevant.
- The step leaves the next dependent step with a stable typed boundary, not a placeholder or undocumented assumption.

## Planned Verification

- Planned command once these packages exist: `bun test packages/domain packages/persistence` plus the nearest package-level `bun run typecheck`.
- Plan a fresh-database migration smoke test and an upgrade-path test so the new schema contract is reversible and auditable.

## Edge Cases

- Partial progress, retries, or restarts should leave this step in a typed, inspectable state rather than a silent half-success.
- Version drift, missing required fields, or ambiguous identity rules should be called out in the contract instead of deferred to implementation guesswork.
- Read-only violations, schema mismatch, oversized result sets, and engine/resource limits should fail before producing misleading results.

## Regression Expectations

- This step should remain a clean successor to [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_06_test-large-tree-refresh-failures-and-recovery|STEP-03-06 Test Large-Tree Refresh Failures and Recovery]] rather than reworking already-planned scope upstream.
- Do not regress document and directory provenance while adding structured-data paths.
- Keep query history, result snapshots, and citations stable enough for later hybrid research and report generation.
- Do not allow convenience features to bypass SQL validation, timeouts, or output bounds.

## Security / Observability / Evaluation Focus

- Explicitly guard against unsafe pragmas, file access, oversized materialization, and schema hallucination.
- Preserve deterministic result hashes, row limits, and stable source-snapshot references.
- Extend evaluation with exact computation and prompt-injection cases tied to structured data.
- Keep exact-computation outputs tied to query text, result snapshots, and stable dataset citations so later synthesis cannot blur them.

## Related Notes

- Step: [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_01_define-dataset-assets-schemas-and-versioned-catalog|STEP-04-01 Define Dataset Assets Schemas and Versioned Catalog]]
- Phase: [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Phase|Phase 04 structured datasets and deterministic sql]]
