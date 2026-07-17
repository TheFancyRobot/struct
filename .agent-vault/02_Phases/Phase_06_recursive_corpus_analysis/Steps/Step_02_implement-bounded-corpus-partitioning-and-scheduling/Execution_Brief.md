# Execution Brief

## Exact Outcome

- Produce the concrete contracts, artifacts, and bounded implementation/design surfaces for Bounded Corpus Partitioning and Scheduling that this step is responsible for before any broader follow-on work begins.

## Prerequisites

- Re-read [[02_Phases/Phase_06_recursive_corpus_analysis/Phase|Phase 06 recursive corpus analysis]] and confirm the step still matches the current roadmap sequence.
- Confirm the handoff from [[02_Phases/Phase_06_recursive_corpus_analysis/Steps/Step_01_define-recursive-decomposition-and-aggregation-contracts|STEP-06-01 Define Recursive Decomposition and Aggregation Contracts]] before widening scope.
- Keep deterministic work in typed Effect services, repositories, and tools; reserve Fred for agentic orchestration only.
- Treat the listed files as planned starting points; create only the smallest set needed to land the slice.

## Planned Starting Files

- These paths may not exist yet; use them as the first bounded implementation or design surface.
- `packages/research-engine/src/partition-corpus.ts`
- `packages/fred-workflows/src/graphs/recursive-analysis.ts`
- `apps/worker/src/jobs/partition-analysis.ts`
- `packages/domain/src/partition-status.ts`

## Required Reading

- [[02_Phases/Phase_06_recursive_corpus_analysis/Phase|Phase 06 recursive corpus analysis]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[02_Phases/Phase_06_recursive_corpus_analysis/Steps/Step_01_define-recursive-decomposition-and-aggregation-contracts|STEP-06-01 Define Recursive Decomposition and Aggregation Contracts]]
- `docs/product-brief.md` sections 14-15, 18-19, 22-25, 26-27, and 29-31.

## Concrete Deliverables

- Implement deterministic corpus partitioning that uses stable inputs, explicit partition IDs, and bounded parallel scheduling.
- Wire a worker/job surface that can enqueue, resume, and monitor partition analysis without treating each file as its own agent run.
- Record partition status metadata that later merge and UX steps can consume directly.

## Smallest Bounded Checklist

- First, implement deterministic corpus partitioning that uses stable inputs, explicit partition IDs, and bounded parallel scheduling.
- Then, wire a worker/job surface that can enqueue, resume, and monitor partition analysis without treating each file as its own agent run.
- Next, record partition status metadata that later merge and UX steps can consume directly.
- Finish by leaving one observable typed path—test, route, worker flow, or UI state—that proves the slice is ready for the next dependent step.

## Constraints and Non-Goals

- Use recursive decomposition only for semantic analysis; exact computation remains deterministic and out of scope for summarization.
- Every partition and merge stage must preserve evidence IDs, coverage, counterevidence, and limitations.
- Avoid summary-of-summaries degradation by reopening original evidence before asserting final claims.

## Related Notes

- Step: [[02_Phases/Phase_06_recursive_corpus_analysis/Steps/Step_02_implement-bounded-corpus-partitioning-and-scheduling|STEP-06-02 Implement Bounded Corpus Partitioning and Scheduling]]
- Phase: [[02_Phases/Phase_06_recursive_corpus_analysis/Phase|Phase 06 recursive corpus analysis]]
