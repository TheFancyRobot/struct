DROP INDEX IF EXISTS idx_job_queue_directory_claim;
DROP TABLE IF EXISTS directory_ingestion_checkpoints;
DROP TABLE IF EXISTS directory_ingestion_work_records;
DROP TABLE IF EXISTS directory_ingestion_idempotency_results;
DROP TABLE IF EXISTS directory_ingestion_jobs;
ALTER TABLE job_queue
  DROP COLUMN IF EXISTS lease_expires_at,
  DROP COLUMN IF EXISTS lease_token;
