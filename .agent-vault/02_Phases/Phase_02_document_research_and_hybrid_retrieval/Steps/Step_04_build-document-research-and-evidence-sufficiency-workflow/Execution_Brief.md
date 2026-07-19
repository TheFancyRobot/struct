# Execution Brief

## Exact Outcome

- Produce the concrete contracts, artifacts, and bounded implementation/design surfaces for Document Research and Evidence Sufficiency Workflow that this step is responsible for before any broader follow-on work begins.

## Prerequisites

- Re-read [[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Phase|Phase 02 document research and hybrid retrieval]] and confirm the step still matches the current roadmap sequence.
- Confirm the handoff from [[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Steps/Step_03_implement-keyword-vector-and-hybrid-retrieval|STEP-02-03 Implement Keyword Vector and Hybrid Retrieval]] before widening scope.
- Keep deterministic work in typed Effect services, repositories, and tools; reserve Fred for agentic orchestration only.
- Treat the listed files as planned starting points; create only the smallest set needed to land the slice.

## Planned Starting Files

- These paths may not exist yet; use them as the first bounded implementation or design surface.
- `packages/workflows/src/graphs/document-research.ts`
- `packages/research-engine/src/evidence-sufficiency.ts`
- `packages/retrieval/src/build-context.ts`
- `apps/worker/src/jobs/document-research.ts`
- `apps/api/src/routes/research.ts`

## Required Reading

- [[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Phase|Phase 02 document research and hybrid retrieval]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
- [[01_Architecture/System_Overview|System Overview]]
- [[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Steps/Step_03_implement-keyword-vector-and-hybrid-retrieval|STEP-02-03 Implement Keyword Vector and Hybrid Retrieval]]
- `docs/product-brief.md` sections 9-11, 13, 16-18, 23-27, and 29-31.

## Concrete Deliverables

- Implement the narrowest typed slice for Document Research and Evidence Sufficiency Workflow that is callable by the next step without broadening scope.
- Land the retrieval boundary in `packages/retrieval/src/build-context.ts` so ranking, filtering, and provenance remain inspectable and typed.
- Capture the orchestration or synthesis rules in `packages/research-engine/src/evidence-sufficiency.ts` without moving deterministic work out of services/tools.
- Keep Fred-specific graph/agent wiring isolated to `packages/workflows/src/graphs/document-research.ts` and typed at every boundary.

## Smallest Bounded Checklist

- First, implement the narrowest typed slice for Document Research and Evidence Sufficiency Workflow that is callable by the next step without broadening scope.
- Then, land the retrieval boundary in `packages/retrieval/src/build-context.ts` so ranking, filtering, and provenance remain inspectable and typed.
- Next, capture the orchestration or synthesis rules in `packages/research-engine/src/evidence-sufficiency.ts` without moving deterministic work out of services/tools.
- Finish by leaving one observable typed path—test, route, worker flow, or UI state—that proves the slice is ready for the next dependent step.

## Constraints and Non-Goals

- 2026-07-19 refinement: extend the existing bounded Fred adapter and Effect services after STEP-02-03 merges. Fred owns orchestration/judgment; deterministic retrieval, authorization, citation validation, persistence, timeouts, and failure handling remain product services. Do not bypass Fred core, expose chain-of-thought, add another runtime, or synthesize when evidence is insufficient or contradictory.
- Document parsing and chunking must preserve enough source location detail to build valid citations later.
- Hybrid retrieval should combine deterministic filters, text search, and vector search without collapsing them into one opaque score.
- Treat retrieved content as evidence only; prompt-injection resistance is part of the feature, not a later hardening pass.

## Related Notes

- Step: [[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Steps/Step_04_build-document-research-and-evidence-sufficiency-workflow|STEP-02-04 Build Document Research and Evidence Sufficiency Workflow]]
- Phase: [[02_Phases/Phase_02_document_research_and_hybrid_retrieval/Phase|Phase 02 document research and hybrid retrieval]]
