# Execution Brief

## Exact Outcome

- Complete correlated, redacted signals across API, worker, workflows, persistence, and the data-engine boundary.
- Prove concise runbooks for incidents the existing v1 topology can actually encounter.

## Prerequisites

- STEP-09-03 is reviewed and merged; its measured budgets and failure modes define useful alerts and runbook triggers.
- Extend `packages/observability`; do not introduce a second telemetry abstraction or mandatory external platform.

## Planned Starting Files

- `packages/observability/src/tracing.ts` and tests
- `apps/api/src/main.ts`, route boundaries, and SSE routes
- `apps/worker/src/main.ts`, polling, and job execution
- `packages/workflows` and `packages/data-engine` error boundaries
- Existing recovery/operations documentation

## Required Reading

- [[02_Phases/Phase_09_v1_production_hardening_and_release/Phase|Phase 09]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
- [[01_Architecture/Integration_Map|Integration Map]]
- STEP-09-03 performance/resilience outcome.

## Concrete Deliverables

- Correlated logs/traces/metrics for request, workspace, run/job, tool, database, sidecar, SSE, and report lifecycle boundaries with deterministic redaction.
- Health/readiness and actionable failure classification aligned to measured v1 budgets.
- Minimal dashboard/alert specification and tested runbooks for database outage, worker stall, sidecar outage, stuck/cancelled research, SSE reconnect storms, backup/restore failure, and secret exposure.
- Bounded support diagnostics containing no source content, credentials, or sensitive prompts by default.

## Smallest Bounded Checklist

- Trace one success and one failure through API → worker/workflow → persistence/data-engine.
- Assert correlation continuity, terminal classification, redaction, and bounded diagnostic size.
- Exercise runbooks through local Compose or deterministic fault injection and record recovery.
- Run repository-wide gates and pre-PR review of every newly logged field.

## Constraints and Non-Goals

- Do not require a paid vendor, distributed control plane, or production on-call organization.
- Keep Bun as the sole host runtime and current Compose service topology.
- Use Effect/SolidJS skills when touched; self-review affected code before PR and advance only with zero known defects.

## Related Notes

- [[02_Phases/Phase_09_v1_production_hardening_and_release/Steps/Step_04_complete-observability-operations-and-incident-runbooks|STEP-09-04]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
- [[01_Architecture/Integration_Map|Integration Map]]
