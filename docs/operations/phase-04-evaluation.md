# Phase 04 Exact-Computation Evaluation

STEP-04-06 evaluates the STEP-04-05 corpus through the real PostgreSQL catalog,
DuckDB sidecar, deterministic query service, and citation persistence path. The
full profile generates and verifies two byte-identical 25,000-file corpora
before evaluation. The smoke profile uses 250 files and is not scale evidence.

## Prerequisites

```bash
bun install --frozen-lockfile
bun run local:prepare
docker compose up -d --wait
bun run migrations:up
```

The maintained host uses Bun. The isolated data-engine image pins Node
`24.18.0` and DuckDB `1.5.4`; neither is a host prerequisite. The evaluator
defaults to the local Compose URL, bearer token, PostgreSQL URL, and
`.local/artifacts`. Override `DATA_ENGINE_URL`, `DATA_ENGINE_TOKEN`,
`DATABASE_URL`, or `ARTIFACT_STORAGE_ROOT` through the environment when needed.
Credentials are redacted by Effect configuration and are never written to the
report.

## Gates

```bash
# Fast deterministic integration, including interrupted completion/replay
bun run corpus:recovery

# Release-authoritative 25,000-file evaluation
bun run corpus:eval

# Machine-specific timing evidence; does not change correctness thresholds
bun run bench
```

`corpus:eval` writes
`packages/evaluation/results/phase-04-evaluation-v1.json`. It must report
`status: "passed"` with 100% exact answers and citation reopen success, all four
schema families with observed DuckDB types and nullability, all eight tagged
corpus-security classes, rejected unsafe SQL/authentication/egress/path cases,
inspected Compose isolation, client-disconnect recovery, atomic materialization
replay, and both negative controls. Run it twice and compare the report bytes or
`reportSha256`; timings are emitted separately so the normalized report remains
byte-identical.

The sidecar materializes corpus numeric values as `DECIMAL(38,18)`. This
preserves the canonical telemetry lexemes while rejecting values beyond 20
integer digits or 18 fractional digits instead of silently rounding them.

## Recovery and restart drill

The automated gate injects a failure between materialization state and terminal
event persistence, verifies transaction rollback, expires and reclaims the
lease, fences the stale attempt, and verifies exactly one materialization and
one terminal event. Each named recovery truth boundary is checked against
distinct durable evidence. The evaluator also waits for the sidecar's explicit
`102 Processing` start handshake before disconnecting a live expensive query,
then verifies that the sidecar accepts the next bounded query. Container checks
inspect the running sidecar's internal-only network, mounts, read-only root,
capability drop, no-new-privileges policy, and the gateway's loopback binding.

For the container-lifecycle drill, run:

```bash
docker compose restart data-engine data-engine-gateway
docker compose up -d --wait
bun run corpus:recovery
```

A failure is release-blocking. Preserve the command output and normalized
report, fix the product or evaluator defect, and rerun the complete gate; do not
weaken expected answers or policy cases to obtain a pass.
