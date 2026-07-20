DROP TABLE IF EXISTS report_revision_claims;
DROP TABLE IF EXISTS report_revision_sections;
DROP TABLE IF EXISTS report_revision_findings;
DROP TABLE IF EXISTS report_revision_source_versions;
DROP TRIGGER IF EXISTS report_revision_snapshots_append_only
  ON report_revision_snapshots;
DROP FUNCTION IF EXISTS reject_report_revision_snapshot_mutation();
DROP TABLE IF EXISTS report_revision_snapshots;
DROP TABLE IF EXISTS reports;
DROP TABLE IF EXISTS finding_title_revisions;
DROP TABLE IF EXISTS finding_claims;
DROP TABLE IF EXISTS finding_source_versions;
DROP TABLE IF EXISTS findings;
DROP TRIGGER IF EXISTS claim_evidence_append_only ON claim_evidence;
DROP TRIGGER IF EXISTS durable_claim_snapshots_append_only
  ON durable_claim_snapshots;
DROP TABLE IF EXISTS durable_claim_snapshots;
DROP FUNCTION IF EXISTS reject_claim_evidence_mutation();
DROP TABLE IF EXISTS claim_evidence;
DROP TABLE IF EXISTS claim_revisions;
DROP TABLE IF EXISTS durable_claims;
