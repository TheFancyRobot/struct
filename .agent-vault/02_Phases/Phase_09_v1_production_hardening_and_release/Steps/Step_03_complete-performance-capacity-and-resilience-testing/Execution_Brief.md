# Execution Brief

## Exact Outcome

- Establish reproducible v1 reference workloads and modest latency/capacity budgets.
- Prove bounded interruption, retry, cancellation, resume, reconnect, and dependency-restart behavior without new infrastructure.

## Prerequisites

- STEP-09-02 is reviewed and merged, and its reset/restore procedure creates a reproducible test environment.
- Reuse existing Phase 02–08 evaluators, recovery/SSE tests, and Compose services.

## Planned Starting Files

- `packages/evaluation/src/benchmarks/run.ts`, existing phase runners, and `docs/benchmarks/`
- `apps/worker/test/`, worker polling/jobs, and research recovery suites
- API research/directory SSE routes and tests
- `packages/workflows` timeout/cancellation boundaries and `packages/data-engine` client tests

## Required Reading

- [[02_Phases/Phase_09_v1_production_hardening_and_release/Phase|Phase 09]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
- [[01_Architecture/Integration_Map|Integration Map]]
- [[04_Decisions/DEC-0011_gate-releases-on-a-reproducible-25000-file-evaluation-corpus|DEC-0011]]

## Concrete Deliverables

- Versioned reference workloads and budgets for ingestion, retrieval, query, research, report, SSE, and 25,000-file paths.
- Resilience coverage for PostgreSQL interruption, sidecar restart, worker replacement, provider timeout, cancellation, retry exhaustion, checkpoint resume, SSE reconnect, and backpressure.
- Concise report recording environment, limits, results, and operator action for failed budgets.

## Smallest Bounded Checklist

- Measure before optimizing; remediate only demonstrated bottlenecks or unsafe failures.
- Verify each product timeout/cancellation boundary reaches one terminal state with no duplicate durable effect and useful diagnostics.
- Run affected suites in isolation before repository-wide gates to separate harness timing from product defects.
- Review callers and persistence/event semantics for every remediation before PR.

## Constraints and Non-Goals

- Bun is the sole host runtime; PostgreSQL and the authenticated no-egress data-engine remain Compose services.
- The Fred global-timeout issue is filed upstream. Do not bypass Fred or build a replacement controller; retain product-owned elapsed budgets, abort signals, tool timeouts, and cleanup.
- Do not add infrastructure or compatibility/data-migration scope.
- Use Effect/SolidJS skills when touched; self-review affected code before PR and advance only with zero known defects.

## Related Notes

- [[02_Phases/Phase_09_v1_production_hardening_and_release/Steps/Step_03_complete-performance-capacity-and-resilience-testing|STEP-09-03]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
- [[04_Decisions/DEC-0011_gate-releases-on-a-reproducible-25000-file-evaluation-corpus|DEC-0011]]
