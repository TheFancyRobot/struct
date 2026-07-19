ALTER TABLE directory_ingestion_jobs
  ADD COLUMN directory_root_id UUID REFERENCES directory_roots(id) ON DELETE RESTRICT;

UPDATE directory_ingestion_jobs directory
SET directory_root_id = snapshot.directory_root_id
FROM directory_snapshots snapshot
WHERE snapshot.id = directory.snapshot_id;

ALTER TABLE directory_ingestion_jobs
  ALTER COLUMN directory_root_id SET NOT NULL;

CREATE TABLE directory_ingestion_commands (
  job_id UUID NOT NULL REFERENCES directory_ingestion_jobs(job_id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL CHECK (length(idempotency_key) BETWEEN 1 AND 512),
  command TEXT NOT NULL CHECK (command IN ('pause', 'resume', 'retry', 'cancel')),
  resulting_status TEXT NOT NULL
    CHECK (resulting_status IN ('ready', 'running', 'paused', 'completed', 'cancelled', 'exhausted')),
  event_id UUID NOT NULL UNIQUE REFERENCES event_journal(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (job_id, idempotency_key)
);
