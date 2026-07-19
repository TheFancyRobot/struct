# Implementation Notes

- Capture durable findings learned during execution. Prefer short bullets with file paths, commands, and observed behavior.
- Extended the existing Solid research stream and citation viewer rather than adding a second UI or state path.
- `apps/api/src/routes/citations.ts` resolves document locators with exact character and UTF-8 byte validation, bounded context, and full-range representation.
- `ResearchProjectionRepo.findCitation` selects immutable normalized text only for `document:` locators, retains indexed text for line locators, and fails closed without normalized document state.
- Browser coverage verifies native keyboard citation navigation and visible loading, empty, insufficient, unsupported, and tenant-safe missing-citation states; SSE cursor replay remains covered.

## Related Notes

- Step: [[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Steps/Step_05_add-document-research-ux-and-citation-navigation|STEP-02-05 Add Document Research UX and Citation Navigation]]
- Phase: [[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Phase|Phase 02 document research and hybrid retrieval]]
