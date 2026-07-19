# Implementation Notes

- Capture durable findings learned during execution. Prefer short bullets with file paths, commands, and observed behavior.

- Added branded `DocumentId` / `DocumentChunkId` and Effect Schema contracts for normalized documents, immutable versioned chunks, and exact document locators in `packages/domain/src/document.ts`.
- Added deterministic Bun-native `fragments-v1` chunking in `packages/document-processing/src/chunk-document.ts`. It validates parser locator round-trips, groups bounded adjacent fragments, splits oversized fragments without breaking surrogate pairs, and preserves exact character/byte provenance.
- Added reversible `0005_document_chunks` schema with workspace/project/source/source-version lineage foreign keys, immutable document/chunk uniqueness, generated PostgreSQL full-text vectors, and a GIN index. Vector embedding shape remains intentionally deferred to STEP-02-03.
- The migration runner applies `0005` transactionally. Supporting lineage indexes intentionally use ordinary `CREATE UNIQUE INDEX`; this greenfield schema has no legacy production dataset requiring a concurrent-index rollout.
- Added `DocumentChunkRepo` as an `Effect.Service`; writes are atomic, idempotent for an identical aggregate, immutable-conflict detecting, workspace scoped, and fenced by the exact in-progress ingestion attempt.
- Updating the latest migration exposed positional assumptions in event-journal and upgrade migration fixtures; those fixtures now step through `0005` before exercising their intended historical migration.

## Review Remediations

- Root pre-PR review corrected overlap validation to respect exclusive
  `charEnd` offsets, allowing valid adjacent fragments.
- Oversized-fragment splitting now advances safely when a one-character
  boundary lands inside a UTF-16 surrogate pair.
- The exported locator schema rejects zero-length and reversed character or
  byte ranges.
- Deterministic chunk identity and text hashes are shared domain functions;
  persistence recomputes and verifies both before any SQL write.
- Codex review identified quadratic UTF-8 prefix rescans in parser-fragment and
  repository validation. Both now advance byte offsets from the previous
  validated boundary, keeping validation linear in document size; real
  multi-chunk PostgreSQL coverage exercises multibyte text and inter-chunk gaps.
- Grouped chunk provenance is accumulated across every included fragment; page,
  section, and paragraph locators clear when any intermediate fragment differs.
- Final PostgreSQL-backed suite after review remediation: 370 passed, 0
  failed, 2,107 assertions across 61 files.

## Related Notes

- Step: [[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Steps/Step_02_implement-versioned-document-chunks-and-index-migrations|STEP-02-02 Implement Versioned Document Chunks and Index Migrations]]
- Phase: [[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Phase|Phase 02 document research and hybrid retrieval]]
