-- Migration 0002: Initialize workspace-scoped tables for the walking skeleton.
-- All tables are scoped to workspaces to enforce tenant isolation from day one.
-- Source versions are immutable per DEC-0006: refresh creates a new version, never updates in place.
-- Event journal is append-only per DEC-0008.

-- Workspaces: the ownership and isolation boundary.
CREATE TABLE workspaces (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Projects: group sources, threads, findings, and reports within a workspace.
CREATE TABLE projects (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_projects_workspace_id ON projects(workspace_id);

-- Sources: logical source entities (document, dataset, directory, file).
CREATE TABLE sources (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('document', 'dataset', 'directory', 'file')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_sources_project_id ON sources(project_id);

-- Source versions: immutable snapshots per DEC-0006.
-- Refresh creates a new version; existing versions are never mutated.
CREATE TABLE source_versions (
  id UUID PRIMARY KEY,
  source_id UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  artifact_ref TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(source_id, version)
);
CREATE INDEX idx_source_versions_source_id ON source_versions(source_id);

-- Research threads: conversation/research context within a project.
CREATE TABLE research_threads (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_research_threads_project_id ON research_threads(project_id);

-- Research runs: individual research execution within a thread.
CREATE TABLE research_runs (
  id UUID PRIMARY KEY,
  thread_id UUID NOT NULL REFERENCES research_threads(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in-progress', 'completed', 'failed', 'cancelled', 'partial')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_research_runs_thread_id ON research_runs(thread_id);

-- Citations: reference immutable source versions, not mutable sources.
CREATE TABLE citations (
  id UUID PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES research_runs(id) ON DELETE CASCADE,
  source_version_id UUID NOT NULL REFERENCES source_versions(id) ON DELETE RESTRICT,
  locator TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'validated' CHECK (status IN ('validated', 'invalid', 'stale')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_citations_run_id ON citations(run_id);
CREATE INDEX idx_citations_source_version_id ON citations(source_version_id);

-- Event journal: append-only per DEC-0008.
-- Records domain events for SSE replay, cancellation, and audit.
CREATE TABLE event_journal (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  cursor BIGSERIAL NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_event_journal_cursor ON event_journal(cursor);
CREATE INDEX idx_event_journal_workspace_id ON event_journal(workspace_id);
CREATE INDEX idx_event_journal_entity ON event_journal(entity_type, entity_id);

-- Job queue: worker dispatch table consumed by STEP-01-03 (worker polling).
CREATE TABLE job_queue (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in-progress', 'completed', 'failed', 'cancelled')),
  payload JSONB NOT NULL DEFAULT '{}',
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_job_queue_workspace_id ON job_queue(workspace_id);
CREATE INDEX idx_job_queue_status ON job_queue(status);
