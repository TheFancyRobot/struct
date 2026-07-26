ALTER TABLE dataset_snapshot_sources
  DROP CONSTRAINT fk_dataset_snapshot_sources_source;

ALTER TABLE dataset_snapshot_sources
  ADD CONSTRAINT fk_dataset_snapshot_sources_source
  FOREIGN KEY (project_id, source_id)
  REFERENCES sources(project_id, id)
  ON DELETE RESTRICT;
