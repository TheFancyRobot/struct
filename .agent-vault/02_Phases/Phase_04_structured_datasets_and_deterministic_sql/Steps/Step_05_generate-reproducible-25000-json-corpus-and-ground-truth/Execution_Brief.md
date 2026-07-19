# Execution Brief

## Exact Outcome

- Generate a reproducible 25,000-file JSON corpus plus machine-checkable ground truth for exact computation, schema-family, security, and recovery evaluation.

## Prerequisites

- STEP-04-04 is merged and result/citation contracts are stable.
- Read the parent phase, DEC-0011, and STEP-04-04 Outcome.

## Deliverables

- Add a Bun generator with a fixed default seed, explicit version, deterministic paths/content/order, and a compact checked-in manifest instead of checking in all generated files.
- Produce exactly 25,000 JSON files across documented schema families with controlled distributions, joins, nulls, type conflicts, drift, duplicates, changed/deleted records, contradictions, Unicode, extremes, and prompt-injection strings treated only as data.
- Generate exact expected schemas, aggregates, filtered/joined answers, row identities, snapshot hashes, result hashes, and citation targets from an independent straightforward oracle.
- Add `corpus:generate`/existing evaluation script integration and document seed, generator version, storage/time assumptions, and regeneration.

## Constraints and Non-Goals

- Bun is the generator runtime; no second host runtime or model-generated ground truth.
- Keep the generator simple and deterministic; do not build a general property-testing platform.

## Handoff

- STEP-04-06 receives one command to regenerate, one manifest hash to verify, and versioned exact/security/recovery cases.

## Related Notes

- Step: [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Steps/Step_05_generate-reproducible-25000-json-corpus-and-ground-truth|STEP-04-05 Generate Reproducible 25000 JSON Corpus and Ground Truth]]
- Phase: [[02_Phases/Phase_04_structured_datasets_and_deterministic_sql/Phase|Phase 04 structured datasets and deterministic sql]]
