# Recursive analysis recovery

Recursive analysis recovery uses the existing product-owned scheduler and
journals. It does not add another queue, database, runtime, or recovery
coordinator. Bun is the only host runtime.

## Leaf-partition interruption

1. Load the durable partition plan and scheduler state by stable plan identity.
2. Validate the reconstructed state with `CorpusPartitioning.validate`.
3. Call the partition-analysis resume operation. It atomically changes active
   leases to `retryable`, preserves completed artifact references, and
   increments `recoveryCount`.
4. Claim retryable work. A recovered partition receives a new attempt-fenced
   lease; stale attempts must not commit.
5. Continue bounded claims and commits until the scheduler reaches a terminal
   state.

Do not delete completed partition artifacts or restart the plan from the
manifest. The evaluation proves that four completed partitions survive an
interruption while four active leases are reclaimed at attempt two.

## Merge-stage interruption

The deterministic evaluation's merge boundary is the committed
partition-summary checkpoint. It contains the plan and manifest identities,
exact examined-item count, and per-partition minority and contradiction
signals. The worker probe separately exercises the production merge job code
with an in-memory idempotency journal; neither probe claims to validate a
production persistence backend. After interruption:

1. decode and validate the checkpoint before use;
2. require its plan and manifest identities to match the durable run;
3. reuse the committed summaries instead of rerunning leaf analysis;
4. verify the restored examined-item count equals completed scheduler coverage;
   and
5. aggregate minority findings and contradictions from the checkpoint without
   dropping low-prevalence or conflicting evidence.

Large evidence artifacts remain by reference. Never embed original evidence
bodies in the checkpoint or synthesize a final claim from summaries without
reopening the referenced evidence.

## Operator gate

Run:

```sh
bun run recursive:eval
bun test --timeout 30000 --max-concurrency 1 \
  apps/worker/test/recursive-analysis.scale.test.ts
```

The first command must report `status: "passed"`,
`byteIdenticalRepeatedReport: true`, and the tracked report hash. The worker
probe must show the full 25,000-file plan, unchanged progress cardinality,
retryable interrupted leases, and attempt-two reclamation.

Inspect the report's `blockers` array and these signals before continuing:

- `partitionSkewRatio` must not exceed `maximumPartitionSkewRatio`;
- both checkpoint byte counts must not exceed `maximumCheckpointBytes`;
- retained minority and contradiction counts must exactly equal ground truth;
- coverage must remain complete;
- recovery transitions must be derived from changed scheduler identities;
- duplicate partition artifact and merge-summary identities must remain zero;
  and
- elapsed work, partition/artifact counts, per-artifact bytes, total committed
  artifact bytes, tokens, cost, and concurrency must remain within the report's
  policy-derived bounds.

Any failure is release-blocking. Preserve the failing report and command output,
fix the product or evaluator defect, regenerate only if the expected contract
intentionally changed, and rerun the complete gate. Do not weaken the fixture,
ground truth, or bounds to obtain a pass.
