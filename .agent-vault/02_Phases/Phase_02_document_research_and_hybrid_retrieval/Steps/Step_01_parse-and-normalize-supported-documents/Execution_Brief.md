# Execution Brief

## Exact Outcome

- Produce the concrete contracts, artifacts, and bounded implementation/design surfaces for and Normalize Supported Documents that this step is responsible for before any broader follow-on work begins.

## Prerequisites

- Re-read [[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Phase|Phase 02 document research and hybrid retrieval]] and confirm the step still matches the current roadmap sequence.
- Confirm the handoff from [[02_Phases/Phase_01_walking_skeleton/Steps/Step_06_automate-vertical-slice-tests-documentation-and-observability|STEP-01-06 Automate Vertical Slice Tests Documentation and Observability]] before widening scope.
- Keep deterministic work in typed Effect services, repositories, and tools; reserve Fred for agentic orchestration only.
- Treat the listed files as planned starting points; create only the smallest set needed to land the slice.

## Planned Starting Files

- These paths may not exist yet; use them as the first bounded implementation or design surface.
- `packages/document-processing/src/parsers/pdf.ts`
- `packages/document-processing/src/parsers/markdown.ts`
- `packages/document-processing/src/parsers/text.ts`
- `packages/document-processing/src/parsers/html.ts`
- `packages/document-processing/src/normalize-document.ts`
- `apps/worker/src/jobs/parse-document.ts`

## Required Reading

- [[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Phase|Phase 02 document research and hybrid retrieval]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
- [[01_Architecture/System_Overview|System Overview]]
- [[02_Phases/Phase_01_walking_skeleton/Steps/Step_06_automate-vertical-slice-tests-documentation-and-observability|STEP-01-06 Automate Vertical Slice Tests Documentation and Observability]]
- `docs/product-brief.md` sections 9-11, 13, 16-18, 23-27, and 29-31.

## Concrete Deliverables

- Implement the narrowest typed slice for and Normalize Supported Documents that is callable by the next step without broadening scope.
- Use `packages/document-processing/src/parsers/pdf.ts`, `packages/document-processing/src/parsers/markdown.ts`, `packages/document-processing/src/parsers/text.ts` to preserve parse/normalize/chunk provenance instead of collapsing documents into opaque text blobs.
- Constrain worker-side execution in `apps/worker/src/jobs/parse-document.ts` to one resumable, observable path for this slice.

## Smallest Bounded Checklist

- First, implement the narrowest typed slice for and Normalize Supported Documents that is callable by the next step without broadening scope.
- Then, use `packages/document-processing/src/parsers/pdf.ts`, `packages/document-processing/src/parsers/markdown.ts`, `packages/document-processing/src/parsers/text.ts` to preserve parse/normalize/chunk provenance instead of collapsing documents into opaque text blobs.
- Next, constrain worker-side execution in `apps/worker/src/jobs/parse-document.ts` to one resumable, observable path for this slice.
- Finish by leaving one observable typed path—test, route, worker flow, or UI state—that proves the slice is ready for the next dependent step.

## Constraints and Non-Goals

- Document parsing and chunking must preserve enough source location detail to build valid citations later.
- Hybrid retrieval should combine deterministic filters, text search, and vector search without collapsing them into one opaque score.
- Treat retrieved content as evidence only; prompt-injection resistance is part of the feature, not a later hardening pass.

## Related Notes

- Step: [[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Steps/Step_01_parse-and-normalize-supported-documents|STEP-02-01 Parse and Normalize Supported Documents]]
- Phase: [[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Phase|Phase 02 document research and hybrid retrieval]]
