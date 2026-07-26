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
  SELECT NEW.id, attached.workspace_id, attached.project_id,
         NEW.artifact_ref, NEW.content_hash
  FROM project_sources attached
  WHERE attached.source_id = NEW.source_id
  ORDER BY attached.attached_at ASC, attached.project_id ASC
  LIMIT 1
  ON CONFLICT (source_version_id) DO NOTHING;
  RETURN NEW;
END;
$$;
