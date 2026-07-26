ALTER TABLE sources
  ADD COLUMN workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;

CREATE FUNCTION assign_source_workspace() RETURNS trigger AS $$
BEGIN
  IF NEW.workspace_id IS NULL THEN
    SELECT workspace_id INTO NEW.workspace_id
    FROM projects
    WHERE id = NEW.project_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_assign_source_workspace
  BEFORE INSERT ON sources
  FOR EACH ROW
  EXECUTE FUNCTION assign_source_workspace();

UPDATE sources AS source
SET workspace_id = project.workspace_id
FROM projects AS project
WHERE project.id = source.project_id;

ALTER TABLE sources
  ALTER COLUMN workspace_id SET NOT NULL;

CREATE INDEX idx_sources_workspace_id ON sources(workspace_id);

CREATE TABLE project_sources (
  workspace_id UUID NOT NULL,
  project_id UUID NOT NULL,
  source_id UUID NOT NULL,
  attached_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (project_id, source_id),
  CONSTRAINT fk_project_sources_project
    FOREIGN KEY (workspace_id, project_id)
    REFERENCES projects(workspace_id, id)
    ON DELETE CASCADE,
  CONSTRAINT fk_project_sources_source
    FOREIGN KEY (source_id)
    REFERENCES sources(id)
    ON DELETE CASCADE
);

CREATE INDEX idx_project_sources_workspace_source
  ON project_sources(workspace_id, source_id);

INSERT INTO project_sources (workspace_id, project_id, source_id, attached_at)
SELECT source.workspace_id, source.project_id, source.id, source.created_at
FROM sources AS source;

CREATE FUNCTION attach_new_source_to_origin_project() RETURNS trigger AS $$
BEGIN
  INSERT INTO project_sources (workspace_id, project_id, source_id, attached_at)
  VALUES (NEW.workspace_id, NEW.project_id, NEW.id, NEW.created_at)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_attach_new_source_to_origin_project
  AFTER INSERT ON sources
  FOR EACH ROW
  EXECUTE FUNCTION attach_new_source_to_origin_project();
