# Directory ingestion correctness benchmark

This Phase 03 benchmark is a deterministic correctness and bounded-work gate.
It intentionally makes no hardware-independent latency claim. The 25,000-file
release corpus remains owned by the later evaluation phase.

## Fixture

`phase-03-directory-refresh-v1` uses seed `20260719` and caps each generated
snapshot at 1,000 files across ten nested directories.

| Refresh disposition | Count |
| --- | ---: |
| Unchanged | 850 |
| Modified | 75 |
| Removed | 50 |
| Added | 50 |
| Unsupported | 25 |

The refreshed snapshot still contains exactly 1,000 entries; removed entries
remain in lineage rather than in its current inventory. The separate configured
limit case observes entry 1,001 against a maximum of 1,000 and must fail closed.
The permission fixture uses `restricted/denied.txt`.

## Fixed gates

- Both snapshots contain exactly 1,000 entries.
- Rebuilding either snapshot produces the exact same ordered manifest and
  digest.
- The refresh plan reports the exact disposition counts above.
- Terminal progress is exactly 975 processed, 25 unsupported, and zero pending.
- Preparation concurrency remains bounded at four.
- Model calls remain zero.
- Discovery, hashing, artifact, version, event, and checkpoint failure cases
  each converge after one retry and one replay with zero duplicate manifests,
  versions, or events.

## Reproduce

Run the evaluator:

```sh
bun run directory:eval
```

Regenerate the checked-in machine-readable result:

```sh
bun run --filter @struct/evaluation directory:eval \
  results/phase-03-directory-refresh-evaluation.json
```

Run its regression tests:

```sh
bun test packages/evaluation --max-concurrency 1
```

The authoritative result is
[`packages/evaluation/results/phase-03-directory-refresh-evaluation.json`](../../packages/evaluation/results/phase-03-directory-refresh-evaluation.json).
It records Bun as the sole host runtime, a hardware-independent assumption,
four-way bounded preparation, and a `null` latency threshold.

