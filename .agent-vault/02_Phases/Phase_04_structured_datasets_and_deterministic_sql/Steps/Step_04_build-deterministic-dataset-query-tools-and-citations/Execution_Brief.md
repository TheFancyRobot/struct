# Execution Brief

## Exact Outcome

- Add deterministic dataset query tools and immutable result snapshots whose citations and query history reopen the exact dataset snapshot, query, pinned engine, pinned adapter, protocol, execution-policy/config identity, columns, and row evidence used.

## Prerequisites

- STEP-04-03 is merged and its bounded query contract is stable.
- Read the parent phase, Agent Workflow, Domain Model, DEC-0006, DEC-0009, and STEP-04-03 Outcome.

## Deliverables

- Define `QueryResultSnapshot` and dataset citation schemas with branded IDs, canonical SQL, dataset snapshot/schema/result hashes, pinned engine identity, pinned adapter identity, protocol version, execution-policy/config identity, selected columns, row/range evidence, bounds, and timestamps.
- Persist query history/result snapshots transactionally and workspace-scoped together with the pinned engine, adapter, protocol, and execution-policy/config identity; immutable citations must never float to newer data.
- Add a narrow Fred tool adapter that calls the existing Effect query service; Fred may select/invoke the tool but cannot calculate or rewrite exact results.
- Add deterministic citation creation, validation, serialization, reopen/query-history API behavior, and synthesis inputs that clearly separate exact values from narrative.
- Use `Effect.Service`, `Effect.fn`, explicit layers, and specific serializable tagged failures consistent with existing project patterns.

## Constraints and Non-Goals

- Do not add a second executor, direct DuckDB access from Fred, new client state framework, or broad reporting UI.
- Never cite only a dataset name or mutable latest version.

## Handoff

- STEP-04-05 receives executable exact-computation questions and a stable result/citation format for ground truth.

## Related Notes

- Step: [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_04_build-deterministic-dataset-query-tools-and-citations|STEP-04-04 Build Deterministic Dataset Query Tools and Citations]]
- Phase: [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Phase|Phase 04 structured datasets and deterministic sql]]
