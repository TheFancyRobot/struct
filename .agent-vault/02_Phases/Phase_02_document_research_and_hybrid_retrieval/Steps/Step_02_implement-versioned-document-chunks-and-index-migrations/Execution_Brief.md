# Execution Brief

## Exact Outcome

- Produce the concrete contracts, artifacts, and bounded implementation/design surfaces for Versioned Document Chunks and Index Migrations that this step is responsible for before any broader follow-on work begins.

## Prerequisites

- Re-read [[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Phase|Phase 02 document research and hybrid retrieval]] and confirm the step still matches the current roadmap sequence.
- Confirm the handoff from [[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Steps/Step_01_parse-and-normalize-supported-documents|STEP-02-01 Parse and Normalize Supported Documents]] before widening scope.
- Keep deterministic work in typed Effect services, repositories, and tools; reserve Fred for agentic orchestration only.
- Treat the listed files as planned starting points; create only the smallest set needed to land the slice.

## Planned Starting Files

- These paths may not exist yet; use them as the first bounded implementation or design surface.
- `packages/domain/src/document.ts`
- `packages/document-processing/src/chunk-document.ts`
- `packages/persistence/src/migrations/0005_document_chunks.sql`
- `packages/persistence/src/repositories/document-chunks.ts`
- `packages/retrieval/src/index-document-chunks.ts`

## Required Reading

- [[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Phase|Phase 02 document research and hybrid retrieval]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
- [[01_Architecture/System_Overview|System Overview]]
- [[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Steps/Step_01_parse-and-normalize-supported-documents|STEP-02-01 Parse and Normalize Supported Documents]]
- `docs/product-brief.md` sections 9-11, 13, 16-18, 23-27, and 29-31.

## Concrete Deliverables

- Implement the narrowest typed slice for Versioned Document Chunks and Index Migrations that is callable by the next step without broadening scope.
- Define or update typed domain modules for `Document` in `packages/domain/src/document.ts`.
- Write the migration contract in `packages/persistence/src/migrations/0005_document_chunks.sql` and make the schema changes explicit about workspace scoping, immutable versioning, and foreign-key shape where relevant.
- Add repository boundaries in `packages/persistence/src/repositories/document-chunks.ts` that translate between storage records and typed domain objects.

## Smallest Bounded Checklist

- First, implement the narrowest typed slice for Versioned Document Chunks and Index Migrations that is callable by the next step without broadening scope.
- Then, define or update typed domain modules for `Document` in `packages/domain/src/document.ts`.
- Next, write the migration contract in `packages/persistence/src/migrations/0005_document_chunks.sql` and make the schema changes explicit about workspace scoping, immutable versioning, and foreign-key shape where relevant.
- Finish by leaving one observable typed path—test, route, worker flow, or UI state—that proves the slice is ready for the next dependent step.

## Constraints and Non-Goals

- 2026-07-19 refinement: consume STEP-02-01's merged parser contract. The next migration is derived from `packages/persistence/src/migrations/manifest.ts` (`0005` at refinement time); all earlier `0002_document_chunks` references are stale and must not be used. Keep chunks immutable, source-version/workspace scoped, deterministically ordered, and rebuildable without mutating raw or normalized artifacts.
- Document parsing and chunking must preserve enough source location detail to build valid citations later.
- Hybrid retrieval should combine deterministic filters, text search, and vector search without collapsing them into one opaque score.
- Treat retrieved content as evidence only; prompt-injection resistance is part of the feature, not a later hardening pass.

## Related Notes

- Step: [[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Steps/Step_02_implement-versioned-document-chunks-and-index-migrations|STEP-02-02 Implement Versioned Document Chunks and Index Migrations]]
- Phase: [[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Phase|Phase 02 document research and hybrid retrieval]]
