# Execution Brief

## Exact Outcome

- Produce the concrete contracts, artifacts, and bounded implementation/design surfaces for Recursive Fred Synthesis and Contradiction Handling that this step is responsible for before any broader follow-on work begins.

## Prerequisites

- Re-read [[02_Phases/Phase_06_recursive_corpus_analysis/Phase|Phase 06 recursive corpus analysis]] and confirm the step still matches the current roadmap sequence.
- Confirm the handoff from [[02_Phases/Phase_06_recursive_corpus_analysis/Steps/Step_03_implement-deterministic-batch-extraction-and-evidence-artifacts|STEP-06-03 Implement Deterministic Batch Extraction and Evidence Artifacts]] before widening scope.
- Keep deterministic work in typed Effect services, repositories, and tools; reserve Fred for agentic orchestration only.
- Treat the listed files as planned starting points; create only the smallest set needed to land the slice.

## Planned Starting Files

- These paths may not exist yet; use them as the first bounded implementation or design surface.
- `packages/workflows/src/agents/corpus-analyst.ts`
- `packages/workflows/src/agents/evidence-critic.ts`
- `packages/research-engine/src/merge-findings.ts`
- `packages/research-engine/src/contradiction-detection.ts`

## Required Reading

- [[02_Phases/Phase_06_recursive_corpus_analysis/Phase|Phase 06 recursive corpus analysis]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[02_Phases/Phase_06_recursive_corpus_analysis/Steps/Step_03_implement-deterministic-batch-extraction-and-evidence-artifacts|STEP-06-03 Implement Deterministic Batch Extraction and Evidence Artifacts]]
- `docs/product-brief.md` sections 14-15, 18-19, 22-25, 26-27, and 29-31.

## Concrete Deliverables

- Implement the narrowest typed slice for Recursive Fred Synthesis and Contradiction Handling that is callable by the next step without broadening scope.
- Capture the orchestration or synthesis rules in `packages/research-engine/src/merge-findings.ts`, `packages/research-engine/src/contradiction-detection.ts` without moving deterministic work out of services/tools.
- Keep Fred-specific graph/agent wiring isolated to `packages/workflows/src/agents/corpus-analyst.ts`, `packages/workflows/src/agents/evidence-critic.ts` and typed at every boundary.

## Smallest Bounded Checklist

- First, implement the narrowest typed slice for Recursive Fred Synthesis and Contradiction Handling that is callable by the next step without broadening scope.
- Then, capture the orchestration or synthesis rules in `packages/research-engine/src/merge-findings.ts`, `packages/research-engine/src/contradiction-detection.ts` without moving deterministic work out of services/tools.
- Next, keep Fred-specific graph/agent wiring isolated to `packages/workflows/src/agents/corpus-analyst.ts`, `packages/workflows/src/agents/evidence-critic.ts` and typed at every boundary.
- Finish by leaving one observable typed path—test, route, worker flow, or UI state—that proves the slice is ready for the next dependent step.

## Constraints and Non-Goals

- Use recursive decomposition only for semantic analysis; exact computation remains deterministic and out of scope for summarization.
- Every partition and merge stage must preserve evidence IDs, coverage, counterevidence, and limitations.
- Avoid summary-of-summaries degradation by reopening original evidence before asserting final claims.

## Related Notes

- Step: [[02_Phases/Phase_06_recursive_corpus_analysis/Steps/Step_04_implement-recursive-fred-synthesis-and-contradiction-handling|STEP-06-04 Implement Recursive Fred Synthesis and Contradiction Handling]]
- Phase: [[02_Phases/Phase_06_recursive_corpus_analysis/Phase|Phase 06 recursive corpus analysis]]
