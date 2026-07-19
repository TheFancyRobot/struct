# Validation Plan

## Acceptance Checks

- Allowed selects, CTEs, aggregates, joins, filters, grouping, ordering, and bounded projections return exact expected values and hashes.
- Equivalent repeated queries against the same snapshot return identical canonical metadata and results.
- Timeout, cancellation, row/output/memory limits, and sidecar unavailability map to distinct typed failures.

## Negative and Security Cases

- Table-driven rejection covers DDL/DML, comments/encoding tricks, multi-statements, attach/detach, copy/export, pragmas, extension loading, filesystem/network functions, URLs, absolute/traversal paths, unknown aliases, and cross-workspace snapshots.
- Missing/invalid service and user authentication fail before execution.
- Error responses contain no credentials, internal paths, raw engine stack, or unrestricted schema details.

## Deterministic Evidence

- Fixed fixtures assert exact rows, column types, canonical SQL, snapshot/schema/result hashes, truncation, and error tags.
- Run: `bun test packages/data-engine apps/api`
- Run: `bun run test:integration`
- Run: `docker compose config`
- Run: `bun run typecheck && bun run lint && bun run lint:imports && bun run build`
- Run: `bun run docs:lint && bun run secrets:scan`

## Completion Gate

- Add a regression case for every rejected SQL family and record exact results in Outcome.md; any bypass is a release-blocking defect.
