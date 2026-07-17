# DEC-0004: Use PostgreSQL Full-Text Search and pgvector for Initial Retrieval

## Status

Accepted.

## Context

The product must support hybrid retrieval across research documents while staying operationally simple in early phases. The brief recommends PostgreSQL as the application database, PostgreSQL full-text search for lexical retrieval, and pgvector for initial vector search rather than introducing a separate search or vector platform before the baseline product is proven.

## Decision

Use PostgreSQL as the initial retrieval substrate for document research. Implement keyword retrieval with PostgreSQL full-text search, semantic retrieval with pgvector, and combine them through a hybrid retrieval layer that preserves provenance for every returned unit. Keep reranking and future retrieval backends behind product-owned abstractions.

## Alternatives

- Start with a dedicated vector database or search engine.
- Rely on vector search alone.
- Rely on keyword search alone.

## Consequences

- Early infrastructure stays smaller and easier to operate.
- Hybrid retrieval can ship sooner because the application database already hosts the primary indexes.
- Retrieval scale limits may eventually justify a specialized backend, so interfaces must remain replaceable.
- Provenance, reranking, and context budgeting logic still need product-local design even with shared storage.

## Related Phase

- [PHASE-02 Document Research and Hybrid Retrieval](../../.agent-vault/02_Phases/Phase_02_document_research_and_hybrid_retrieval/Phase.md)
