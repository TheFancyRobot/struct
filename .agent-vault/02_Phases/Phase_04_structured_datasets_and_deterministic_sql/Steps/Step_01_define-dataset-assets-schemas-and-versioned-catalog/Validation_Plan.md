# Validation Plan

## Acceptance Checks

- Domain schemas reject malformed identifiers, hashes, field definitions, and invalid lifecycle states.
- Repositories enforce workspace isolation, immutable snapshots, deterministic reads, valid source-version lineage, and schema-family uniqueness.
- A failed child insert rolls back its parent rows; duplicate/idempotent inputs have an explicit tested result.
- Migration up/down/up succeeds on a clean PostgreSQL database.

## Negative and Security Cases

- Reject foreign-workspace dataset, snapshot, schema-family, and source-version references.
- Reject mutation of immutable snapshot identity, content hash, or lineage.
- Decode failures and constraint failures surface as specific `Schema.TaggedError` values with only sanitized bounded fields, omit nested causes, and never include raw SQL, credentials, stored values, or parser internals.
- Leakage tests prove stringification, serialization, and response mapping for persistence/decode failures cannot expose raw SQL, credentials, internal host paths, stored values, parser values, or nested causes.

## Deterministic Evidence

- Fixed fixtures assert exact decoded values and stable ordering; PostgreSQL integration tests verify constraints and rollback.
- Run: `bun test packages/domain packages/persistence`
- Run: `bun run test:integration`
- Run: `bun run migrations:down && bun run migrations:up && bun run migrations:up`
- Run: `bun run typecheck && bun run lint && bun run lint:imports && bun run build`
- Run: `bun run docs:lint && bun run secrets:scan`

## Completion Gate

- Record exact counts/results in Outcome.md; no skipped catalog integration coverage or known defect may remain.
