# Execution Brief

## Exact Outcome

- Produce the concrete contracts, artifacts, and bounded implementation/design surfaces for Dataset Assets Schemas and Versioned Catalog that this step is responsible for before any broader follow-on work begins.

## Prerequisites

- Re-read [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Phase|Phase 04 structured datasets and deterministic sql]] and confirm the step still matches the current roadmap sequence.
- Confirm the handoff from [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_06_test-large-tree-refresh-failures-and-recovery|STEP-03-06 Test Large-Tree Refresh Failures and Recovery]] before widening scope.
- Keep deterministic work in typed Effect services, repositories, and tools; reserve Fred for agentic orchestration only.
- Treat the listed files as planned starting points; create only the smallest set needed to land the slice.

## Planned Starting Files

- These paths may not exist yet; use them as the first bounded implementation or design surface.
- `packages/domain/src/dataset.ts`
- `packages/domain/src/dataset-snapshot.ts`
- `packages/domain/src/schema-family.ts`
- `packages/persistence/src/migrations/0004_dataset_catalog.sql`
- `packages/persistence/src/repositories/datasets.ts`

## Required Reading

- [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Phase|Phase 04 structured datasets and deterministic sql]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
- [[01_Architecture/System_Overview|System Overview]]
- [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_06_test-large-tree-refresh-failures-and-recovery|STEP-03-06 Test Large-Tree Refresh Failures and Recovery]]
- `docs/product-brief.md` sections 9-12, 18-25, 26-27, and 29-31.

## Concrete Deliverables

- Define the concrete contract for Dataset Assets Schemas and Versioned Catalog in the first planned domain, persistence, or documentation files so downstream implementation does not need to rediscover the boundary.
- Define or update typed domain modules for `Dataset`, `Dataset Snapshot`, `Schema Family` in `packages/domain/src/dataset.ts`, `packages/domain/src/dataset-snapshot.ts`, `packages/domain/src/schema-family.ts`.
- Write the migration contract in `packages/persistence/src/migrations/0004_dataset_catalog.sql` and make the schema changes explicit about workspace scoping, immutable versioning, and foreign-key shape where relevant.
- Add repository boundaries in `packages/persistence/src/repositories/datasets.ts` that translate between storage records and typed domain objects.

## Smallest Bounded Checklist

- First, define the concrete contract for Dataset Assets Schemas and Versioned Catalog in the first planned domain, persistence, or documentation files so downstream implementation does not need to rediscover the boundary.
- Then, define or update typed domain modules for `Dataset`, `Dataset Snapshot`, `Schema Family` in `packages/domain/src/dataset.ts`, `packages/domain/src/dataset-snapshot.ts`, `packages/domain/src/schema-family.ts`.
- Next, write the migration contract in `packages/persistence/src/migrations/0004_dataset_catalog.sql` and make the schema changes explicit about workspace scoping, immutable versioning, and foreign-key shape where relevant.
- Finish by leaving one observable typed path—test, route, worker flow, or UI state—that proves the slice is ready for the next dependent step.

## Constraints and Non-Goals

- All exact answers must come from deterministic dataset tooling rather than model arithmetic or semantic guesswork.
- Schema-family grouping, Parquet materialization, and query provenance must preserve lineage to original files and stable record identity.
- SQL remains allowlisted, read-only, resource-bounded, and fully inspectable.

## Related Notes

- Step: [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_01_define-dataset-assets-schemas-and-versioned-catalog|STEP-04-01 Define Dataset Assets Schemas and Versioned Catalog]]
- Phase: [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Phase|Phase 04 structured datasets and deterministic sql]]
