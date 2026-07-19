-- STEP-01-04: deterministic text retrieval and persisted research results.

CREATE TABLE source_text_index (
  source_version_id UUID PRIMARY KEY REFERENCES source_versions(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  search_vector TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_source_text_index_search_vector
  ON source_text_index USING GIN(search_vector);

-- Every immutable SourceVersion has durable indexing state. Existing rows are
-- queued during upgrade; future rows are queued by the trigger. The worker
-- reconstructs text from the content-addressed manifest/normalized artifacts.
CREATE TABLE source_text_reindex_jobs (
  source_version_id UUID PRIMARY KEY REFERENCES source_versions(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  artifact_ref TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in-progress', 'completed', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  last_error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_source_text_reindex_jobs_status
  ON source_text_reindex_jobs(status, updated_at, source_version_id);

CREATE OR REPLACE FUNCTION enqueue_source_text_reindex()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO source_text_reindex_jobs (
    source_version_id,
    workspace_id,
    project_id,
    artifact_ref,
    content_hash
  )
  SELECT NEW.id, p.workspace_id, p.id, NEW.artifact_ref, NEW.content_hash
  FROM sources s
  JOIN projects p ON p.id = s.project_id
  WHERE s.id = NEW.source_id
  ON CONFLICT (source_version_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER source_versions_enqueue_text_reindex
AFTER INSERT ON source_versions
FOR EACH ROW EXECUTE FUNCTION enqueue_source_text_reindex();

INSERT INTO source_text_reindex_jobs (
  source_version_id,
  workspace_id,
  project_id,
  artifact_ref,
  content_hash
)
SELECT sv.id, p.workspace_id, p.id, sv.artifact_ref, sv.content_hash
FROM source_versions sv
JOIN sources s ON s.id = sv.source_id
JOIN projects p ON p.id = s.project_id
ON CONFLICT (source_version_id) DO NOTHING;

CREATE TABLE research_run_results (
  run_id UUID PRIMARY KEY REFERENCES research_runs(id) ON DELETE CASCADE,
  answer TEXT NOT NULL,
  citations JSONB NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
