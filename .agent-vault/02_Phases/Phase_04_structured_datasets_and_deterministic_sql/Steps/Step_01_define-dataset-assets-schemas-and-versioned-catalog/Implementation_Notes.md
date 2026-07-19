# Implementation Notes

- Implemented the catalog in the existing domain and persistence packages; no new runtime or package was introduced.
- Domain contracts brand dataset, schema-family, snapshot, source, and source-version identities; hashes reuse `Sha256Digest` and optional previous lineage uses `Option`.
- Migration `0010_dataset_catalog` creates workspace-scoped dataset assets, schema families, ordered fields, immutable snapshots, and ordered source-version lineage. Composite foreign keys enforce project/workspace ownership and update triggers reject immutable metadata changes.
- `DatasetCatalogRepo` uses `Effect.Service` and `Effect.fn`, decodes PostgreSQL rows through Effect Schema, performs aggregate writes transactionally, explicitly distinguishes exact replay from immutable conflict, and returns stable version ordering.
- Root self-review fixed conflict classification for a reused schema-family or snapshot ID with changed immutable metadata: conflict lookup now checks the colliding ID as well as content-derived uniqueness keys, so these cases return `DatasetCatalogConflictError` rather than a misleading scope failure.
- PR review added a workspace/project/dataset-scoped `getSchemaFamily` operation so restarted STEP-04-02 workers can reconstruct ordered fields and logical types from a persisted snapshot's `schemaFamilyId`.
- Repository failures expose bounded serializable catalog errors without SQL text, connection details, or credentials.
- No DuckDB, Parquet, SQL execution, UI, legacy database, or compatibility work was added.

## Related Notes

- Step: [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_01_define-dataset-assets-schemas-and-versioned-catalog|STEP-04-01 Define Dataset Assets Schemas and Versioned Catalog]]
- Phase: [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Phase|Phase 04 structured datasets and deterministic sql]]
