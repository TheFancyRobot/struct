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

## Refined Execution Contract

- Target-rooted reading: this brief and `Validation_Plan.md`; the parent Phase 06 note; `packages/domain/src/research-plan.ts`, `packages/domain/src/research-execution.ts`, and `packages/domain/src/typed-errors.ts`; then only the linked Domain Model, Agent Workflow, DEC-0007, DEC-0010, and DEC-0011 sections needed to settle a boundary.
- Add exported Effect Schema contracts and branded identities for recursive request, decomposition node, deterministic partition, batch input/result, evidence artifact reference, coverage, contradiction, aggregation result, sufficiency, and terminal/stop reason. Decode every persistence/network/model boundary and make invalid graphs or limits typed failures.
- Specify canonical ordering and hashing inputs so identical source versions, plan, contract version, and policy yield stable node, partition, artifact, and aggregation identities. Exclude timestamps, attempts, worker identity, and display text from identity.
- State invariants for lineage, supporting/conflicting/missing/excluded evidence, partial completeness, deterministic terminal reasons, depth/fan-out/concurrency/time/token/cost/byte/artifact limits, and checkpoint compatibility with Phase 05 execution state.
- Export the contracts through package entry points and add focused encode/decode, invalid-input, stable-hash/order, and invariant tests.
- Downstream check: compile existing planning, persistence, worker, API, and evaluation consumers so the new vocabulary does not duplicate or weaken Phase 05 contracts.
- Explicit non-goals: no scheduler, persistence migration, extraction, Fred workflow, API, UI, compatibility layer, or release action in this step.
