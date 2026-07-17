# Execution Brief

## Exact Outcome

- Produce the concrete contracts, artifacts, and bounded implementation/design surfaces for Progress Drilldown and Partial Result UX that this step is responsible for before any broader follow-on work begins.

## Prerequisites

- Re-read [[02_Phases/Phase_06_recursive_corpus_analysis/Phase|Phase 06 recursive corpus analysis]] and confirm the step still matches the current roadmap sequence.
- Confirm the handoff from [[02_Phases/Phase_06_recursive_corpus_analysis/Steps/Step_04_implement-recursive-fred-synthesis-and-contradiction-handling|STEP-06-04 Implement Recursive Fred Synthesis and Contradiction Handling]] before widening scope.
- Keep deterministic work in typed Effect services, repositories, and tools; reserve Fred for agentic orchestration only.
- Treat the listed files as planned starting points; create only the smallest set needed to land the slice.

## Planned Starting Files

- These paths may not exist yet; use them as the first bounded implementation or design surface.
- `apps/web/src/components/RecursiveRunTimeline.tsx`
- `apps/web/src/components/PartialFindingsPanel.tsx`
- `apps/api/src/routes/recursive-analysis.ts`
- `apps/api/src/routes/research-events.ts`

## Required Reading

- [[02_Phases/Phase_06_recursive_corpus_analysis/Phase|Phase 06 recursive corpus analysis]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[02_Phases/Phase_06_recursive_corpus_analysis/Steps/Step_04_implement-recursive-fred-synthesis-and-contradiction-handling|STEP-06-04 Implement Recursive Fred Synthesis and Contradiction Handling]]
- `docs/product-brief.md` sections 14-15, 18-19, 22-25, 26-27, and 29-31.

## Concrete Deliverables

- Implement the narrowest typed slice for Progress Drilldown and Partial Result UX that is callable by the next step without broadening scope.
- Expose only the minimal API surface in `apps/api/src/routes/recursive-analysis.ts`, `apps/api/src/routes/research-events.ts` needed to exercise this step end to end.
- Use `apps/web/src/components/RecursiveRunTimeline.tsx`, `apps/web/src/components/PartialFindingsPanel.tsx` to expose only the UI states required to inspect this step’s output and failures.

## Smallest Bounded Checklist

- First, implement the narrowest typed slice for Progress Drilldown and Partial Result UX that is callable by the next step without broadening scope.
- Then, expose only the minimal API surface in `apps/api/src/routes/recursive-analysis.ts`, `apps/api/src/routes/research-events.ts` needed to exercise this step end to end.
- Next, use `apps/web/src/components/RecursiveRunTimeline.tsx`, `apps/web/src/components/PartialFindingsPanel.tsx` to expose only the UI states required to inspect this step’s output and failures.
- Finish by leaving one observable typed path—test, route, worker flow, or UI state—that proves the slice is ready for the next dependent step.

## Constraints and Non-Goals

- Use recursive decomposition only for semantic analysis; exact computation remains deterministic and out of scope for summarization.
- Every partition and merge stage must preserve evidence IDs, coverage, counterevidence, and limitations.
- Avoid summary-of-summaries degradation by reopening original evidence before asserting final claims.

## Related Notes

- Step: [[02_Phases/Phase_06_recursive_corpus_analysis/Steps/Step_05_add-progress-drilldown-and-partial-result-ux|STEP-06-05 Add Progress Drilldown and Partial Result UX]]
- Phase: [[02_Phases/Phase_06_recursive_corpus_analysis/Phase|Phase 06 recursive corpus analysis]]
