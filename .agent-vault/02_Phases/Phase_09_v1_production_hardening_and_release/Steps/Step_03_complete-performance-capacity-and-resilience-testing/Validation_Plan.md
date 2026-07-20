# Validation Plan

## Acceptance Checks

- Versioned reference workloads record environment, budgets, latency/throughput/resource observations, and deterministic pass/fail results.
- PostgreSQL interruption, data-engine restart, worker replacement, provider timeout, cancellation, retry exhaustion, checkpoint resume, SSE reconnect, and backpressure each reach one typed terminal disposition.
- No fault case duplicates a durable effect, exceeds its product-owned budget, silently loses committed progress, or leaves an unbounded task.
- The 25,000-file reference corpus and representative interactive journeys stay within explicitly documented v1 budgets.

## Planned Verification

- Reuse existing benchmark/evaluation runners and focused worker/API/data-engine recovery suites; add only missing deterministic fault cases.
- Run affected suites independently before the composite/repository-wide run to distinguish harness timing from product behavior.
- Run repository-wide typecheck, lint, boundaries, unit/integration tests, isolated Playwright suites, build, docs lint, secret scan, and vault doctor.

## Edge Cases

- Timeout during tool attempt, commit, checkpoint, cancellation, SSE disconnect, database transaction, and sidecar response.
- Retryable versus terminal failures; reconnect cursor gaps; concurrent cancellation/restart; saturated polling or event consumers.
- Cleanup and abort when Fred itself does not provide a native global timeout controller.

## Regression Expectations

- Preserve core Fred orchestration; do not bypass it or implement a competing controller.
- Preserve existing Effect interruption, elapsed budgets, tool timeouts, checkpoint/idempotency, and SSE semantics.
- Review all affected callers and durable event/persistence semantics for each optimization or recovery fix.

## Security / Observability / Evaluation Focus

- Fault diagnostics remain redacted, correlated, bounded, and actionable.
- A budget is not relaxed to make a failure pass; confirm root cause before remediation.
- Zero known confirmed defects is required before advancement.

## Related Notes

- [[02_Phases/Phase_09_v1_production_hardening_and_release/Steps/Step_03_complete-performance-capacity-and-resilience-testing|STEP-09-03]]
- [[04_Decisions/DEC-0011_gate-releases-on-a-reproducible-25000-file-evaluation-corpus|DEC-0011]]
