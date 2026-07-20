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

CREATE TABLE report_source_versions (
  report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  source_version_id UUID NOT NULL REFERENCES source_versions(id) ON DELETE RESTRICT,
  ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
  PRIMARY KEY (report_id, ordinal),
  UNIQUE (report_id, source_version_id)
);

CREATE TABLE report_findings (
  report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  finding_id UUID NOT NULL REFERENCES findings(id) ON DELETE RESTRICT,
  ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
  PRIMARY KEY (report_id, ordinal),
  UNIQUE (report_id, finding_id)
);

CREATE TABLE report_title_revisions (
  report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
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
  PRIMARY KEY (report_id, revision),
  UNIQUE (report_id, idempotency_key)
);

CREATE TABLE report_sections (
  id UUID PRIMARY KEY,
  report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
  heading TEXT NOT NULL CHECK (char_length(trim(heading)) > 0),
  current_revision INTEGER NOT NULL CHECK (current_revision >= 0),
  last_regeneration_key TEXT CHECK (
    last_regeneration_key IS NULL
      OR char_length(last_regeneration_key) BETWEEN 1 AND 2048
  ),
  UNIQUE (report_id, ordinal),
  UNIQUE (report_id, id)
);

CREATE TABLE report_section_revisions (
  section_id UUID NOT NULL REFERENCES report_sections(id) ON DELETE CASCADE,
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
  PRIMARY KEY (section_id, revision),
  UNIQUE (section_id, idempotency_key)
);

CREATE TABLE report_claims (
  report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  section_id UUID NOT NULL,
  claim_id UUID NOT NULL REFERENCES durable_claims(id) ON DELETE RESTRICT,
  ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
  PRIMARY KEY (report_id, section_id, ordinal),
  UNIQUE (report_id, claim_id),
  UNIQUE (report_id, claim_id, section_id),
  FOREIGN KEY (report_id, section_id)
    REFERENCES report_sections(report_id, id) ON DELETE CASCADE
);
