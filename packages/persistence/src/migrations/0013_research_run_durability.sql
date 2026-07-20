-- Durable control state for the existing research_runs aggregate.
-- Product events remain the authoritative progress stream; checkpoints contain
-- only bounded serializable state and artifact references.

CREATE TABLE research_run_control (
  run_id UUID PRIMARY KEY REFERENCES research_runs(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  plan JSONB,
  planning_failure JSONB,
  checkpoint JSONB,
  budget_usage JSONB,
  cancellation_status TEXT NOT NULL DEFAULT 'none'
    CHECK (cancellation_status IN ('none', 'requested', 'acknowledged')),
  terminal_status TEXT
    CHECK (terminal_status IN ('completed', 'failed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (NOT (plan IS NOT NULL AND planning_failure IS NOT NULL)),
  CHECK (checkpoint IS NULL OR plan IS NOT NULL),
  CHECK (budget_usage IS NULL OR plan IS NOT NULL),
  CHECK (checkpoint IS NULL OR octet_length(checkpoint::text) <= 65536)
);
CREATE INDEX idx_research_run_control_scope
  ON research_run_control(workspace_id, project_id, run_id);

CREATE TABLE research_cancellation_requests (
  run_id UUID NOT NULL REFERENCES research_runs(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL CHECK (
    char_length(idempotency_key) BETWEEN 1 AND 512
  ),
  result TEXT NOT NULL CHECK (
    result IN ('cancelled', 'already-cancelled', 'terminal-no-op')
  ),
  event_id UUID REFERENCES event_journal(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (run_id, idempotency_key),
  CHECK (
    (result = 'cancelled' AND event_id IS NOT NULL)
    OR (result <> 'cancelled' AND event_id IS NULL)
  )
);
