CREATE TABLE query_result_snapshots (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL,
  project_id UUID NOT NULL,
  request_hash TEXT NOT NULL CHECK (request_hash ~ '^sha256:[0-9a-f]{64}$'),
  protocol_version TEXT NOT NULL CHECK (protocol_version = '1'),
  engine_version TEXT NOT NULL CHECK (engine_version = 'duckdb-1.5.4'),
  engine_adapter_version TEXT NOT NULL CHECK (engine_adapter_version = '@duckdb/node-api@1.5.4-r.1'),
  execution_policy_version INTEGER NOT NULL CHECK (execution_policy_version = 1),
  engine_config_hash TEXT NOT NULL CHECK (engine_config_hash ~ '^sha256:[0-9a-f]{64}$'),
  canonical_sql TEXT NOT NULL CHECK (length(canonical_sql) BETWEEN 1 AND 32768),
  dataset_snapshots JSONB NOT NULL,
  schema_hash TEXT NOT NULL CHECK (schema_hash ~ '^sha256:[0-9a-f]{64}$'),
  result_hash TEXT NOT NULL CHECK (result_hash ~ '^sha256:[0-9a-f]{64}$'),
  result_artifact_hash TEXT NOT NULL CHECK (result_artifact_hash ~ '^sha256:[0-9a-f]{64}$'),
  columns JSONB NOT NULL,
  rows JSONB NOT NULL,
  row_count INTEGER NOT NULL CHECK (row_count >= 0),
  truncated BOOLEAN NOT NULL,
  executed_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_query_result_snapshots_request
    UNIQUE (workspace_id, project_id, request_hash),
  CONSTRAINT uq_query_result_snapshots_scope
    UNIQUE (id, workspace_id, project_id),
  CONSTRAINT fk_query_result_snapshots_project
    FOREIGN KEY (workspace_id, project_id)
    REFERENCES projects(workspace_id, id)
    ON DELETE CASCADE
);

CREATE INDEX idx_query_result_snapshots_history
  ON query_result_snapshots (workspace_id, project_id, created_at DESC, id DESC);

CREATE TABLE dataset_citations (
  id UUID PRIMARY KEY,
  query_result_snapshot_id UUID NOT NULL,
  workspace_id UUID NOT NULL,
  project_id UUID NOT NULL,
  dataset_id UUID NOT NULL,
  dataset_snapshot_id UUID NOT NULL,
  schema_hash TEXT NOT NULL CHECK (schema_hash ~ '^sha256:[0-9a-f]{64}$'),
  parquet_digest TEXT NOT NULL CHECK (parquet_digest ~ '^[0-9a-f]{64}$'),
  result_hash TEXT NOT NULL CHECK (result_hash ~ '^sha256:[0-9a-f]{64}$'),
  result_artifact_hash TEXT NOT NULL CHECK (result_artifact_hash ~ '^sha256:[0-9a-f]{64}$'),
  canonical_sql TEXT NOT NULL CHECK (length(canonical_sql) BETWEEN 1 AND 32768),
  selected_columns JSONB NOT NULL,
  row_start INTEGER NOT NULL CHECK (row_start >= 0),
  row_end_exclusive INTEGER NOT NULL CHECK (row_end_exclusive >= row_start),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_dataset_citations_identity
    UNIQUE (
      query_result_snapshot_id,
      dataset_snapshot_id,
      selected_columns,
      row_start,
      row_end_exclusive
    ),
  CONSTRAINT fk_dataset_citations_result
    FOREIGN KEY (query_result_snapshot_id, workspace_id, project_id)
    REFERENCES query_result_snapshots(id, workspace_id, project_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_dataset_citations_snapshot
    FOREIGN KEY (dataset_snapshot_id, dataset_id, workspace_id, project_id)
    REFERENCES dataset_snapshots(id, dataset_id, workspace_id, project_id)
    ON DELETE RESTRICT
);

CREATE INDEX idx_dataset_citations_result
  ON dataset_citations (query_result_snapshot_id, id);

CREATE TRIGGER query_result_snapshots_immutable
  BEFORE UPDATE ON query_result_snapshots
  FOR EACH ROW EXECUTE FUNCTION reject_dataset_catalog_update();

CREATE TRIGGER dataset_citations_immutable
  BEFORE UPDATE ON dataset_citations
  FOR EACH ROW EXECUTE FUNCTION reject_dataset_catalog_update();
