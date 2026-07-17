# Validation Plan

## Acceptance Checks

- Confirm this deliverable is present, testable where applicable, and bounded to the step: The narrowest typed slice for Versioned Document Chunks and Index Migrations that is callable by the next step without broadening scope.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: update typed domain modules for `Document` in `packages/domain/src/document.ts`.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: The migration contract in `packages/persistence/src/migrations/0002_document_chunks.sql` and make the schema changes explicit about workspace scoping, immutable versioning, and foreign-key shape where relevant.
- The step leaves the next dependent step with a stable typed boundary, not a placeholder or undocumented assumption.

## Planned Verification

- Planned command once these packages exist: `bun test packages/document-processing packages/domain packages/persistence packages/retrieval` plus the nearest package-level `bun run typecheck`.
- Plan a fresh-database migration smoke test and an upgrade-path test so the new schema contract is reversible and auditable.

## Edge Cases

- Partial progress, retries, or restarts should leave this step in a typed, inspectable state rather than a silent half-success.
- Version drift, missing required fields, or ambiguous identity rules should be called out in the contract instead of deferred to implementation guesswork.
- Unsupported formats, stale chunk references, and citation-open failures should surface explicitly instead of degrading to uncited answers.

## Regression Expectations

- This step should remain a clean successor to [[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Steps/Step_01_parse-and-normalize-supported-documents|STEP-02-01 Parse and Normalize Supported Documents]] rather than reworking already-planned scope upstream.
- Do not regress the Phase 1 walking slice while expanding format support and retrieval depth.
- Do not lose immutable source-version identity when normalizing documents, chunks, or saved findings.
- Keep citation opening and evidence sufficiency compatible with future mixed-source and report steps.

## Security / Observability / Evaluation Focus

- Ensure document parsers clearly surface unsupported or unsafe inputs rather than silently guessing.
- Keep retrieval traces inspectable enough to explain why a chunk or document was selected.
- Add adversarial retrieval and prompt-injection cases early, before the UX hides the provenance chain.
- Evaluation should verify provenance opening paths, contradiction reporting, and prompt-injection resistance for the evidence types touched here.

## Related Notes

- Step: [[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Steps/Step_02_implement-versioned-document-chunks-and-index-migrations|STEP-02-02 Implement Versioned Document Chunks and Index Migrations]]
- Phase: [[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Phase|Phase 02 document research and hybrid retrieval]]
