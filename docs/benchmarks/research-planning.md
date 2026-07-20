# Research Planning Evaluation

STEP-05-06 produces a deterministic, machine-readable Phase 05 release report
from schema-decoded live PostgreSQL and Compose evidence.

## Fixed release criteria

The report contains one direct fixture, observed result, pass status, and
SHA-256 evidence hash for each criterion:

1. schema-valid normalized plan or typed pre-execution failure;
2. rejection of cycles, missing dependencies, excess fan-out, unsupported
   tools/capabilities, and budget expansion;
3. typed registered Fred tools with authorization, schemas, timeouts, and
   idempotency policy;
4. run-bound, strictly ordered committed-event reconnect, idempotent
   cancellation, distinct-process replacement, and checkpoint resume/finalize;
5. observed restart boundaries after planning, after a dataset-query attempt
   before commit, after checkpoint/event commit, and during cancellation, plus
   typed provider/model failure history;
6. all eight plan budget ceilings plus direct step/model/tool/cost/time/fan-out,
   duplicate/no-progress, and per-tool grant policy gates;
7. typed transient failure, bounded retry history, and secret-free operator
   diagnostics;
8. registry-emitted golden trace regression;
9. Bun host plus authenticated, internal-network Node 24 DuckDB sidecar; and
10. a schema-decoded generic Fred gap reproduction with a non-blocking
   product-local adapter disposition.

## Reproduce

Start healthy Compose services and apply migrations, then run:

```sh
bun run --cwd apps/worker test:research-replay
cd packages/evaluation && bun run phase-05:eval
```

The live test writes machine-local timings under
`.local/evaluation/phase-05-live-metrics.json`. The evaluator schema-decodes
`.local/evaluation/phase-05-live-evidence.json`, writes the checked evidence
and report to `packages/evaluation/results`, runs the report twice, and requires
byte-identical serialized sections and identical `reportSha256`.

The reference report passes all ten criteria with hash
`7a5c4b92377ab905942431a003a197d20e740fa0bdb08af9b2b2ffa2d8ba61e0`.
Wall-clock metrics are intentionally excluded from the deterministic report.
