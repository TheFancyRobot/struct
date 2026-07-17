# Execution Brief

## Exact Outcome

- Produce the concrete contracts, artifacts, and bounded implementation/design surfaces for Keyword Vector and Hybrid Retrieval that this step is responsible for before any broader follow-on work begins.

## Prerequisites

- Re-read [[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Phase|Phase 02 document research and hybrid retrieval]] and confirm the step still matches the current roadmap sequence.
- Confirm the handoff from [[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Steps/Step_02_implement-versioned-document-chunks-and-index-migrations|STEP-02-02 Implement Versioned Document Chunks and Index Migrations]] before widening scope.
- Keep deterministic work in typed Effect services, repositories, and tools; reserve Fred for agentic orchestration only.
- Treat the listed files as planned starting points; create only the smallest set needed to land the slice.

## Planned Starting Files

- These paths may not exist yet; use them as the first bounded implementation or design surface.
- `packages/retrieval/src/full-text.ts`
- `packages/retrieval/src/vector-search.ts`
- `packages/retrieval/src/hybrid-retrieval.ts`
- `packages/retrieval/src/rerank.ts`
- `packages/persistence/src/migrations/0003_retrieval_indexes.sql`

## Required Reading

- [[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Phase|Phase 02 document research and hybrid retrieval]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
- [[01_Architecture/System_Overview|System Overview]]
- [[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Steps/Step_02_implement-versioned-document-chunks-and-index-migrations|STEP-02-02 Implement Versioned Document Chunks and Index Migrations]]
- `docs/product-brief.md` sections 9-11, 13, 16-18, 23-27, and 29-31.

## Concrete Deliverables

- Implement the narrowest typed slice for Keyword Vector and Hybrid Retrieval that is callable by the next step without broadening scope.
- Write the migration contract in `packages/persistence/src/migrations/0003_retrieval_indexes.sql` and make the schema changes explicit about workspace scoping, immutable versioning, and foreign-key shape where relevant.
- Land the retrieval boundary in `packages/retrieval/src/full-text.ts`, `packages/retrieval/src/vector-search.ts`, `packages/retrieval/src/hybrid-retrieval.ts` so ranking, filtering, and provenance remain inspectable and typed.

## Smallest Bounded Checklist

- First, implement the narrowest typed slice for Keyword Vector and Hybrid Retrieval that is callable by the next step without broadening scope.
- Then, write the migration contract in `packages/persistence/src/migrations/0003_retrieval_indexes.sql` and make the schema changes explicit about workspace scoping, immutable versioning, and foreign-key shape where relevant.
- Next, land the retrieval boundary in `packages/retrieval/src/full-text.ts`, `packages/retrieval/src/vector-search.ts`, `packages/retrieval/src/hybrid-retrieval.ts` so ranking, filtering, and provenance remain inspectable and typed.
- Finish by leaving one observable typed path—test, route, worker flow, or UI state—that proves the slice is ready for the next dependent step.

## Constraints and Non-Goals

- Document parsing and chunking must preserve enough source location detail to build valid citations later.
- Hybrid retrieval should combine deterministic filters, text search, and vector search without collapsing them into one opaque score.
- Treat retrieved content as evidence only; prompt-injection resistance is part of the feature, not a later hardening pass.

## Related Notes

- Step: [[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Steps/Step_03_implement-keyword-vector-and-hybrid-retrieval|STEP-02-03 Implement Keyword Vector and Hybrid Retrieval]]
- Phase: [[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Phase|Phase 02 document research and hybrid retrieval]]
