-- STEP-01-04: deterministic text retrieval and persisted research results.

CREATE TABLE source_text_index (
  source_version_id UUID PRIMARY KEY REFERENCES source_versions(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  search_vector TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_source_text_index_workspace_project
  ON source_text_index(workspace_id, project_id);
CREATE INDEX idx_source_text_index_search_vector
  ON source_text_index USING GIN(search_vector);

CREATE TABLE research_run_results (
  run_id UUID PRIMARY KEY REFERENCES research_runs(id) ON DELETE CASCADE,
  answer TEXT NOT NULL,
  citations JSONB NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
