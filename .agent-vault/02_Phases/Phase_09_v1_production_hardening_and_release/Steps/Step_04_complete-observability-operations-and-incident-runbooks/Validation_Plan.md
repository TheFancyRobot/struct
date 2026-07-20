# Validation Plan

## Acceptance Checks

- One successful and one failed journey preserve correlation across API, SSE, worker/workflow, persistence, and data-engine signals.
- Signals expose actionable state and measured budget violations without source content, prompts, credentials, or unbounded payloads.
- Health/readiness distinguish process health from dependency readiness and use typed failure classification.
- Every documented incident runbook is exercised locally or with deterministic fault injection and records expected recovery evidence.

## Planned Verification

- Add focused observability/redaction tests and run database, worker, sidecar, SSE, cancellation, restore, and secret-response game-day cases.
- Confirm trace/log/metric cardinality and support-diagnostic size are bounded.
- Run repository-wide typecheck, lint, boundaries, unit/integration tests, isolated Playwright where operator-visible status changes, build, docs lint, secret scan, and vault doctor.

## Edge Cases

- Nested error causes, retry histories, large prompts/source names, missing correlation context, duplicate terminal events, and concurrent runs.
- Telemetry exporter unavailable, database unavailable, worker stalled, sidecar unhealthy, SSE reconnect storm, and failed backup/restore.

## Regression Expectations

- Existing structured tracing and Effect failure semantics remain the single telemetry path.
- Instrumentation must not change business outcomes, leak secrets, create unbounded cardinality, or require a paid vendor.
- Review every newly logged field and affected error mapper before PR.

## Security / Observability / Evaluation Focus

- Redaction tests include identity, authorization, database/data-engine credentials, source content, prompts, and provider payloads.
- Runbooks name detection, diagnosis, containment, recovery, and verification without inventing an organization or platform.
- No known confirmed defect remains.

## Related Notes

- [[02_Phases/Phase_09_v1_production_hardening_and_release/Steps/Step_04_complete-observability-operations-and-incident-runbooks|STEP-09-04]]
- [[01_Architecture/Agent_Workflow|Agent Workflow]]
- [[01_Architecture/Integration_Map|Integration Map]]
