# Execution Brief

## Exact Outcome

- Produce reproducible release-gate evidence that the integrated Phase 05 planner, graph, registry, journal/checkpoints, cancellation, retries, and recovery satisfy every phase acceptance criterion without duplicate side effects or unbounded execution.

## Prerequisites

- Re-read [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Phase|Phase 05 typed research planning and bounded execution]] and confirm the step still matches the current roadmap sequence.
- Confirm the handoff from [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Steps/Step_05_implement-tool-registry-typed-failures-retries-and-recovery|STEP-05-05 Implement Tool Registry Typed Failures Retries and Recovery]] before widening scope.
- Keep deterministic work in typed Effect services, repositories, and tools; reserve Fred for agentic orchestration only.
- Treat this as an evaluation/remediation step, not a new feature slice.

## Planned Starting Files

- `packages/evaluation/src/phase-05-evaluation.ts`
- `packages/evaluation/test/phase-05-evaluation.test.ts`
- `apps/worker/test/research-replay.integration.test.ts`
- `docs/operations/research-recovery.md`
- `docs/benchmarks/research-planning.md`

## Required Reading

- [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Phase|Phase 05 typed research planning and bounded execution]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
- [[01_Architecture/Domain_Model|Domain Model]]
- [[01_Architecture/System_Overview|System Overview]]
- [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Steps/Step_05_implement-tool-registry-typed-failures-retries-and-recovery|STEP-05-05 Implement Tool Registry Typed Failures Retries and Recovery]]
- `docs/product-brief.md` sections 13, 15, 18-24, 26-27, and 29-31.

## Concrete Deliverables

- Add a deterministic Phase 05 fixture/report that covers plan validation, routing, every execution limit, registered tool contracts, typed failures, cancellation, retries, replay, and restart recovery.
- Prove restart after planning, between tool attempt/commit, after checkpoint/event commit, and during cancellation preserves one terminal state and zero duplicate side effects.
- Document measured checkpoint size/replay latency plus exact automated/operator recovery classes, and tie the report to each phase acceptance criterion.

## Smallest Bounded Checklist

- Implement the deterministic fixture and machine-readable report with explicit pass/fail gates.
- Run it twice and require byte-identical deterministic portions plus zero duplicate side effects.
- Exercise live PostgreSQL and the existing Compose data-engine boundary for mixed document/dataset recovery; verify the Bun host remains healthy through sidecar failure/restart.
- Remediate confirmed defects only, then run the full repository, security, Compose, and vault gates and document operator recovery.

## Constraints and Non-Goals

- Research plans, tools, and workflow state must all use typed schemas and typed failures.
- Add no new planner, graph, persistence, tool, worker, API, or UI capability unless a failing gate proves a Phase 05 defect.
- Do not weaken thresholds, convert failures into skips, or substitute mocks for the required live PostgreSQL/sidecar recovery evidence.
- Maintained evaluation code runs with Bun; the isolated sidecar retains its pinned Node 24 LTS runtime.
- Keep deterministic inspection, retrieval, and SQL execution in Effect services/tools; Fred should orchestrate judgment, not replace core services.

## Related Notes

- Step: [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Steps/Step_06_evaluate-planning-execution-replay-and-recovery|STEP-05-06 Evaluate Planning Execution Replay and Recovery]]
- Phase: [[02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Phase|Phase 05 typed research planning and bounded execution]]
