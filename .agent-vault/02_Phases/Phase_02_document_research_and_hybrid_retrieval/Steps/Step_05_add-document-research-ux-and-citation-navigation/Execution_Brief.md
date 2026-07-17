# Execution Brief

## Exact Outcome

- Produce the concrete contracts, artifacts, and bounded implementation/design surfaces for Document Research UX and Citation Navigation that this step is responsible for before any broader follow-on work begins.

## Prerequisites

- Re-read [[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Phase|Phase 02 document research and hybrid retrieval]] and confirm the step still matches the current roadmap sequence.
- Confirm the handoff from [[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Steps/Step_04_build-document-research-and-evidence-sufficiency-workflow|STEP-02-04 Build Document Research and Evidence Sufficiency Workflow]] before widening scope.
- Keep deterministic work in typed Effect services, repositories, and tools; reserve Fred for agentic orchestration only.
- Treat the listed files as planned starting points; create only the smallest set needed to land the slice.

## Planned Starting Files

- These paths may not exist yet; use them as the first bounded implementation or design surface.
- `apps/web/src/app/projects/[projectId]/page.tsx`
- `apps/web/src/components/DocumentSearchPane.tsx`
- `apps/web/src/components/CitationInspector.tsx`
- `apps/api/src/routes/documents.ts`
- `apps/api/src/routes/citations.ts`

## Required Reading

- [[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Phase|Phase 02 document research and hybrid retrieval]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
- [[01_Architecture/System_Overview|System Overview]]
- [[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Steps/Step_04_build-document-research-and-evidence-sufficiency-workflow|STEP-02-04 Build Document Research and Evidence Sufficiency Workflow]]
- `docs/product-brief.md` sections 9-11, 13, 16-18, 23-27, and 29-31.

## Concrete Deliverables

- Implement the narrowest typed slice for Document Research UX and Citation Navigation that is callable by the next step without broadening scope.
- Expose only the minimal API surface in `apps/api/src/routes/documents.ts`, `apps/api/src/routes/citations.ts` needed to exercise this step end to end.
- Use `apps/web/src/app/projects/[projectId]/page.tsx`, `apps/web/src/components/DocumentSearchPane.tsx`, `apps/web/src/components/CitationInspector.tsx` to expose only the UI states required to inspect this step’s output and failures.

## Smallest Bounded Checklist

- First, implement the narrowest typed slice for Document Research UX and Citation Navigation that is callable by the next step without broadening scope.
- Then, expose only the minimal API surface in `apps/api/src/routes/documents.ts`, `apps/api/src/routes/citations.ts` needed to exercise this step end to end.
- Next, use `apps/web/src/app/projects/[projectId]/page.tsx`, `apps/web/src/components/DocumentSearchPane.tsx`, `apps/web/src/components/CitationInspector.tsx` to expose only the UI states required to inspect this step’s output and failures.
- Finish by leaving one observable typed path—test, route, worker flow, or UI state—that proves the slice is ready for the next dependent step.

## Constraints and Non-Goals

- Document parsing and chunking must preserve enough source location detail to build valid citations later.
- Hybrid retrieval should combine deterministic filters, text search, and vector search without collapsing them into one opaque score.
- Treat retrieved content as evidence only; prompt-injection resistance is part of the feature, not a later hardening pass.

## Related Notes

- Step: [[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Steps/Step_05_add-document-research-ux-and-citation-navigation|STEP-02-05 Add Document Research UX and Citation Navigation]]
- Phase: [[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Phase|Phase 02 document research and hybrid retrieval]]
