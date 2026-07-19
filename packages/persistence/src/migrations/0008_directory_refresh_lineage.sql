-- Immutable directory snapshots and per-entry source-version lineage.
-- Artifact bytes are staged in the content-addressed object store before this
-- metadata is committed. Unreferenced objects are safe to reuse on retry.

CREATE TABLE directory_roots (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL,
  project_id UUID NOT NULL,
  source_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_directory_roots_scope UNIQUE (id, workspace_id, project_id),
  CONSTRAINT uq_directory_roots_source UNIQUE (source_id),
  CONSTRAINT fk_directory_roots_project
    FOREIGN KEY (workspace_id, project_id)
    REFERENCES projects(workspace_id, id)
    ON DELETE CASCADE,
  CONSTRAINT fk_directory_roots_source
    FOREIGN KEY (project_id, source_id)
    REFERENCES sources(project_id, id)
    ON DELETE CASCADE
);

CREATE TABLE directory_snapshots (
  id UUID PRIMARY KEY,
  directory_root_id UUID NOT NULL,
  workspace_id UUID NOT NULL,
  project_id UUID NOT NULL,
  previous_snapshot_id UUID,
  manifest_digest TEXT NOT NULL
    CHECK (manifest_digest ~ '^sha256:[0-9a-f]{64}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_directory_snapshots_scope
    UNIQUE (id, directory_root_id, workspace_id, project_id),
  CONSTRAINT fk_directory_snapshots_root
    FOREIGN KEY (directory_root_id, workspace_id, project_id)
    REFERENCES directory_roots(id, workspace_id, project_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_directory_snapshots_previous
    FOREIGN KEY (
      previous_snapshot_id,
      directory_root_id,
      workspace_id,
      project_id
    )
    REFERENCES directory_snapshots(
      id,
      directory_root_id,
      workspace_id,
      project_id
    )
    ON DELETE RESTRICT
);
CREATE INDEX idx_directory_snapshots_manifest
  ON directory_snapshots(directory_root_id, manifest_digest);

CREATE TABLE directory_manifest_entries (
  id UUID PRIMARY KEY,
  snapshot_id UUID NOT NULL,
  directory_root_id UUID NOT NULL,
  workspace_id UUID NOT NULL,
  project_id UUID NOT NULL,
  relative_path TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('included', 'unsupported')),
  byte_length BIGINT NOT NULL CHECK (byte_length >= 0),
  content_hash TEXT,
  unsupported_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_directory_manifest_entry_path
    UNIQUE (snapshot_id, relative_path),
  CONSTRAINT fk_directory_manifest_entry_snapshot
    FOREIGN KEY (snapshot_id, directory_root_id, workspace_id, project_id)
    REFERENCES directory_snapshots(id, directory_root_id, workspace_id, project_id)
    ON DELETE CASCADE,
  CHECK (
    (status = 'included'
      AND content_hash ~ '^sha256:[0-9a-f]{64}$'
      AND unsupported_reason IS NULL)
    OR (status = 'unsupported'
      AND content_hash IS NULL
      AND length(unsupported_reason) > 0)
  )
);

CREATE TABLE artifact_objects (
  ref TEXT PRIMARY KEY CHECK (ref ~ '^artifact://sha256/[0-9a-f]{64}$'),
  content_hash TEXT NOT NULL UNIQUE
    CHECK (content_hash ~ '^sha256:[0-9a-f]{64}$'),
  byte_length BIGINT NOT NULL CHECK (byte_length >= 0),
  media_type TEXT NOT NULL CHECK (length(media_type) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    substring(ref FROM 19) = substring(content_hash FROM 8)
  )
);

CREATE TABLE directory_entry_lineage (
  snapshot_id UUID NOT NULL REFERENCES directory_snapshots(id) ON DELETE CASCADE,
  relative_path TEXT NOT NULL,
  manifest_entry_id UUID REFERENCES directory_manifest_entries(id) ON DELETE NO ACTION,
  source_id UUID REFERENCES sources(id) ON DELETE RESTRICT,
  source_version_id UUID REFERENCES source_versions(id) ON DELETE RESTRICT,
  previous_source_version_id UUID REFERENCES source_versions(id) ON DELETE RESTRICT,
  disposition TEXT NOT NULL
    CHECK (disposition IN ('added', 'modified', 'unchanged', 'removed', 'unsupported')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (snapshot_id, relative_path),
  CHECK (
    (disposition = 'unsupported'
      AND manifest_entry_id IS NOT NULL
      AND source_version_id IS NULL
      AND (
        (source_id IS NULL AND previous_source_version_id IS NULL)
        OR (source_id IS NOT NULL AND previous_source_version_id IS NOT NULL)
      ))
    OR (disposition = 'removed'
      AND manifest_entry_id IS NULL
      AND source_version_id IS NULL
      AND (
        (source_id IS NULL AND previous_source_version_id IS NULL)
        OR (source_id IS NOT NULL AND previous_source_version_id IS NOT NULL)
      ))
    OR (disposition = 'added'
      AND manifest_entry_id IS NOT NULL
      AND source_id IS NOT NULL
      AND source_version_id IS NOT NULL
      AND previous_source_version_id IS NULL)
    OR (disposition = 'modified'
      AND manifest_entry_id IS NOT NULL
      AND source_id IS NOT NULL
      AND source_version_id IS NOT NULL
      AND previous_source_version_id IS NOT NULL
      AND source_version_id <> previous_source_version_id)
    OR (disposition = 'unchanged'
      AND manifest_entry_id IS NOT NULL
      AND source_id IS NOT NULL
      AND source_version_id IS NOT NULL
      AND source_version_id = previous_source_version_id)
  )
);
CREATE INDEX idx_directory_entry_lineage_source_version
  ON directory_entry_lineage(source_version_id);
CREATE INDEX idx_directory_entry_lineage_previous_source_version
  ON directory_entry_lineage(previous_source_version_id);

CREATE TABLE directory_refresh_commits (
  job_id UUID NOT NULL REFERENCES directory_ingestion_jobs(job_id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  snapshot_id UUID NOT NULL REFERENCES directory_snapshots(id) ON DELETE RESTRICT,
  checkpoint_sequence BIGINT NOT NULL CHECK (checkpoint_sequence > 0),
  result JSONB NOT NULL,
  event_id UUID NOT NULL REFERENCES event_journal(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (job_id, idempotency_key),
  UNIQUE (job_id, checkpoint_sequence),
  UNIQUE (snapshot_id)
);
