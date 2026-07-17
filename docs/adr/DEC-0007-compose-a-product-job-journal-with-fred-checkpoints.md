# DEC-0007: Compose a Product Job Journal with Fred Checkpoints

## Status

Accepted.

## Context

Ingestion and research runs are long-lived, cancelable, restartable workflows. The product must persist progress, retries, budgets, tool references, and failure state without storing private chain-of-thought. Fred provides orchestration and checkpointing, but the product also needs user-visible job state and operational traceability.

## Decision

Layer a product-owned job journal on top of Fred checkpoints. Fred remains responsible for orchestration and resumable workflow execution, while the product persists durable job metadata such as workflow identity, current step, completed steps, retries, budgets, tool-result references, and error summaries for ingestion and research runs.

## Alternatives

- Depend solely on Fred's internal checkpoint storage.
- Build a separate custom workflow engine outside Fred.
- Persist only final run results and reconstruct progress heuristically.

## Consequences

- Restart, resume, cancellation, and operator debugging become much more reliable.
- Product APIs can expose stable job and run state without leaking Fred internals.
- Additional persistence design is required for idempotency, retention, and replay semantics.
- The team must carefully distinguish useful execution facts from hidden model reasoning that should not be stored.

## Related Phase

- [PHASE-05 Typed Research Planning and Bounded Execution](../../.agent-vault/02_Phases/Phase_05_typed_research_planning_and_bounded_execution/Phase.md)
