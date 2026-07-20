# Implementation Notes

- Capture durable findings learned during execution. Prefer short bullets with file paths, commands, and observed behavior.
- `packages/retrieval/src/batch-select.ts` owns the deterministic typed boundary: canonical plan identities, fatal UTF-8 JSON parsing, bounded filters/projections/groups, BigInt-backed exact decimal aggregates, RFC 6901 provenance, exclusion/truncation counts, and cooperative cancellation yields.
- `packages/research-engine/src/evidence-artifacts.ts` validates STEP-06-01/02 identities and immutable source bytes, then builds canonical bounded evidence bytes with distinct query/transformation identities and source-derived content labeled untrusted.
- `packages/source-storage/src/analysis-artifacts.ts` verifies digest and size before reusing the existing atomic content-addressed `ArtifactStore`.
- `apps/worker/src/jobs/build-partition-artifacts.ts` validates identities before durable lookup, reuses committed artifacts on retry, and publishes one commit-digested metadata aggregate through atomic commit-or-load. Failed storage, source restart, cancellation, and metadata commit do not expose partial evidence.
- Effect guidance shaped the slice through `Schema.TaggedError` typed failures, `Effect.Service` plus `Effect.fn` business boundaries, explicit `return yield*` failures, no nested runtimes, and cooperative interruption. Existing infrastructure `Context.Tag` seams remain unchanged.
- Root review established that the artifact byte bound is a transformation input. `computeBatchEvidenceTransformationIdentity` includes algorithm version, query identity, evidence schema version, and `maximumArtifactBytes`; the worker journal keys reuse by this identity while retaining query identity separately.
- Empty-match semantics are deterministic: grouped plans emit no groups, while ungrouped/global plans emit one empty-key group with count `0`, sum `0`, min/max `null`, and zero contributors.
- Selection-only plans without grouping or aggregation emit no phantom group.
- Numeric lexemes are checked before native JSON parsing; values that would overflow, underflow, or round to a different exact decimal are recorded as `unsafe-number` exclusions.

## Related Notes

- Step: [[02_Phases/Phase_06_recursive_corpus_analysis/Steps/Step_03_implement-deterministic-batch-extraction-and-evidence-artifacts|STEP-06-03 Implement Deterministic Batch Extraction and Evidence Artifacts]]
- Phase: [[02_Phases/Phase_06_recursive_corpus_analysis/Phase|Phase 06 recursive corpus analysis]]
