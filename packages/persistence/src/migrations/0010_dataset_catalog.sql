CREATE TABLE dataset_assets (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL,
  project_id UUID NOT NULL,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 255),
  lifecycle_status TEXT NOT NULL CHECK (lifecycle_status IN ('active', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_dataset_assets_scope UNIQUE (id, workspace_id, project_id),
  CONSTRAINT uq_dataset_assets_project_name UNIQUE (project_id, name),
  CONSTRAINT fk_dataset_assets_project
    FOREIGN KEY (workspace_id, project_id)
    REFERENCES projects(workspace_id, id)
    ON DELETE CASCADE
);

CREATE TABLE dataset_schema_families (
  id UUID PRIMARY KEY,
  dataset_id UUID NOT NULL,
  workspace_id UUID NOT NULL,
  project_id UUID NOT NULL,
  schema_hash TEXT NOT NULL CHECK (schema_hash ~ '^sha256:[0-9a-f]{64}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_dataset_schema_families_scope
    UNIQUE (id, dataset_id, workspace_id, project_id),
  CONSTRAINT uq_dataset_schema_families_hash UNIQUE (dataset_id, schema_hash),
  CONSTRAINT fk_dataset_schema_families_dataset
    FOREIGN KEY (dataset_id, workspace_id, project_id)
    REFERENCES dataset_assets(id, workspace_id, project_id)
    ON DELETE CASCADE
);

CREATE TABLE dataset_field_schemas (
  schema_family_id UUID NOT NULL REFERENCES dataset_schema_families(id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 255),
  source_type TEXT NOT NULL CHECK (length(source_type) BETWEEN 1 AND 255),
  logical_type TEXT NOT NULL
    CHECK (logical_type IN ('boolean', 'integer', 'decimal', 'string', 'date', 'timestamp', 'json')),
  nullable BOOLEAN NOT NULL,
  PRIMARY KEY (schema_family_id, ordinal),
  CONSTRAINT uq_dataset_field_schemas_name UNIQUE (schema_family_id, name)
);

CREATE TABLE dataset_snapshots (
  id UUID PRIMARY KEY,
  dataset_id UUID NOT NULL,
  workspace_id UUID NOT NULL,
  project_id UUID NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  schema_family_id UUID NOT NULL,
  previous_snapshot_id UUID,
  content_hash TEXT NOT NULL CHECK (content_hash ~ '^sha256:[0-9a-f]{64}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_dataset_snapshots_scope
    UNIQUE (id, dataset_id, workspace_id, project_id),
  CONSTRAINT uq_dataset_snapshots_version UNIQUE (dataset_id, version),
  CONSTRAINT uq_dataset_snapshots_content UNIQUE (dataset_id, content_hash),
  CONSTRAINT fk_dataset_snapshots_dataset
    FOREIGN KEY (dataset_id, workspace_id, project_id)
    REFERENCES dataset_assets(id, workspace_id, project_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_dataset_snapshots_schema
    FOREIGN KEY (schema_family_id, dataset_id, workspace_id, project_id)
    REFERENCES dataset_schema_families(id, dataset_id, workspace_id, project_id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_dataset_snapshots_previous
    FOREIGN KEY (previous_snapshot_id, dataset_id, workspace_id, project_id)
    REFERENCES dataset_snapshots(id, dataset_id, workspace_id, project_id)
    ON DELETE RESTRICT,
  CHECK (
    (version = 1 AND previous_snapshot_id IS NULL)
    OR (version > 1 AND previous_snapshot_id IS NOT NULL)
  )
);

CREATE TABLE dataset_snapshot_sources (
  snapshot_id UUID NOT NULL,
  dataset_id UUID NOT NULL,
  workspace_id UUID NOT NULL,
  project_id UUID NOT NULL,
  ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
  source_id UUID NOT NULL,
  source_version_id UUID NOT NULL,
  content_hash TEXT NOT NULL CHECK (content_hash ~ '^sha256:[0-9a-f]{64}$'),
  PRIMARY KEY (snapshot_id, ordinal),
  CONSTRAINT uq_dataset_snapshot_source_version UNIQUE (snapshot_id, source_version_id),
  CONSTRAINT fk_dataset_snapshot_sources_snapshot
    FOREIGN KEY (snapshot_id, dataset_id, workspace_id, project_id)
    REFERENCES dataset_snapshots(id, dataset_id, workspace_id, project_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_dataset_snapshot_sources_project
    FOREIGN KEY (workspace_id, project_id)
    REFERENCES projects(workspace_id, id)
    ON DELETE CASCADE,
  CONSTRAINT fk_dataset_snapshot_sources_source
    FOREIGN KEY (project_id, source_id)
    REFERENCES sources(project_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_dataset_snapshot_sources_version
    FOREIGN KEY (source_id, source_version_id)
    REFERENCES source_versions(source_id, id)
    ON DELETE RESTRICT
);

CREATE FUNCTION reject_dataset_catalog_update() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'immutable dataset catalog rows cannot be updated';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER dataset_schema_families_immutable
  BEFORE UPDATE ON dataset_schema_families
  FOR EACH ROW EXECUTE FUNCTION reject_dataset_catalog_update();
CREATE TRIGGER dataset_field_schemas_immutable
  BEFORE UPDATE ON dataset_field_schemas
  FOR EACH ROW EXECUTE FUNCTION reject_dataset_catalog_update();
CREATE TRIGGER dataset_snapshots_immutable
  BEFORE UPDATE ON dataset_snapshots
  FOR EACH ROW EXECUTE FUNCTION reject_dataset_catalog_update();
CREATE TRIGGER dataset_snapshot_sources_immutable
  BEFORE UPDATE ON dataset_snapshot_sources
  FOR EACH ROW EXECUTE FUNCTION reject_dataset_catalog_update();
