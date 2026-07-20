-- Append-only, typed snapshots for durable findings and report revisions.
-- The normalized lifecycle tables remain the relational projection used by
-- provenance validation; these snapshots retain exact historical aggregates.

CREATE TABLE finding_snapshots (
  finding_id UUID PRIMARY KEY REFERENCES findings(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL,
  project_id UUID NOT NULL,
  run_id UUID NOT NULL,
  idempotency_key TEXT NOT NULL CHECK (
    char_length(idempotency_key) BETWEEN 1 AND 2048
  ),
  payload_hash TEXT NOT NULL CHECK (
    payload_hash ~ '^sha256:[0-9a-f]{64}$'
  ),
  snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  FOREIGN KEY (finding_id, workspace_id, project_id, run_id)
    REFERENCES findings(id, workspace_id, project_id, run_id)
    ON DELETE CASCADE,
  UNIQUE (workspace_id, project_id, idempotency_key)
);
CREATE INDEX idx_finding_snapshots_notebook
  ON finding_snapshots(workspace_id, project_id, created_at DESC, finding_id);

CREATE FUNCTION reject_durable_artifact_snapshot_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'durable artifact snapshots are append-only';
END;
$$;

CREATE TRIGGER finding_snapshots_append_only
BEFORE UPDATE OR DELETE ON finding_snapshots
FOR EACH ROW EXECUTE FUNCTION reject_durable_artifact_snapshot_mutation();
