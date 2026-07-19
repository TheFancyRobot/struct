# Validation Plan

## Acceptance Checks

- Confirm this deliverable is present, testable where applicable, and bounded to the step: An evidence-backed validation pass for Large-Tree Refresh Failures and Recovery, with explicit pass/fail criteria and durable output artifacts.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: Worker-side execution in `apps/worker/test/directory-recovery.integration.test.ts` to one resumable, observable path for this slice.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: Deterministic evaluation or benchmark artifacts in `packages/evaluation/src/directory-refresh.ts` so this step can be judged without hand-waving.
- The output includes a clear pass/fail signal, recorded defects or blockers, and the next action for anything intentionally left unresolved.
- Fixed gates require zero traversal escapes, zero duplicate committed artifacts or versions, exact manifest/diff reproducibility, exact terminal progress, and successful convergence after every injected restart point.
- The 1,000-file generated tree includes nested paths, unchanged, changed, removed, unsupported, permission-failure, and configured-limit cases with a fixed seed.
- Full repository, migration up/down/up, Compose configuration, API/worker/web smoke, observability, security, docs, and Agent Vault checks must pass before Phase 03 closes.

## Planned Verification

- Planned command once these packages exist: `bun test packages/evaluation` plus the nearest package-level `bun run typecheck`.
- Planned app/integration coverage once the app surfaces exist: `bun test apps/worker` for the API/worker/web path touched here.
- Run the evaluation/benchmark fixture for this slice and store the corpus, seed, or hardware assumptions alongside the result.

## Edge Cases

- Partial progress, retries, or restarts should leave this step in a typed, inspectable state rather than a silent half-success.
- Deleted files, renames, permission errors, and partially processed trees must preserve lineage and remain safe to retry.

## Regression Expectations

- This step should remain a clean successor to [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_05_expose-directory-status-recovery-and-controls|STEP-03-05 Expose Directory Status Recovery and Controls]] rather than reworking already-planned scope upstream.
- Do not introduce one-model-call-per-file behavior during directory-scale ingestion.
- Keep existing source-version and citation guarantees intact while adding refresh and lineage logic.
- Make sure large-tree recovery scenarios stay bounded in time, memory, and repeated work.

## Security / Observability / Evaluation Focus

- Protect against symlink escapes, traversal, ignore-rule bypasses, and oversized or noisy trees.
- Persist enough ingestion state to explain partial failure and to resume safely after restart.
- Expose user controls for retry, cancel, and inspection without leaking arbitrary host paths.
- Trace every restart, cancel, and replay decision with run/step identifiers so operators can reconstruct the timeline after failure.

## Related Notes

- Step: [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_06_test-large-tree-refresh-failures-and-recovery|STEP-03-06 Test Large-Tree Refresh Failures and Recovery]]
- Phase: [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Phase|Phase 03 durable directory ingestion and source refresh]]
