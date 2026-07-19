# Validation Plan

## Acceptance Checks

- Confirm this deliverable is present, testable where applicable, and bounded to the step: The narrowest typed slice for Keyword Vector and Hybrid Retrieval that is callable by the next step without broadening scope.
- Confirm the manifest-derived retrieval-index migration is present, bounded to this step, and explicit about workspace scoping and immutable source-version ownership.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: The retrieval boundary in `packages/retrieval/src/full-text.ts`, `packages/retrieval/src/vector-search.ts`, `packages/retrieval/src/hybrid-retrieval.ts` so ranking, filtering, and provenance remain inspectable and typed.
- The step leaves the next dependent step with a stable typed boundary, not a placeholder or undocumented assumption.

## Planned Verification

- Refined gate: real PostgreSQL keyword, vector, and fused-ranking fixtures; deterministic tie-breaking; tenant/source filters; empty and adversarial queries; embedding failure behavior; exact provenance; index rebuild/upgrade; then applicable repo-wide Bun gates and Vault doctor.
- Planned command once these packages exist: `bun test packages/persistence packages/retrieval` plus the nearest package-level `bun run typecheck`.
- Plan a fresh-database migration smoke test and an upgrade-path test so the new schema contract is reversible and auditable.

## Edge Cases

- Partial progress, retries, or restarts should leave this step in a typed, inspectable state rather than a silent half-success.
- Unsupported formats, stale chunk references, and citation-open failures should surface explicitly instead of degrading to uncited answers.
- Cancellation, duplicate actions, replay after restart, and stale source-version assumptions should produce deterministic terminal states.

## Regression Expectations

- This step should remain a clean successor to [[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Steps/Step_02_implement-versioned-document-chunks-and-index-migrations|STEP-02-02 Implement Versioned Document Chunks and Index Migrations]] rather than reworking already-planned scope upstream.
- Do not regress the Phase 1 walking slice while expanding format support and retrieval depth.
- Do not lose immutable source-version identity when normalizing documents, chunks, or saved findings.
- Keep citation opening and evidence sufficiency compatible with future mixed-source and report steps.

## Security / Observability / Evaluation Focus

- Ensure document parsers clearly surface unsupported or unsafe inputs rather than silently guessing.
- Keep retrieval traces inspectable enough to explain why a chunk or document was selected.
- Add adversarial retrieval and prompt-injection cases early, before the UX hides the provenance chain.
- Evaluation should verify provenance opening paths, contradiction reporting, and prompt-injection resistance for the evidence types touched here.

## Related Notes

- Step: [[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Steps/Step_03_implement-keyword-vector-and-hybrid-retrieval|STEP-02-03 Implement Keyword Vector and Hybrid Retrieval]]
- Phase: [[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Phase|Phase 02 document research and hybrid retrieval]]
