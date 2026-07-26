CREATE TABLE source_import_batches (
  workspace_id UUID NOT NULL,
  project_id UUID NOT NULL,
  client_batch_id UUID NOT NULL,
  request_hash TEXT NOT NULL CHECK (
    request_hash ~ '^sha256:[0-9a-f]{64}$'
  ),
  response JSONB,
  created_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (workspace_id, project_id, client_batch_id),
  CONSTRAINT fk_source_import_batches_project
    FOREIGN KEY (workspace_id, project_id)
    REFERENCES projects(workspace_id, id)
    ON DELETE CASCADE
);
