DROP TRIGGER IF EXISTS trg_attach_new_source_to_origin_project ON sources;
DROP FUNCTION IF EXISTS attach_new_source_to_origin_project();
DROP TABLE IF EXISTS project_sources;
DROP INDEX IF EXISTS idx_sources_workspace_id;
DROP TRIGGER IF EXISTS trg_assign_source_workspace ON sources;
DROP FUNCTION IF EXISTS assign_source_workspace();
ALTER TABLE sources DROP COLUMN IF EXISTS workspace_id;
