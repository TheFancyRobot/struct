# Evaluation Corpus Generator

STEP-04-05 implements the structured JSON portion of the reproducible
evaluation corpus. Bun is the only generator runtime. Generation performs no
network, model, embedding, or provider calls.

## Fixed contract

- Corpus version: `1.0.0`
- Generator version: `1.0.0`
- Default seed: `5d4c02a1f3b8e617`
- Deterministic stream derivation: `sha256-seedsplit`
- Benchmark-environment schema version: `1.0.0`
- Full profile: exactly 25,000 JSON record files
- Smoke profile: exactly 250 JSON record files; it is not scale evidence
- Families: 12,000 call logs, 6,000 telemetry readings, 4,000 transactions,
  and 3,000 inventory items

The generated root also contains `manifest.json`, `ground-truth.json`,
`questions.json`, and the ownership marker used to make cleanup fail closed.
These four metadata files are not included in the 25,000-record count.

The full corpus occupied approximately 107 MiB of allocated local storage on
the validation machine and generated in about 2.5 seconds. These observations are
not portable performance thresholds.

## Generate and verify

Use an absolute output directory. The default seed is optional; pass `--seed`
to create a different internally consistent corpus.

```bash
bun run corpus:generate --profile full --out /absolute/path/corpus-a
bun run corpus:generate --profile full --out /absolute/path/corpus-b
bun run corpus:compare-hashes \
  /absolute/path/corpus-a/manifest.json \
  /absolute/path/corpus-b/manifest.json
```

`corpus:compare-hashes` verifies every generated file before comparing the
complete manifests. Any record, ground-truth, question-set, aggregate, or
manifest hash mismatch fails the command.

Generation only cleans a non-empty directory when that directory contains the
generator's ownership marker. It rejects relative output paths, repository or
filesystem roots, symlink output roots, traversal paths, duplicate manifest
paths, and non-regular files.

## Ground truth

The independent TypeScript oracle derives expected schemas, exact counts,
percentages, filters, groups, top-k rows, joins, date comparisons, distinct
values, null handling, row identities, result hashes, family snapshot hashes,
and citation targets without using the product SQL engine.

Controlled cases cover type conflicts, null and missing fields, duplicates,
numeric extremes, Unicode, contradictions, malformed shapes, schema drift,
changed/deleted records, inert prompt-injection text, and six replay
boundaries. The question set includes eight exact questions, one complete
schema question, one question for each of eight security truth classes, and
one recovery question. The compact checked-in evidence is
[`phase-04-corpus-v1.json`](../packages/evaluation/results/phase-04-corpus-v1.json);
the 25,000 generated records remain local artifacts.
