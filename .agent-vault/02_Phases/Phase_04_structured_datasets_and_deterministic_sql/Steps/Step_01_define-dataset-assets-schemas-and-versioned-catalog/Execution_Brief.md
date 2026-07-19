# Execution Brief

## Exact Outcome

- Add the typed, workspace-scoped catalog that distinguishes logical datasets from immutable dataset snapshots and schema families, while preserving source-version lineage.

## Prerequisites

- PHASE-03 and STEP-03-06 are completed; use their immutable source/version and artifact patterns.
- Read the parent phase, Domain Model, DEC-0005, DEC-0006, and DEC-0009.

## Deliverables

- Define branded identifiers and `Schema` domain contracts for dataset, snapshot, schema family, field schema, source-version lineage, content hash, and lifecycle status.
- Add the next sequential reversible PostgreSQL migration; do not reuse the obsolete planned migration number.
- Add workspace-scoped repositories with decoded rows, immutable snapshot insertion, deterministic ordering, uniqueness constraints, and transactional lineage checks.
- Implement Effect business services with `Effect.Service`, explicit dependencies, `Effect.fn` operations, `Config` at runtime boundaries, and specific serializable `Schema.TaggedError` failures.
- Export the new contracts and add unit plus real-PostgreSQL repository coverage.

## Constraints and Non-Goals

- Bun remains the sole host runtime. This step does not start DuckDB, materialize Parquet, query data, or add UI.
- There are no legacy databases or compatibility migrations; implement only the current greenfield schema.
- Preserve `Option` internally, avoid unchecked assertions, thrown domain errors, generic error collapsing, and cross-workspace lookup.

## Handoff

- STEP-04-02 receives stable snapshot IDs, schema-family IDs, source-version lineage, content hashes, and repository/service APIs.

## Related Notes

- Step: [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_01_define-dataset-assets-schemas-and-versioned-catalog|STEP-04-01 Define Dataset Assets Schemas and Versioned Catalog]]
- Phase: [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Phase|Phase 04 structured datasets and deterministic sql]]
