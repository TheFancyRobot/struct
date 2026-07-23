# Validation Plan

## Acceptance Checks

- Exact-answer, schema-family, citation, SQL guardrail, sidecar isolation, authentication, and real restart/replay categories each have explicit case counts and zero failures.
- Every exact result matches independent ground truth and every citation reopens immutable matching evidence.
- Restart tests reclaim expired work with a new lease/attempt and prove atomic rollback or idempotent replay at every injected boundary.

## Negative and Security Cases

- A plausible wrong answer, stale citation, SQL escape, cross-workspace access, auth bypass, network egress, arbitrary file access, duplicate durable record, or unrecovered partial artifact is a blocking failure.
- Include known bypass families plus mutation testing/negative controls that demonstrate the evaluator fails for non-idempotent replay and weakened SQL/isolation policy.
- Verify logs/reports redact credentials and internal host paths while retaining run/job/step identifiers.

## Deterministic Evidence

- Run: `bun run corpus:eval`
- Run: `bun run bench`
- Run: `bun run test && bun run test:integration && bun run test:e2e`
- Run: `docker compose config`
- Run: `bun run migrations:down && bun run migrations:up && bun run migrations:up`
- Run: `bun run typecheck && bun run lint && bun run lint:imports && bun run build`
- Run: `bun run docs:lint && bun run secrets:scan`
- Re-run the machine-readable evaluation and assert the hashed deterministic report fields remain byte-identical while the separate non-hashed machine-readable metadata envelope preserves volatile timings.

## Completion Gate

- Record exact commands, versions, pins, hardware assumptions, case counts, deterministic report hashes, preserved timing metadata, and zero unresolved defects in Outcome.md before Phase 04 can close.
