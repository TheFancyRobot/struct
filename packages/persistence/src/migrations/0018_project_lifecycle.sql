-- Migration 0018: add project-lifecycle uniqueness and idempotency state.

CREATE UNIQUE INDEX projects_workspace_name_ci_idx
  ON projects (workspace_id, lower(name));

CREATE TABLE project_idempotency_keys (
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (workspace_id, idempotency_key)
);

CREATE INDEX project_idempotency_keys_project_idx
  ON project_idempotency_keys (project_id);
