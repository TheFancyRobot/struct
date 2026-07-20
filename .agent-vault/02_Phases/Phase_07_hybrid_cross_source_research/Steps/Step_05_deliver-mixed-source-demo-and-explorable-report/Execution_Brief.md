# Execution Brief

## Exact Outcome

- Produce the concrete contracts, artifacts, and bounded implementation/design surfaces for Mixed-Source Demo and Explorable Report that this step is responsible for before any broader follow-on work begins.

## Prerequisites

- Re-read [[02_Phases/Phase_07_hybrid_cross_source_research/Phase|Phase 07 hybrid cross source research]] and confirm the step still matches the current roadmap sequence.
- Confirm the handoff from [[02_Phases/Phase_07_hybrid_cross_source_research/Steps/Step_04_build-hybrid-synthesis-with-quantitative-guardrails|STEP-07-04 Build Hybrid Synthesis with Quantitative Guardrails]] before widening scope.
- Keep deterministic work in typed Effect services, repositories, and tools; reserve Fred for agentic orchestration only.
- Treat the listed files as planned starting points; create only the smallest set needed to land the slice.

## Planned Starting Files

- Start from the actual SolidJS workbench and add at most one adjacent focused component.
- `apps/web/src/pages/ResearchPage.tsx`
- `apps/web/src/components/ResearchStream.tsx`
- `apps/web/src/App.tsx`
- `apps/web/src/index.css`
- `apps/web/e2e`
- `docs/demos/mixed-source-research.md`

## Required Reading

- [[02_Phases/Phase_07_hybrid_cross_source_research/Phase|Phase 07 hybrid cross source research]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[01_Architecture/System_Overview|System Overview]]
- [[02_Phases/Phase_07_hybrid_cross_source_research/Steps/Step_04_build-hybrid-synthesis-with-quantitative-guardrails|STEP-07-04 Build Hybrid Synthesis with Quantitative Guardrails]]
- `docs/product-brief.md` sections 9, 11-18, 22-24, 26-27, and 29-31.

## Concrete Deliverables

- Implement the narrowest typed slice for Mixed-Source Demo and Explorable Report that is callable by the next step without broadening scope.
- Extend the existing SolidJS research page/stream or one adjacent focused component to expose the required output and failure states.
- Add a deterministic mixed-source browser fixture so the experience can be judged without hand-waving.
- Capture the durable contract or operator guidance in `docs/demos/mixed-source-research.md` rather than burying it in session-only notes.

## Smallest Bounded Checklist

- First, implement the narrowest typed slice for Mixed-Source Demo and Explorable Report that is callable by the next step without broadening scope.
- Then, extend the existing SolidJS research page/stream or one adjacent component with only the required states.
- Next, add the deterministic browser fixture and Playwright coverage required by the validation plan.
- Finish by capturing the deterministic fixture, benchmark, or gate evidence that will let the validation plan judge the slice without guesswork.

## Constraints and Non-Goals

- Hybrid research must route exact questions to deterministic tools and use semantic analysis only where judgment is actually needed.
- Cross-source synthesis should preserve the distinction between computed facts, retrieved claims, inferences, contradictions, and limitations.
- Representative records, document evidence, and final citations must stay explorable in the UI and report layers.

## Related Notes

- Step: [[02_Phases/Phase_07_hybrid_cross_source_research/Steps/Step_05_deliver-mixed-source-demo-and-explorable-report|STEP-07-05 Deliver Mixed-Source Demo and Explorable Report]]
- Phase: [[02_Phases/Phase_07_hybrid_cross_source_research/Phase|Phase 07 hybrid cross source research]]

## Refined Implementation Boundary — 2026-07-20

- Extend actual SolidJS surfaces: `apps/web/src/pages/ResearchPage.tsx`, `apps/web/src/components/ResearchStream.tsx` or one adjacent component, `apps/web/src/App.tsx`, `apps/web/src/index.css`, and `apps/web/e2e`.
- Expose one mixed run with plan/branch progress, cancellation/recovery, final answer, contradictions/limitations, and navigable document/dataset provenance.
- Follow `solidjs`: fine-grained reactivity, reactive props intact, correct control flow/resources/stores, and cleaned-up subscriptions/listeners.
- Follow `frontend-design` while preserving the NotebookLM-inspired slate/blue palette, current tokens, polished density, and explicit light/dark behavior. Add no parallel design system or decorative scope.
- Reuse current endpoints where possible; add only necessary read-model fields. Cover loading, live/partial, complete, contradictory/insufficient, cancelled, and failed states.
