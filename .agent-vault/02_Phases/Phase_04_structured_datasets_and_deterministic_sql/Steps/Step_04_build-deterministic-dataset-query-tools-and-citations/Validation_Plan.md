# Validation Plan

## Acceptance Checks

- Tool output equals the underlying deterministic service result; repeated calls persist/reuse the correct immutable result semantics.
- Every citation validates workspace, dataset snapshot, schema hash, canonical SQL, result hash, column, and row/range evidence and reopens the same evidence.
- Query history is ordered deterministically and cannot mutate prior result snapshots.

## Negative and Security Cases

- Reject stale/mismatched hashes, foreign-workspace IDs, nonexistent rows/columns, truncated evidence claims, tampered citation payloads, and uncited exact claims.
- Fred/model text cannot bypass the SQL validator, alter exact results, access the sidecar directly, or convert prompt-injection fixture text into instructions.
- Partial persistence rolls back; retries do not duplicate result snapshots or events.

## Deterministic Evidence

- Golden fixtures assert exact serialized result snapshots/citations and round-trip reopen behavior.
- Run: `bun test packages/domain packages/data-engine packages/fred-workflows packages/research-engine apps/api`
- Run: `bun run test:integration`
- Run: `bun run typecheck && bun run lint && bun run lint:imports && bun run build`
- Run: `bun run docs:lint && bun run secrets:scan`

## Completion Gate

- Record golden hashes and exact test results in Outcome.md; no exact answer may ship without valid immutable evidence.
