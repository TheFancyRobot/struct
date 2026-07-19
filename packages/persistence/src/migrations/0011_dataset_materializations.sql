CREATE TABLE dataset_materialization_jobs (
  job_id UUID PRIMARY KEY REFERENCES job_queue(id) ON DELETE CASCADE,
  snapshot_id UUID NOT NULL UNIQUE REFERENCES dataset_snapshots(id) ON DELETE CASCADE,
  lease_token UUID,
  lease_expires_at TIMESTAMPTZ,
  CHECK (
    (lease_token IS NULL AND lease_expires_at IS NULL)
    OR (lease_token IS NOT NULL AND lease_expires_at IS NOT NULL)
  )
);

CREATE TABLE dataset_materializations (
  snapshot_id UUID PRIMARY KEY REFERENCES dataset_snapshots(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL,
  project_id UUID NOT NULL,
  dataset_id UUID NOT NULL,
  parquet_ref TEXT NOT NULL CHECK (
    parquet_ref ~ '^artifact://sha256/[a-f0-9]{64}$'
  ),
  parquet_hash TEXT NOT NULL CHECK (
    parquet_hash ~ '^sha256:[a-f0-9]{64}$'
  ),
  parquet_byte_length BIGINT NOT NULL CHECK (parquet_byte_length > 0),
  profile_ref TEXT NOT NULL CHECK (
    profile_ref ~ '^artifact://sha256/[a-f0-9]{64}$'
  ),
  profile_hash TEXT NOT NULL CHECK (
    profile_hash ~ '^sha256:[a-f0-9]{64}$'
  ),
  profile JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_dataset_materialization_snapshot
    FOREIGN KEY (snapshot_id, dataset_id, workspace_id, project_id)
    REFERENCES dataset_snapshots(id, dataset_id, workspace_id, project_id)
    ON DELETE CASCADE
);

CREATE INDEX idx_dataset_materialization_jobs_lease_expiry
  ON dataset_materialization_jobs (lease_expires_at)
  WHERE lease_token IS NOT NULL;

CREATE TRIGGER dataset_materializations_immutable
  BEFORE UPDATE ON dataset_materializations
  FOR EACH ROW EXECUTE FUNCTION reject_dataset_catalog_update();
