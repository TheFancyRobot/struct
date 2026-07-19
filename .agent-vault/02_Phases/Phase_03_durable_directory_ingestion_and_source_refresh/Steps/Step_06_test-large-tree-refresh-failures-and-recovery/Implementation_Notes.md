# Implementation Notes

- Capture durable findings learned during execution. Prefer short bullets with file paths, commands, and observed behavior.
- Added `packages/evaluation/src/directory-refresh.ts` with a fixed seed (`20260719`), two deterministic 1,000-file manifests, exact disposition checks, bounded preparation concurrency, and derived recovery evidence for all six failure boundaries.
- Added `apps/worker/test/directory-recovery.integration.test.ts`, which uses the existing discovery, artifact, worker refresh, and PostgreSQL repository boundaries. It injects discovery, hashing, artifact persistence, source-version creation, event publication, and final-checkpoint failures, then proves rollback, retry convergence, and idempotent replay.
- Preserved the production implementation unchanged: the existing Effect-native bounded concurrency, content-addressed storage, and atomic commit contracts passed every injected recovery boundary.
- Added machine-readable evidence at `packages/evaluation/results/phase-03-directory-refresh-evaluation.json` and operator/benchmark contracts at `docs/operations/directory-recovery.md` and `docs/benchmarks/directory-ingestion.md`.
- Self-review corrected the generated-tree path bucketing so the reported ten nested directories exactly match both manifests. No production defect remains known.
- Root review exercised the current migration rather than trusting the first green run. It exposed and fixed the missing `directory_root_id` in `DirectoryIngestionJobRepo.create`, then updated all repository and recovery fixtures.
- The checked-in evaluator now executes the real configured-entry-limit and canonical permission-failure paths and verifies the production preparation-concurrency constant.
- PR review remediation makes every injected failure cross a real worker-restart boundary: the original lease expires, recovery requeues it, a new attempt and lease token reclaim it, and only then does retry plus replay prove convergence.
- Terminal progress is derived from the decoded refreshed manifest instead of fixed constants, and the step's generated agent snapshot remains aligned with its pending PR state.
- Delta review replaced the evaluator's tautological Set replay with a boundary-staged model that records durable writes, computes duplicate artifacts/manifests/versions/events/checkpoints, and fails under tested non-atomic and non-idempotent policies.

## Related Notes

- Step: [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_06_test-large-tree-refresh-failures-and-recovery|STEP-03-06 Test Large-Tree Refresh Failures and Recovery]]
- Phase: [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Phase|Phase 03 durable directory ingestion and source refresh]]
