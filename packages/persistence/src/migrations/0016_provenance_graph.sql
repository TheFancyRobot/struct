-- Immutable provenance projection for one exact report revision. The graph is
-- relational rows plus typed JSON snapshots; no separate graph runtime exists.

CREATE TABLE provenance_graphs (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  report_revision INTEGER NOT NULL CHECK (report_revision >= 0),
  revalidation_key TEXT NOT NULL CHECK (
    char_length(revalidation_key) BETWEEN 1 AND 65536
  ),
  trigger_snapshot JSONB NOT NULL,
  graph_hash TEXT NOT NULL CHECK (
    graph_hash ~ '^sha256:[0-9a-f]{64}$'
  ),
  created_at TIMESTAMPTZ NOT NULL,
  UNIQUE (report_id, report_revision, revalidation_key),
  UNIQUE (id, report_id, report_revision),
  FOREIGN KEY (report_id, workspace_id, project_id, report_revision)
    REFERENCES report_revision_snapshots(
      report_id,
      workspace_id,
      project_id,
      revision
    )
    ON DELETE CASCADE
);
CREATE INDEX idx_provenance_graphs_scope
  ON provenance_graphs(workspace_id, project_id, report_id, report_revision);

CREATE TABLE provenance_edges (
  graph_id UUID NOT NULL REFERENCES provenance_graphs(id) ON DELETE CASCADE,
  edge_id TEXT NOT NULL CHECK (edge_id ~ '^sha256:[0-9a-f]{64}$'),
  report_id UUID NOT NULL,
  report_revision INTEGER NOT NULL CHECK (report_revision >= 0),
  claim_id UUID NOT NULL REFERENCES durable_claims(id) ON DELETE RESTRICT,
  claim_revision_id UUID NOT NULL,
  claim_revision INTEGER NOT NULL CHECK (claim_revision >= 0),
  edge_kind TEXT NOT NULL CHECK (
    edge_kind IN (
      'report-claim',
      'claim-recursive-finding',
      'claim-run-output',
      'claim-user-origin',
      'evidence-document',
      'evidence-dataset',
      'evidence-recursive'
    )
  ),
  evidence_id TEXT,
  edge_snapshot JSONB NOT NULL,
  CHECK (
    (edge_kind IN (
      'evidence-document',
      'evidence-dataset',
      'evidence-recursive'
    )) = (evidence_id IS NOT NULL)
  ),
  PRIMARY KEY (graph_id, edge_id),
  FOREIGN KEY (graph_id, report_id, report_revision)
    REFERENCES provenance_graphs(id, report_id, report_revision)
    ON DELETE CASCADE,
  FOREIGN KEY (report_id, report_revision, claim_id)
    REFERENCES report_revision_claims(
      report_id,
      report_revision,
      claim_id
    ) ON DELETE RESTRICT,
  FOREIGN KEY (claim_id, claim_revision_id, claim_revision)
    REFERENCES claim_revisions(claim_id, id, revision) ON DELETE RESTRICT,
  FOREIGN KEY (claim_id, evidence_id)
    REFERENCES claim_evidence(claim_id, evidence_id) ON DELETE RESTRICT
);
CREATE INDEX idx_provenance_edges_claim
  ON provenance_edges(graph_id, claim_id, edge_kind);

CREATE TABLE citation_validation_facts (
  graph_id UUID NOT NULL,
  edge_id TEXT NOT NULL,
  report_id UUID NOT NULL,
  report_revision INTEGER NOT NULL CHECK (report_revision >= 0),
  status TEXT NOT NULL CHECK (
    status IN ('valid', 'stale', 'broken', 'unauthorized', 'incompatible')
  ),
  reason TEXT NOT NULL,
  checked_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (graph_id, edge_id),
  FOREIGN KEY (graph_id, edge_id)
    REFERENCES provenance_edges(graph_id, edge_id) ON DELETE CASCADE,
  FOREIGN KEY (graph_id, report_id, report_revision)
    REFERENCES provenance_graphs(id, report_id, report_revision)
    ON DELETE CASCADE
);
CREATE INDEX idx_citation_validation_facts_gate
  ON citation_validation_facts(graph_id, status);
