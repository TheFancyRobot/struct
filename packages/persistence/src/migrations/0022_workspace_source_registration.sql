CREATE OR REPLACE FUNCTION attach_new_source_to_origin_project() RETURNS trigger AS $$
BEGIN
  IF NEW.project_id IS NOT NULL THEN
    INSERT INTO project_sources (workspace_id, project_id, source_id, attached_at)
    VALUES (NEW.workspace_id, NEW.project_id, NEW.id, NEW.created_at)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

ALTER TABLE source_import_batches
  DROP CONSTRAINT fk_source_import_batches_project,
  DROP CONSTRAINT source_import_batches_pkey,
  ALTER COLUMN project_id DROP NOT NULL,
  ADD CONSTRAINT fk_source_import_batches_workspace
    FOREIGN KEY (workspace_id)
    REFERENCES workspaces(id)
    ON DELETE CASCADE,
  ADD PRIMARY KEY (workspace_id, client_batch_id);

ALTER TABLE sources
  ALTER COLUMN project_id DROP NOT NULL;
