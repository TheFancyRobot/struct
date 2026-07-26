ALTER TABLE dataset_snapshot_sources
  DROP CONSTRAINT fk_dataset_snapshot_sources_source;

ALTER TABLE dataset_snapshot_sources
  ADD CONSTRAINT fk_dataset_snapshot_sources_source
  FOREIGN KEY (workspace_id, source_id)
  REFERENCES sources(workspace_id, id)
  ON DELETE RESTRICT;
