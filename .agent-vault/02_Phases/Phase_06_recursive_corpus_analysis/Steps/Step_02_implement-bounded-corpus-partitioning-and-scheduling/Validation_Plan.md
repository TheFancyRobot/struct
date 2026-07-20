# Validation Plan

## Acceptance Checks

- Confirm this deliverable is present, testable where applicable, and bounded to the step: Deterministic corpus partitioning that uses stable inputs, explicit partition IDs, and bounded parallel scheduling.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: A worker/job surface that can enqueue, resume, and monitor partition analysis without treating each file as its own agent run.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: Partition status metadata that later merge and UX steps can consume directly.
- The step leaves the next dependent step with a stable typed boundary, not a placeholder or undocumented assumption.

## Planned Verification

- Plan partitioning tests that prove the same corpus/question signature yields the same partition plan and IDs across runs.
- Plan scheduling tests for bounded concurrency, retry of one failed partition, and cancellation of an in-flight batch.
- Planned command once these packages exist: `bun test packages/domain packages/workflows packages/research-engine` plus the nearest package-level `bun run typecheck`.
- Planned app/integration coverage once the app surfaces exist: `bun test apps/worker` for the API/worker/web path touched here.

## Edge Cases

- Tiny and huge partitions both need guardrails; the planner should neither over-shard nor create prompt-busting mega-batches.
- A failed partition retry must not duplicate already-completed sibling work or lose coverage accounting.
- Partition IDs must survive restart and source-version comparison so cached findings remain reusable.

## Regression Expectations

- This step should remain a clean successor to [[02_Phases/Phase_06_recursive_corpus_analysis/Steps/Step_01_define-recursive-decomposition-and-aggregation-contracts|STEP-06-01 Define Recursive Decomposition and Aggregation Contracts]] rather than reworking already-planned scope upstream.
- Do not regress bounded execution, cancellation, or checkpoint/recovery while adding parallel corpus analysis.
- Keep minority findings and contradictions visible instead of flattening them into averages.
- Make sure large-corpus UX still points back to exact evidence rather than only synthesized prose.

## Security / Observability / Evaluation Focus

- Bound partition size, concurrency, intermediate artifact size, and model budgets before attempting 25,000-file analysis.
- Persist structured findings and evidence references so replay and audit remain possible.
- Carry prompt-injection defenses into batch extraction, partition prompts, and recursive merges.

## Related Notes

- Step: [[02_Phases/Phase_06_recursive_corpus_analysis/Steps/Step_02_implement-bounded-corpus-partitioning-and-scheduling|STEP-06-02 Implement Bounded Corpus Partitioning and Scheduling]]
- Phase: [[02_Phases/Phase_06_recursive_corpus_analysis/Phase|Phase 06 recursive corpus analysis]]

## Refined Acceptance and Commands

- Prove byte-for-byte identical partition/tree identities for reordered equivalent manifests and distinct identities for relevant source, plan, or policy changes.
- Prove every configured bound before and during scheduling, deterministic terminal reasons, bounded concurrency, cancellation interruption, lease-loss recovery, and no duplicate committed partition after resume.
- Prove empty, excluded, unreadable-metadata, oversized, mixed-schema, and exact-limit cases fail closed or produce typed partial state as specified.
- Run focused domain/research-engine/workflow/persistence tests, then `bun run typecheck`, `bun run test`, `bun run lint`, `bun run lint:imports`, `bun run build`, `bun run corpus:compare-hashes`, and `docker compose config --quiet` when persistence or Compose boundaries are touched.
- Inspect Phase 05 execution/replay and corpus-generator downstream tests for regressions caused by scheduling changes.
- Confirm updated step/context mirrors and `vault_validate target=doctor` are clean.
