-- Migration 0005: Immutable, tenant-scoped normalized documents and chunks.
-- Raw/normalized artifacts remain attached to immutable source_versions. Chunk
-- rebuilds use a new chunking_version; existing rows are never updated.

CREATE UNIQUE INDEX uq_projects_workspace_id_id
  ON projects(workspace_id, id);
CREATE UNIQUE INDEX uq_sources_project_id_id
  ON sources(project_id, id);
CREATE UNIQUE INDEX uq_source_versions_source_id_id
  ON source_versions(source_id, id);

CREATE TABLE documents (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL,
  project_id UUID NOT NULL,
  source_id UUID NOT NULL,
  source_version_id UUID NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('pdf', 'html', 'markdown', 'text')),
  normalized_text TEXT NOT NULL,
  content_hash TEXT NOT NULL CHECK (length(content_hash) > 0),
  parser_version TEXT NOT NULL CHECK (length(parser_version) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_documents_source_version UNIQUE (source_version_id),
  CONSTRAINT uq_documents_tenant_lineage
    UNIQUE (id, workspace_id, project_id, source_id, source_version_id),
  CONSTRAINT fk_documents_project_scope
    FOREIGN KEY (workspace_id, project_id)
    REFERENCES projects(workspace_id, id)
    ON DELETE CASCADE,
  CONSTRAINT fk_documents_source_scope
    FOREIGN KEY (project_id, source_id)
    REFERENCES sources(project_id, id)
    ON DELETE CASCADE,
  CONSTRAINT fk_documents_source_version_scope
    FOREIGN KEY (source_id, source_version_id)
    REFERENCES source_versions(source_id, id)
    ON DELETE CASCADE
);
CREATE INDEX idx_documents_workspace_source_version
  ON documents(workspace_id, source_version_id);

CREATE TABLE document_chunks (
  id UUID PRIMARY KEY,
  document_id UUID NOT NULL,
  workspace_id UUID NOT NULL,
  project_id UUID NOT NULL,
  source_id UUID NOT NULL,
  source_version_id UUID NOT NULL,
  chunking_version TEXT NOT NULL CHECK (length(chunking_version) > 0),
  ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
  text TEXT NOT NULL CHECK (length(text) > 0),
  text_hash TEXT NOT NULL CHECK (length(text_hash) > 0),
  page INTEGER CHECK (page IS NULL OR page > 0),
  section TEXT CHECK (section IS NULL OR length(section) > 0),
  paragraph INTEGER CHECK (paragraph IS NULL OR paragraph > 0),
  char_start INTEGER NOT NULL CHECK (char_start >= 0),
  char_end INTEGER NOT NULL CHECK (char_end > char_start),
  byte_start INTEGER NOT NULL CHECK (byte_start >= 0),
  byte_end INTEGER NOT NULL CHECK (byte_end > byte_start),
  search_vector TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('english', text)
  ) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_document_chunks_version_ordinal
    UNIQUE (document_id, chunking_version, ordinal),
  CONSTRAINT fk_document_chunks_tenant_lineage
    FOREIGN KEY (
      document_id,
      workspace_id,
      project_id,
      source_id,
      source_version_id
    )
    REFERENCES documents(
      id,
      workspace_id,
      project_id,
      source_id,
      source_version_id
    )
    ON DELETE CASCADE
);
CREATE INDEX idx_document_chunks_workspace_source_version
  ON document_chunks(
    workspace_id,
    source_version_id,
    chunking_version,
    ordinal
  );
CREATE INDEX idx_document_chunks_search_vector
  ON document_chunks USING GIN(search_vector);
