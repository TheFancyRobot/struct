# Execution Brief

## Exact Outcome

- Produce the concrete contracts, artifacts, and bounded implementation/design surfaces for Recursive Decomposition and Aggregation Contracts that this step is responsible for before any broader follow-on work begins.

## Prerequisites

- Re-read [[02_Phases/Phase_06_recursive_corpus_analysis/Phase|Phase 06 recursive corpus analysis]] and confirm the step still matches the current roadmap sequence.
- Confirm the handoff from [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Steps/Step_06_evaluate-planning-execution-replay-and-recovery|STEP-05-06 Evaluate Planning Execution Replay and Recovery]] before widening scope.
- Keep deterministic work in typed Effect services, repositories, and tools; reserve Fred for agentic orchestration only.
- Treat the listed files as planned starting points; create only the smallest set needed to land the slice.

## Planned Starting Files

- These paths may not exist yet; use them as the first bounded implementation or design surface.
- `packages/domain/src/research-finding.ts`
- `packages/domain/src/recursive-analysis.ts`
- `packages/research-engine/src/aggregation-schema.ts`
- `packages/research-engine/src/coverage-metadata.ts`

## Required Reading

- [[02_Phases/Phase_06_recursive_corpus_analysis/Phase|Phase 06 recursive corpus analysis]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Steps/Step_06_evaluate-planning-execution-replay-and-recovery|STEP-05-06 Evaluate Planning Execution Replay and Recovery]]
- `docs/product-brief.md` sections 14-15, 18-19, 22-25, 26-27, and 29-31.

## Concrete Deliverables

- Define the concrete contract for Recursive Decomposition and Aggregation Contracts in the first planned domain, persistence, or documentation files so downstream implementation does not need to rediscover the boundary.
- Define or update typed domain modules for `ResearchFinding`, `RecursiveAnalysis` in `packages/domain/src/research-finding.ts`, `packages/domain/src/recursive-analysis.ts`.
- Capture the orchestration or synthesis rules in `packages/research-engine/src/aggregation-schema.ts`, `packages/research-engine/src/coverage-metadata.ts` without moving deterministic work out of services/tools.

## Smallest Bounded Checklist

- First, define the concrete contract for Recursive Decomposition and Aggregation Contracts in the first planned domain, persistence, or documentation files so downstream implementation does not need to rediscover the boundary.
- Then, define or update typed domain modules for `ResearchFinding`, `RecursiveAnalysis` in `packages/domain/src/research-finding.ts`, `packages/domain/src/recursive-analysis.ts`.
- Next, capture the orchestration or synthesis rules in `packages/research-engine/src/aggregation-schema.ts`, `packages/research-engine/src/coverage-metadata.ts` without moving deterministic work out of services/tools.
- Finish by leaving one observable typed path—test, route, worker flow, or UI state—that proves the slice is ready for the next dependent step.

## Constraints and Non-Goals

- Use recursive decomposition only for semantic analysis; exact computation remains deterministic and out of scope for summarization.
- Every partition and merge stage must preserve evidence IDs, coverage, counterevidence, and limitations.
- Avoid summary-of-summaries degradation by reopening original evidence before asserting final claims.

## Related Notes

- Step: [[02_Phases/Phase_06_recursive_corpus_analysis/Steps/Step_01_define-recursive-decomposition-and-aggregation-contracts|STEP-06-01 Define Recursive Decomposition and Aggregation Contracts]]
- Phase: [[02_Phases/Phase_06_recursive_corpus_analysis/Phase|Phase 06 recursive corpus analysis]]
