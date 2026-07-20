# Implementation Notes

- `packages/domain/src/partition-status.ts` defines immutable metadata-only corpus manifests, stable digests, explicit skipped-entry state, partition plans, attempt-fenced leases, progress, and compact scheduler state.
- `packages/research-engine/src/partition-corpus.ts` implements a deterministic Effect service that canonicalizes UTF-8 ordering, groups by schema family/path/size/plan, packs item/byte/artifact bounds, builds a bounded acyclic fan-out tree, and rejects impossible lineage or budgets before dispatch.
- Scheduling enforces concurrency, monotonic elapsed time, token/cost/artifact budgets, cancellation, lease-loss recovery, bounded retry attempts, idempotent committed artifacts, and resume without duplicate work.
- Reconstructed plans retain per-partition estimates and are canonically revalidated with scheduler lease, artifact, total, progress, and terminal-state invariants before monitor or resume.
- Terminal cancellation and timeout preserve earlier terminal reasons; mixed completed, failed, and cancelled work converges deterministically to `partial`.
- Lease-loss recovery terminalizes a running final attempt instead of creating attempt N+1.
- Worker claim and resume publication use a transactional compare-and-swap contract, fencing concurrent workers that loaded the same durable snapshot.
- `packages/workflows/src/graphs/recursive-analysis.ts` remains deterministic and providerless; `apps/worker/src/jobs/partition-analysis.ts` composes the product-owned journal with enqueue, monitor, claim, and resume operations. No payload extraction, model/Fred execution, compatibility layer, migration, or UI was added.

## Related Notes

- Step: [[02_Phases/Phase_06_recursive_corpus_analysis/Steps/Step_02_implement-bounded-corpus-partitioning-and-scheduling|STEP-06-02 Implement Bounded Corpus Partitioning and Scheduling]]
- Phase: [[02_Phases/Phase_06_recursive_corpus_analysis/Phase|Phase 06 recursive corpus analysis]]
