# Recursive analysis 25,000-file evaluation

STEP-06-06 is a deterministic correctness, bounded-work, and recovery gate for
the production recursive partition scheduler. It creates exactly 25,000
immutable source-version entries, plans them through
`CorpusPartitioning`, interrupts leaf execution, restores a schema-validated
merge checkpoint, and verifies the resumed result against deterministic ground
truth. The companion worker probe exercises the production merge job with an
in-memory idempotency journal; it does not claim persistence-backend coverage.

## Fixed corpus and gates

The fixture uses 25 schema/path groups with 1,000 files each. The configured
500-item partition ceiling produces 50 equal partitions and an eight-node
decomposition. Ground truth includes a 0.1% minority signal (25 findings) and
50 contradictions distributed across the corpus.

The checked-in report passes only when:

- all 25,000 files are covered by the completed scheduler and restored merge
  checkpoint;
- a leaf interruption preserves four completed partitions, releases four
  interrupted leases, reclaims them at attempt two, and converges without
  duplicate effects;
- a merge interruption restores the identical committed partition-summary
  checkpoint without duplicate partition-summary identities;
- all 25 minority findings and all 50 contradictions survive aggregation;
- observed partition skew is at most 1.25;
- scheduler and merge checkpoints are each at most 256 KiB and artifacts stay
  by reference;
- elapsed work, partition and committed-artifact counts, per-artifact bytes,
  total committed artifact bytes, tokens, estimated cost, and concurrency stay
  within policy-derived bounds;
- the report status matches its criterion/blocker outcome and every required
  criterion appears exactly once, even when a tampered report has a recomputed
  hash; and
- two complete evaluation runs produce byte-identical reports and hashes.

## Recorded result

The authoritative report is
[`packages/evaluation/results/phase-06-recursive-analysis-v1.json`](../../packages/evaluation/results/phase-06-recursive-analysis-v1.json).
It records:

| Signal | Observed | Gate |
| --- | ---: | ---: |
| Files covered | 25,000 | 25,000 |
| Partitions | 50 | at most 100 |
| Partition skew | 1.00 | at most 1.25 |
| Scheduler checkpoint | 17,832 bytes | at most 262,144 bytes |
| Merge checkpoint | 9,362 bytes | at most 262,144 bytes |
| Minority findings retained | 25 of 25 | exact |
| Contradictions retained | 50 of 50 | exact |
| Maximum concurrency observed | 8 | at most 8 |
| Deterministic elapsed work | 7 ms | at most 600,000 ms |
| Committed artifacts | 50 | at most 100 |
| Largest artifact | 32,000 bytes | at most 65,536 bytes |
| Total committed artifacts | 1,600,000 bytes | at most 6,553,600 bytes |
| Tokens consumed | 500,000 | at most 1,000,000 |
| Estimated cost | 50,000 micros | at most 1,000,000 micros |

The report hash is
`8ff84fb361ec858954c0211435842f5ea3f9ec1e79bc649b85d2a3ad8fcfb01f`.
No scale blocker is recorded.

## Reproduce

```sh
bun run recursive:eval
```

Regenerate the tracked report only when an intentional fixture or contract
change has been reviewed:

```sh
bun run --filter @struct/evaluation phase-06:generate
```

On 2026-07-20, the repeated evaluator completed in 16.7 seconds on an Apple M2
Max with Bun 1.3.13; the worker recovery probe completed in 1.9 seconds.
Wall-clock results are machine-specific evidence only. `timingGate` remains
`null`, so correctness cannot be weakened or made flaky by a hardware-dependent
latency threshold.
