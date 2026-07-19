# Validation Plan

## Acceptance Checks

- The default command creates exactly 25,000 files and the documented schema-family/case counts.
- Two clean generations with the same seed/version have identical sorted per-file hashes, manifest hash, ground truth, and citation targets.
- A changed seed changes the corpus while remaining internally consistent; generation is independent of wall clock, locale, machine path, and filesystem enumeration order.

## Negative and Security Cases

- Assert coverage for schema drift/conflicts, null/missing fields, duplicates, extremes, Unicode, changed/deleted records, contradictions, malformed records, and prompt-injection strings.
- Generated content never becomes executable instructions or paths; cleanup is restricted to the configured generated-corpus root.
- Ground truth must fail if corpus content is tampered with.

## Deterministic Evidence

- Run: `bun run corpus:smoke`
- Run the new full generation command twice and compare manifest/ground-truth hashes.
- Run: `bun test packages/evaluation`
- Run: `bun run typecheck && bun run lint && bun run lint:imports && bun run build`
- Run: `bun run docs:lint && bun run secrets:scan`

## Completion Gate

- Record seed, generator version, exact counts, elapsed time, and hashes in Outcome.md; any nondeterminism blocks STEP-04-06.
