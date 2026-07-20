-- Canonical greenfield persistence shape for durable claims, findings, and reports.
-- Immutable evidence and authored revisions are append-only. Mutable source
-- identities are never accepted as evidence targets.

CREATE TABLE durable_claims (
  id UUID PRIMARY KEY,
  citation_id UUID NOT NULL UNIQUE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  run_id UUID NOT NULL REFERENCES research_runs(id) ON DELETE RESTRICT,
  claim_signature TEXT NOT NULL CHECK (
    claim_signature ~ '^sha256:[0-9a-f]{64}$'
  ),
  origin JSONB NOT NULL,
  support_state TEXT NOT NULL CHECK (
    support_state IN ('supported', 'unsupported')
  ),
  evidence_mode TEXT CHECK (
    evidence_mode IN ('document', 'dataset', 'recursive', 'hybrid')
  ),
  unsupported_reason TEXT CHECK (
    unsupported_reason IS NULL
      OR char_length(unsupported_reason) BETWEEN 1 AND 65536
  ),
  citation_state TEXT NOT NULL CHECK (
    citation_state IN (
      'draft',
      'valid',
      'stale',
      'broken',
      'unauthorized',
      'incompatible',
      'superseded',
      'publishable'
    )
  ),
  citation_revision INTEGER NOT NULL CHECK (citation_revision >= 0),
  superseded_by_citation_id UUID,
  citation_last_idempotency_key TEXT CHECK (
    citation_last_idempotency_key IS NULL
      OR char_length(citation_last_idempotency_key) BETWEEN 1 AND 2048
  ),
  citation_updated_at TIMESTAMPTZ NOT NULL,
  current_revision INTEGER NOT NULL CHECK (current_revision >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    support_state <> 'unsupported' OR citation_state <> 'publishable'
  ),
  CHECK (
    (support_state = 'supported'
      AND evidence_mode IS NOT NULL
      AND unsupported_reason IS NULL)
    OR
    (support_state = 'unsupported'
      AND evidence_mode IS NULL
      AND char_length(trim(unsupported_reason)) > 0)
  ),
  CHECK (
    (citation_state = 'superseded')
      = (superseded_by_citation_id IS NOT NULL)
  ),
  CHECK (
    superseded_by_citation_id IS NULL
      OR superseded_by_citation_id <> citation_id
  ),
  FOREIGN KEY (superseded_by_citation_id)
    REFERENCES durable_claims(citation_id) ON DELETE RESTRICT,
  UNIQUE (id, claim_signature),
  UNIQUE (id, workspace_id, project_id, run_id)
);
CREATE INDEX idx_durable_claims_scope
  ON durable_claims(workspace_id, project_id, run_id);

CREATE TABLE claim_revisions (
  claim_id UUID NOT NULL REFERENCES durable_claims(id) ON DELETE CASCADE,
  id UUID NOT NULL UNIQUE,
  revision INTEGER NOT NULL CHECK (revision >= 0),
  content TEXT NOT NULL CHECK (char_length(trim(content)) > 0),
  authorship_kind TEXT NOT NULL CHECK (
    authorship_kind IN ('generated', 'user')
  ),
  authorship JSONB NOT NULL,
  idempotency_key TEXT NOT NULL CHECK (
    char_length(idempotency_key) BETWEEN 1 AND 2048
  ),
  created_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (claim_id, revision),
  UNIQUE (claim_id, idempotency_key),
  UNIQUE (claim_id, id, revision)
);

CREATE TABLE claim_evidence (
  claim_id UUID NOT NULL REFERENCES durable_claims(id) ON DELETE CASCADE,
  evidence_id TEXT NOT NULL CHECK (
    evidence_id ~ '^sha256:[0-9a-f]{64}$'
  ),
  claim_signature TEXT NOT NULL CHECK (
    claim_signature ~ '^sha256:[0-9a-f]{64}$'
  ),
  evidence_kind TEXT NOT NULL CHECK (
    evidence_kind IN ('document', 'dataset', 'recursive')
  ),
  stance TEXT NOT NULL CHECK (stance = 'supports'),
  evidence_snapshot JSONB NOT NULL,
  PRIMARY KEY (claim_id, evidence_id),
  FOREIGN KEY (claim_id, claim_signature)
    REFERENCES durable_claims(id, claim_signature) ON DELETE CASCADE
);

CREATE FUNCTION reject_claim_evidence_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'claim evidence is immutable';
END;
$$;

CREATE TRIGGER claim_evidence_append_only
BEFORE UPDATE OR DELETE ON claim_evidence
FOR EACH ROW EXECUTE FUNCTION reject_claim_evidence_mutation();

CREATE TABLE durable_claim_snapshots (
  claim_id UUID PRIMARY KEY REFERENCES durable_claims(id) ON DELETE CASCADE,
  payload_hash TEXT NOT NULL CHECK (
    payload_hash ~ '^sha256:[0-9a-f]{64}$'
  ),
  snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TRIGGER durable_claim_snapshots_append_only
BEFORE UPDATE OR DELETE ON durable_claim_snapshots
FOR EACH ROW EXECUTE FUNCTION reject_claim_evidence_mutation();

CREATE TABLE findings (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  run_id UUID NOT NULL REFERENCES research_runs(id) ON DELETE RESTRICT,
  current_revision INTEGER NOT NULL CHECK (current_revision >= 0),
  superseded_by UUID REFERENCES findings(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CHECK (superseded_by IS NULL OR superseded_by <> id),
  UNIQUE (id, workspace_id, project_id, run_id)
);
CREATE INDEX idx_findings_scope
  ON findings(workspace_id, project_id, run_id);

CREATE TABLE finding_source_versions (
  finding_id UUID NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
  source_version_id UUID NOT NULL REFERENCES source_versions(id) ON DELETE RESTRICT,
  ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
  PRIMARY KEY (finding_id, ordinal),
  UNIQUE (finding_id, source_version_id)
);

CREATE TABLE finding_claims (
  finding_id UUID NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
  claim_id UUID NOT NULL REFERENCES durable_claims(id) ON DELETE RESTRICT,
  ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
  PRIMARY KEY (finding_id, ordinal),
  UNIQUE (finding_id, claim_id)
);

CREATE TABLE finding_title_revisions (
  finding_id UUID NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
  id UUID NOT NULL UNIQUE,
  revision INTEGER NOT NULL CHECK (revision >= 0),
  content TEXT NOT NULL CHECK (char_length(trim(content)) > 0),
  authorship_kind TEXT NOT NULL CHECK (
    authorship_kind IN ('generated', 'user')
  ),
  authorship JSONB NOT NULL,
  idempotency_key TEXT NOT NULL CHECK (
    char_length(idempotency_key) BETWEEN 1 AND 2048
  ),
  created_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (finding_id, revision),
  UNIQUE (finding_id, idempotency_key)
);

CREATE TABLE reports (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  run_id UUID NOT NULL REFERENCES research_runs(id) ON DELETE RESTRICT,
  revision INTEGER NOT NULL CHECK (revision >= 0),
  current_title_revision INTEGER NOT NULL CHECK (current_title_revision >= 0),
  publication_state TEXT NOT NULL CHECK (
    publication_state IN ('draft', 'publishable', 'published', 'superseded')
  ),
  superseded_by UUID REFERENCES reports(id) ON DELETE RESTRICT,
  last_publication_key TEXT CHECK (
    last_publication_key IS NULL
      OR char_length(last_publication_key) BETWEEN 1 AND 2048
  ),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CHECK (
    (publication_state = 'superseded') = (superseded_by IS NOT NULL)
  ),
  CHECK (superseded_by IS NULL OR superseded_by <> id),
  UNIQUE (id, workspace_id, project_id, run_id),
  UNIQUE (id, workspace_id, project_id, revision)
);
CREATE INDEX idx_reports_scope ON reports(workspace_id, project_id, run_id);

CREATE TABLE report_revision_snapshots (
  report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL CHECK (revision >= 0),
  workspace_id UUID NOT NULL,
  project_id UUID NOT NULL,
  run_id UUID NOT NULL,
  expected_previous_revision INTEGER,
  idempotency_key TEXT NOT NULL CHECK (
    char_length(idempotency_key) BETWEEN 1 AND 2048
  ),
  payload_hash TEXT NOT NULL CHECK (
    payload_hash ~ '^sha256:[0-9a-f]{64}$'
  ),
  snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (report_id, revision),
  FOREIGN KEY (report_id, workspace_id, project_id, run_id)
    REFERENCES reports(id, workspace_id, project_id, run_id)
    ON DELETE CASCADE,
  UNIQUE (report_id, idempotency_key),
  UNIQUE (report_id, workspace_id, project_id, revision),
  CHECK (
    (revision = 0 AND expected_previous_revision IS NULL)
    OR
    (revision > 0 AND expected_previous_revision = revision - 1)
  )
);
CREATE INDEX idx_report_revision_snapshots_scope
  ON report_revision_snapshots(
    workspace_id,
    project_id,
    report_id,
    revision DESC
  );

CREATE FUNCTION reject_report_revision_snapshot_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'report revision snapshots are append-only';
END;
$$;

CREATE TRIGGER report_revision_snapshots_append_only
BEFORE UPDATE OR DELETE ON report_revision_snapshots
FOR EACH ROW EXECUTE FUNCTION reject_report_revision_snapshot_mutation();

CREATE TABLE report_revision_source_versions (
  report_id UUID NOT NULL,
  report_revision INTEGER NOT NULL,
  source_version_id UUID NOT NULL
    REFERENCES source_versions(id) ON DELETE RESTRICT,
  ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
  PRIMARY KEY (report_id, report_revision, ordinal),
  UNIQUE (report_id, report_revision, source_version_id),
  FOREIGN KEY (report_id, report_revision)
    REFERENCES report_revision_snapshots(report_id, revision)
    ON DELETE CASCADE
);

CREATE TABLE report_revision_findings (
  report_id UUID NOT NULL,
  report_revision INTEGER NOT NULL,
  finding_id UUID NOT NULL REFERENCES findings(id) ON DELETE RESTRICT,
  section_id UUID NOT NULL,
  ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
  PRIMARY KEY (report_id, report_revision, ordinal),
  UNIQUE (report_id, report_revision, finding_id),
  FOREIGN KEY (report_id, report_revision)
    REFERENCES report_revision_snapshots(report_id, revision)
    ON DELETE CASCADE
);

CREATE TABLE report_revision_sections (
  report_id UUID NOT NULL,
  report_revision INTEGER NOT NULL,
  section_id UUID NOT NULL,
  ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
  section_snapshot JSONB NOT NULL,
  PRIMARY KEY (report_id, report_revision, section_id),
  UNIQUE (report_id, report_revision, ordinal),
  FOREIGN KEY (report_id, report_revision)
    REFERENCES report_revision_snapshots(report_id, revision)
    ON DELETE CASCADE
);

ALTER TABLE report_revision_findings
  ADD FOREIGN KEY (report_id, report_revision, section_id)
  REFERENCES report_revision_sections(
    report_id,
    report_revision,
    section_id
  ) ON DELETE CASCADE;

CREATE TABLE report_revision_claims (
  report_id UUID NOT NULL,
  report_revision INTEGER NOT NULL,
  section_id UUID NOT NULL,
  claim_id UUID NOT NULL REFERENCES durable_claims(id) ON DELETE RESTRICT,
  ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
  PRIMARY KEY (report_id, report_revision, section_id, ordinal),
  UNIQUE (report_id, report_revision, claim_id),
  FOREIGN KEY (report_id, report_revision, section_id)
    REFERENCES report_revision_sections(
      report_id,
      report_revision,
      section_id
    ) ON DELETE CASCADE
);
