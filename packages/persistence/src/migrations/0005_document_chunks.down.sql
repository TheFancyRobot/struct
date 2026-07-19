-- Roll back immutable document chunks before removing supporting lineage keys.
DROP TABLE IF EXISTS document_chunks;
DROP TABLE IF EXISTS documents;
DROP INDEX IF EXISTS uq_source_versions_source_id_id;
DROP INDEX IF EXISTS uq_sources_project_id_id;
DROP INDEX IF EXISTS uq_projects_workspace_id_id;
