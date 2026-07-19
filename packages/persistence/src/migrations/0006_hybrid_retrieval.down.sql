DROP TABLE IF EXISTS document_chunk_embeddings;

ALTER TABLE document_chunks
  DROP CONSTRAINT IF EXISTS uq_document_chunks_embedding_lineage;
