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
  DROP CONSTRAINT source_import_batches_pkey;

WITH duplicate_batches AS (
  SELECT ctid,
         row_number() OVER (
           PARTITION BY workspace_id, client_batch_id
           ORDER BY project_id, created_at
         ) AS duplicate_number,
         workspace_id,
         project_id,
         client_batch_id
  FROM source_import_batches
), disambiguated_batches AS (
  SELECT *, md5(
    workspace_id::text || ':' || project_id::text || ':'
    || client_batch_id::text || ':' || duplicate_number::text
  ) AS digest
  FROM duplicate_batches
)
UPDATE source_import_batches AS batch
SET client_batch_id = (
  substr(digest, 1, 8) || '-' || substr(digest, 9, 4) || '-'
  || substr(digest, 13, 4) || '-' || substr(digest, 17, 4) || '-'
  || substr(digest, 21, 12)
)::uuid
FROM disambiguated_batches
WHERE batch.ctid = disambiguated_batches.ctid
  AND disambiguated_batches.duplicate_number > 1;

ALTER TABLE source_import_batches
  ALTER COLUMN project_id DROP NOT NULL,
  ADD CONSTRAINT fk_source_import_batches_workspace
    FOREIGN KEY (workspace_id)
    REFERENCES workspaces(id)
    ON DELETE CASCADE,
  ADD PRIMARY KEY (workspace_id, client_batch_id);

ALTER TABLE sources
  ALTER COLUMN project_id DROP NOT NULL;
