# Execution Brief

## Exact Outcome

- Produce the concrete contracts, artifacts, and bounded implementation/design surfaces for 25000-File Recursive Analysis and Recovery that this step is responsible for before any broader follow-on work begins.

## Prerequisites

- Re-read [[02_Phases/Phase_06_recursive_corpus_analysis/Phase|Phase 06 recursive corpus analysis]] and confirm the step still matches the current roadmap sequence.
- Confirm the handoff from [[02_Phases/Phase_06_recursive_corpus_analysis/Steps/Step_05_add-progress-drilldown-and-partial-result-ux|STEP-06-05 Add Progress Drilldown and Partial Result UX]] before widening scope.
- Keep deterministic work in typed Effect services, repositories, and tools; reserve Fred for agentic orchestration only.
- Treat the listed files as planned starting points; create only the smallest set needed to land the slice.

## Planned Starting Files

- These paths may not exist yet; use them as the first bounded implementation or design surface.
- `packages/evaluation/src/recursive-analysis.ts`
- `apps/worker/test/recursive-analysis.scale.test.ts`
- `docs/benchmarks/recursive-analysis.md`
- `docs/operations/recursive-analysis-recovery.md`

## Required Reading

- [[02_Phases/Phase_06_recursive_corpus_analysis/Phase|Phase 06 recursive corpus analysis]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[02_Phases/Phase_06_recursive_corpus_analysis/Steps/Step_05_add-progress-drilldown-and-partial-result-ux|STEP-06-05 Add Progress Drilldown and Partial Result UX]]
- `docs/product-brief.md` sections 14-15, 18-19, 22-25, 26-27, and 29-31.

## Concrete Deliverables

- Evaluate 25,000-file recursive analysis for correctness, bounded cost, resume behavior, and minority-finding retention.
- Capture benchmark and recovery evidence that shows large-corpus analysis can be interrupted and resumed without losing coverage state.
- Record the remaining scale blockers, especially around partition skew, checkpoint size, and contradiction handling.

## Smallest Bounded Checklist

- First, evaluate 25,000-file recursive analysis for correctness, bounded cost, resume behavior, and minority-finding retention.
- Then, capture benchmark and recovery evidence that shows large-corpus analysis can be interrupted and resumed without losing coverage state.
- Next, record the remaining scale blockers, especially around partition skew, checkpoint size, and contradiction handling.
- Finish by capturing the deterministic fixture, benchmark, or gate evidence that will let the validation plan judge the slice without guesswork.

## Constraints and Non-Goals

- Use recursive decomposition only for semantic analysis; exact computation remains deterministic and out of scope for summarization.
- Every partition and merge stage must preserve evidence IDs, coverage, counterevidence, and limitations.
- Avoid summary-of-summaries degradation by reopening original evidence before asserting final claims.

## Related Notes

- Step: [[02_Phases/Phase_06_recursive_corpus_analysis/Steps/Step_06_evaluate-25000-file-recursive-analysis-and-recovery|STEP-06-06 Evaluate 25000-File Recursive Analysis and Recovery]]
- Phase: [[02_Phases/Phase_06_recursive_corpus_analysis/Phase|Phase 06 recursive corpus analysis]]
