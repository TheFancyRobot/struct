# Execution Brief

## Exact Outcome

- Produce the concrete contracts, artifacts, and bounded implementation/design surfaces for Mixed-Source Demo and Explorable Report that this step is responsible for before any broader follow-on work begins.

## Prerequisites

- Re-read [[02_Phases/Phase_07_hybrid_cross_source_research/Phase|Phase 07 hybrid cross source research]] and confirm the step still matches the current roadmap sequence.
- Confirm the handoff from [[02_Phases/Phase_07_hybrid_cross_source_research/Steps/Step_04_build-hybrid-synthesis-with-quantitative-guardrails|STEP-07-04 Build Hybrid Synthesis with Quantitative Guardrails]] before widening scope.
- Keep deterministic work in typed Effect services, repositories, and tools; reserve Fred for agentic orchestration only.
- Treat the listed files as planned starting points; create only the smallest set needed to land the slice.

## Planned Starting Files

- These paths may not exist yet; use them as the first bounded implementation or design surface.
- `apps/web/src/components/HybridReportView.tsx`
- `packages/evaluation/src/hybrid-demo.ts`
- `docs/demos/mixed-source-research.md`
- `apps/web/src/app/projects/[projectId]/reports/[reportId]/page.tsx`

## Required Reading

- [[02_Phases/Phase_07_hybrid_cross_source_research/Phase|Phase 07 hybrid cross source research]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[01_Architecture/System_Overview|System Overview]]
- [[02_Phases/Phase_07_hybrid_cross_source_research/Steps/Step_04_build-hybrid-synthesis-with-quantitative-guardrails|STEP-07-04 Build Hybrid Synthesis with Quantitative Guardrails]]
- `docs/product-brief.md` sections 9, 11-18, 22-24, 26-27, and 29-31.

## Concrete Deliverables

- Implement the narrowest typed slice for Mixed-Source Demo and Explorable Report that is callable by the next step without broadening scope.
- Use `apps/web/src/components/HybridReportView.tsx`, `apps/web/src/app/projects/[projectId]/reports/[reportId]/page.tsx` to expose only the UI states required to inspect this step’s output and failures.
- Add deterministic evaluation or benchmark artifacts in `packages/evaluation/src/hybrid-demo.ts` so this step can be judged without hand-waving.
- Capture the durable contract or operator guidance in `docs/demos/mixed-source-research.md` rather than burying it in session-only notes.

## Smallest Bounded Checklist

- First, implement the narrowest typed slice for Mixed-Source Demo and Explorable Report that is callable by the next step without broadening scope.
- Then, use `apps/web/src/components/HybridReportView.tsx`, `apps/web/src/app/projects/[projectId]/reports/[reportId]/page.tsx` to expose only the UI states required to inspect this step’s output and failures.
- Next, add deterministic evaluation or benchmark artifacts in `packages/evaluation/src/hybrid-demo.ts` so this step can be judged without hand-waving.
- Finish by capturing the deterministic fixture, benchmark, or gate evidence that will let the validation plan judge the slice without guesswork.

## Constraints and Non-Goals

- Hybrid research must route exact questions to deterministic tools and use semantic analysis only where judgment is actually needed.
- Cross-source synthesis should preserve the distinction between computed facts, retrieved claims, inferences, contradictions, and limitations.
- Representative records, document evidence, and final citations must stay explorable in the UI and report layers.

## Related Notes

- Step: [[02_Phases/Phase_07_hybrid_cross_source_research/Steps/Step_05_deliver-mixed-source-demo-and-explorable-report|STEP-07-05 Deliver Mixed-Source Demo and Explorable Report]]
- Phase: [[02_Phases/Phase_07_hybrid_cross_source_research/Phase|Phase 07 hybrid cross source research]]
