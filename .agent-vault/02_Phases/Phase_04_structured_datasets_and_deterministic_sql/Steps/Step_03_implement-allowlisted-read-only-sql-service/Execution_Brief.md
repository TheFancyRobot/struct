# Execution Brief

## Exact Outcome

- Execute one authenticated, typed, allowlisted read-only SQL operation against cataloged immutable Parquet snapshots with deterministic bounded results.

## Prerequisites

- STEP-04-02 is merged and the sidecar/client protocol plus artifact boundary are stable.
- Read the parent phase, DEC-0005, DEC-0009, and the STEP-04-02 Outcome.

## Deliverables

- Parse and validate a single statement; allow only the required `SELECT`/CTE/aggregate/join subset over server-resolved catalog aliases.
- Reject DDL, DML, multi-statements, `COPY`, `ATTACH`, extension loading, unsafe pragmas/functions, arbitrary paths/URLs, and catalog escape.
- Validate again inside the sidecar; never trust only the Bun caller.
- Apply configured timeout, cancellation, row/output/memory limits, deterministic ordering requirements, and stable value encoding.
- Expose an authenticated workspace-scoped API/service boundary using `Effect.Service`, `Schema` request/response decoding, `Config`, and specific tagged failures without leaking engine internals.

## Constraints and Non-Goals

- No general SQL proxy, admin endpoint, shell, browser client-to-sidecar access, or write capability.
- No semantic query planner or model arithmetic; SQL text is deterministic input to a bounded engine.

## Handoff

- STEP-04-04 receives a stable query result contract containing canonical SQL, snapshot IDs, schema hash, result hash, columns, bounded rows, timing, and truncation state.

## Related Notes

- Step: [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_03_implement-allowlisted-read-only-sql-service|STEP-04-03 Implement Allowlisted Read-Only SQL Service]]
- Phase: [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Phase|Phase 04 structured datasets and deterministic sql]]
