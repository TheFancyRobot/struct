# Directory refresh recovery

Directory refresh recovery uses the existing product-owned journal, immutable
manifest, content-addressed artifact, and atomic PostgreSQL commit boundaries.
It does not introduce another queue, runtime, or recovery coordinator.

## Operator contract

- Retry the same logical directory job and idempotency key. A live worker must
  still own its lease; after a restart, expire and recover the old lease, then
  reclaim with a new attempt and token. A stale worker receives
  `StaleWorkerNoOp`.
- Discovery or hashing failure commits no manifest. A partial discovery result
  with any `DirectoryEntryFailure` is observable progress, not a committable
  snapshot.
- Content-addressed artifact writes may safely survive a failed attempt. A
  retry writes the same digest and does not create another logical artifact.
- Manifest persistence, source-version creation, final checkpoint allocation,
  and `directory-refresh-committed` event publication share one PostgreSQL
  transaction. Failure at any of those boundaries rolls back all four.
- Replaying a successful idempotency key returns the stored refresh result
  without adding a manifest, version, checkpoint, or terminal event.
- The portable permission fixture is always `restricted/denied.txt`. Tests
  inject its filesystem-adapter failure and never depend on host ACL behavior.

## Recovery procedure

1. Inspect the directory status projection for job state, attempt budget,
   per-entry failures, and the latest event cursor.
2. Correct the typed failure cause without changing the registered root or
   broadening filesystem access.
3. Retry the existing job through the directory control API. Do not create a
   replacement logical source for the same attempt.
4. Confirm terminal progress has `pending = 0` and that processed plus
   unsupported entries equals the committed manifest entry count.
5. Reconnect from the last event cursor and confirm exactly one
   `directory-refresh-committed` event.

## Verification

With the repository PostgreSQL service healthy and migrations applied:

```sh
DATABASE_URL=postgres://struct:struct@localhost:5432/struct \
  bun test apps/worker/test/directory-recovery.integration.test.ts \
  --max-concurrency 1 --timeout 30000
```

The integration test injects failure at discovery, hashing, artifact
persistence, source-version creation, event publication, and final checkpoint
persistence. Every case must show zero committed refresh-aggregate effects
before recovery, the expected lease-expiry/requeue/reclaim transitions, and
exactly one manifest, source version, terminal event, and checkpoint after
retry plus replay.

The hardware-independent deterministic gate is:

```sh
bun run directory:eval
```

Its checked-in result is
[`packages/evaluation/results/phase-03-directory-refresh-evaluation.json`](../../packages/evaluation/results/phase-03-directory-refresh-evaluation.json).
