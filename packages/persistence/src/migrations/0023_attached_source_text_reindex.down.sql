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
  SELECT NEW.id, project.workspace_id, project.id, NEW.artifact_ref, NEW.content_hash
  FROM sources source
  JOIN projects project ON project.id = source.project_id
  WHERE source.id = NEW.source_id
  ON CONFLICT (source_version_id) DO NOTHING;
  RETURN NEW;
END;
$$;
