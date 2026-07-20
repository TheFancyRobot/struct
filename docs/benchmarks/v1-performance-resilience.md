# v1 performance, capacity, and resilience gate

This release gate composes the production evaluators and fault tests built in
Phases 02–08. It sets modest reference budgets for the first v1 deployment;
they are release ceilings, not marketing claims. Measurements were captured on
2026-07-20 with Bun 1.3.13 on a 12-core Apple M2 Max with 32 GiB RAM, using the
Compose PostgreSQL 16/pgvector and authenticated no-egress data-engine services.

## Reference workloads

| Workload | Capacity | Observed | v1 ceiling |
| --- | ---: | ---: | ---: |
| Directory ingestion | 1,000 files | 260 ms | 10,000 ms |
| Document retrieval evaluation | 1 deterministic suite | 220 ms | 2,000 ms |
| Structured query smoke | up to 1,000,000 input rows | 641 ms | 5,000 ms |
| Bounded research | 2 concurrent branches | 530 ms | 10,000 ms |
| Report fidelity | 1 MiB artifact ceiling | 650 ms | 5,000 ms |
| SSE reconnect/backpressure | 100 events per poll | 330 ms | 2,000 ms |
| Recursive analysis | 25,000 files | 16,700 ms | 600,000 ms |

The checked report includes hashes of every source evaluation artifact and
every referenced resilience proof. A
source artifact that is stale, tampered, or no longer passing invalidates this
gate. Host measurements are reference observations; deterministic correctness,
capacity, idempotency, and resource ceilings remain the portable gates.

## Resilience matrix

The focused suites cover PostgreSQL heartbeat interruption, authenticated
data-engine restart, distinct-process worker replacement, provider timeout,
durable cancellation, retry exhaustion, checkpoint resume, cursor reconnect,
and SSE backpressure. Each case asserts one typed terminal disposition, zero
duplicate durable effects, retained committed state, and bounded cleanup.

The deployment recovery proof additionally resets, backs up, restores, and
restarts the paired database and artifact store. Its cleanup always restores
the prior non-test artifact mount, including after a mid-proof failure; a
cleanup failure is reported alongside the primary failure.

## Reproduce

```sh
bun run v1:performance
```

This single release command executes the current Phase 02–08 workload
evaluators, the unit resilience matrix, the real PostgreSQL/data-engine/worker
fault suite, and the canonical report check. Every child command has a fixed
wall-clock ceiling and any failure or timeout makes the release gate fail.
PostgreSQL and the authenticated data-engine Compose services must be healthy.

The canonical report is
[`packages/evaluation/results/v1-performance-resilience-v1.json`](../../packages/evaluation/results/v1-performance-resilience-v1.json).
Regenerate it only after an intentional workload, budget, environment, or
source-evidence change:

```sh
bun run --filter @struct/evaluation v1:performance:generate
```

Any exceeded budget, missing fault case, source-report failure, nonzero
duplicate count, lost checkpoint, or unbounded task blocks release. Re-run the
focused evidence command and fix the demonstrated cause; do not relax a budget
to make a failure pass.
