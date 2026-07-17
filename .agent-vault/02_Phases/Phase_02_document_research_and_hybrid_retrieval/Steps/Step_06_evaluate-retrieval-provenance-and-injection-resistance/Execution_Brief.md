# Execution Brief

## Exact Outcome

- Produce the concrete contracts, artifacts, and bounded implementation/design surfaces for Retrieval Provenance and Injection Resistance that this step is responsible for before any broader follow-on work begins.

## Prerequisites

- Re-read [[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Phase|Phase 02 document research and hybrid retrieval]] and confirm the step still matches the current roadmap sequence.
- Confirm the handoff from [[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Steps/Step_05_add-document-research-ux-and-citation-navigation|STEP-02-05 Add Document Research UX and Citation Navigation]] before widening scope.
- Keep deterministic work in typed Effect services, repositories, and tools; reserve Fred for agentic orchestration only.
- Treat the listed files as planned starting points; create only the smallest set needed to land the slice.

## Planned Starting Files

- These paths may not exist yet; use them as the first bounded implementation or design surface.
- `packages/evaluation/src/document-retrieval.ts`
- `packages/evaluation/src/prompt-injection.ts`
- `apps/api/test/document-research.integration.test.ts`
- `docs/retrieval-evaluation.md`

## Required Reading

- [[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Phase|Phase 02 document research and hybrid retrieval]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
- [[01_Architecture/System_Overview|System Overview]]
- [[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Steps/Step_05_add-document-research-ux-and-citation-navigation|STEP-02-05 Add Document Research UX and Citation Navigation]]
- `docs/product-brief.md` sections 9-11, 13, 16-18, 23-27, and 29-31.

## Concrete Deliverables

- Produce an evidence-backed validation pass for Retrieval Provenance and Injection Resistance, with explicit pass/fail criteria and durable output artifacts.
- Expose only the minimal API surface in `apps/api/test/document-research.integration.test.ts` needed to exercise this step end to end.
- Add deterministic evaluation or benchmark artifacts in `packages/evaluation/src/document-retrieval.ts`, `packages/evaluation/src/prompt-injection.ts` so this step can be judged without hand-waving.
- Capture the durable contract or operator guidance in `docs/retrieval-evaluation.md` rather than burying it in session-only notes.

## Smallest Bounded Checklist

- First, produce an evidence-backed validation pass for Retrieval Provenance and Injection Resistance, with explicit pass/fail criteria and durable output artifacts.
- Then, expose only the minimal API surface in `apps/api/test/document-research.integration.test.ts` needed to exercise this step end to end.
- Next, add deterministic evaluation or benchmark artifacts in `packages/evaluation/src/document-retrieval.ts`, `packages/evaluation/src/prompt-injection.ts` so this step can be judged without hand-waving.
- Finish by capturing the deterministic fixture, benchmark, or gate evidence that will let the validation plan judge the slice without guesswork.

## Constraints and Non-Goals

- Document parsing and chunking must preserve enough source location detail to build valid citations later.
- Hybrid retrieval should combine deterministic filters, text search, and vector search without collapsing them into one opaque score.
- Treat retrieved content as evidence only; prompt-injection resistance is part of the feature, not a later hardening pass.

## Related Notes

- Step: [[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Steps/Step_06_evaluate-retrieval-provenance-and-injection-resistance|STEP-02-06 Evaluate Retrieval Provenance and Injection Resistance]]
- Phase: [[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Phase|Phase 02 document research and hybrid retrieval]]
