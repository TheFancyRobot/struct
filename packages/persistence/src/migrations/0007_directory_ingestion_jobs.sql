ALTER TABLE job_queue
  ADD COLUMN lease_token UUID,
  ADD COLUMN lease_expires_at TIMESTAMPTZ;

CREATE TABLE directory_ingestion_jobs (
  job_id UUID PRIMARY KEY REFERENCES job_queue(id) ON DELETE CASCADE,
  snapshot_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'ready'
    CHECK (status IN ('ready', 'running', 'paused', 'completed', 'cancelled', 'exhausted')),
  next_checkpoint_sequence BIGINT NOT NULL DEFAULT 1 CHECK (next_checkpoint_sequence > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE directory_ingestion_idempotency_results (
  job_id UUID NOT NULL REFERENCES directory_ingestion_jobs(job_id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  attempt INTEGER NOT NULL CHECK (attempt > 0),
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (job_id, idempotency_key)
);

CREATE TABLE directory_ingestion_work_records (
  job_id UUID NOT NULL REFERENCES directory_ingestion_jobs(job_id) ON DELETE CASCADE,
  entry_id UUID NOT NULL,
  idempotency_key TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('completed', 'unresolved')),
  content_key TEXT,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (job_id, idempotency_key),
  FOREIGN KEY (job_id, idempotency_key)
    REFERENCES directory_ingestion_idempotency_results(job_id, idempotency_key),
  CHECK (
    (outcome = 'completed' AND content_key ~ '^artifact://sha256/[0-9a-f]{64}$')
    OR (outcome = 'unresolved' AND content_key IS NULL)
  )
);

CREATE TABLE directory_ingestion_checkpoints (
  job_id UUID NOT NULL REFERENCES directory_ingestion_jobs(job_id) ON DELETE CASCADE,
  sequence BIGINT NOT NULL CHECK (sequence > 0),
  entry_id UUID NOT NULL,
  idempotency_key TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('completed', 'unresolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (job_id, sequence),
  UNIQUE (job_id, idempotency_key),
  FOREIGN KEY (job_id, idempotency_key)
    REFERENCES directory_ingestion_idempotency_results(job_id, idempotency_key)
);

CREATE INDEX idx_job_queue_directory_claim
  ON job_queue(status, lease_expires_at, created_at)
  WHERE entity_type = 'directory-ingestion';
