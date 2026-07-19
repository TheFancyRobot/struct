-- Migration 0006: Rebuildable, tenant-scoped chunk embeddings for hybrid retrieval.
-- Embedding dimensions remain model-specific; callers must query with the same
-- model identifier and dimensions that produced each derived vector.

ALTER TABLE document_chunks
  ADD CONSTRAINT uq_document_chunks_embedding_lineage
  UNIQUE (
    id,
    document_id,
    workspace_id,
    project_id,
    source_id,
    source_version_id,
    chunking_version
  );

CREATE TABLE document_chunk_embeddings (
  chunk_id UUID NOT NULL,
  document_id UUID NOT NULL,
  workspace_id UUID NOT NULL,
  project_id UUID NOT NULL,
  source_id UUID NOT NULL,
  source_version_id UUID NOT NULL,
  chunking_version TEXT NOT NULL CHECK (length(chunking_version) > 0),
  embedding_model TEXT NOT NULL CHECK (length(embedding_model) > 0),
  dimensions INTEGER NOT NULL CHECK (dimensions BETWEEN 1 AND 16000),
  embedding VECTOR NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (chunk_id, embedding_model),
  CONSTRAINT ck_document_chunk_embeddings_dimensions
    CHECK (vector_dims(embedding) = dimensions),
  CONSTRAINT ck_document_chunk_embeddings_non_zero
    CHECK (vector_norm(embedding) > 0),
  CONSTRAINT fk_document_chunk_embeddings_lineage
    FOREIGN KEY (
      chunk_id,
      document_id,
      workspace_id,
      project_id,
      source_id,
      source_version_id,
      chunking_version
    )
    REFERENCES document_chunks (
      id,
      document_id,
      workspace_id,
      project_id,
      source_id,
      source_version_id,
      chunking_version
    )
    ON DELETE CASCADE
);

CREATE INDEX idx_document_chunk_embeddings_scope
  ON document_chunk_embeddings (
    workspace_id,
    project_id,
    source_version_id,
    chunking_version,
    embedding_model,
    dimensions
  );
