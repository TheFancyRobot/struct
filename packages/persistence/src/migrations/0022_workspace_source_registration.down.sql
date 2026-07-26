DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM sources WHERE project_id IS NULL)
    OR EXISTS (SELECT 1 FROM source_import_batches WHERE project_id IS NULL) THEN
    RAISE EXCEPTION 'cannot roll back 0022 after workspace-level source imports exist';
  END IF;
END;
$$;

ALTER TABLE sources
  ALTER COLUMN project_id SET NOT NULL;

ALTER TABLE source_import_batches
  DROP CONSTRAINT fk_source_import_batches_workspace,
  DROP CONSTRAINT source_import_batches_pkey,
  ALTER COLUMN project_id SET NOT NULL,
  ADD CONSTRAINT fk_source_import_batches_project
    FOREIGN KEY (workspace_id, project_id)
    REFERENCES projects(workspace_id, id)
    ON DELETE CASCADE,
  ADD PRIMARY KEY (workspace_id, project_id, client_batch_id);

CREATE OR REPLACE FUNCTION attach_new_source_to_origin_project() RETURNS trigger AS $$
BEGIN
  INSERT INTO project_sources (workspace_id, project_id, source_id, attached_at)
  VALUES (NEW.workspace_id, NEW.project_id, NEW.id, NEW.created_at)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
