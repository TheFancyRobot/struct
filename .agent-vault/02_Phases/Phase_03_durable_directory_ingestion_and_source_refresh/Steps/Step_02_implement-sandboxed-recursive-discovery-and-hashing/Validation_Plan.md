# Validation Plan

## Acceptance Checks

- Confirm this deliverable is present, testable where applicable, and bounded to the step: The narrowest typed slice for Sandboxed Recursive Discovery and Hashing that is callable by the next step without broadening scope.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: `packages/ingestion/src/discover-directory.ts`, `packages/ingestion/src/path-safety.ts`, `packages/ingestion/src/hash-file.ts` to make discovery, classification, refresh, or job state deterministic before any model-dependent behavior is introduced.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: Worker-side execution in `apps/worker/src/jobs/scan-directory.ts` to one resumable, observable path for this slice.
- The step leaves the next dependent step with a stable typed boundary, not a placeholder or undocumented assumption.
- Tests cover `..` escapes, absolute paths, symlinks outside the root, symlink cycles, disappearing files, and depth/count/byte limit exhaustion with typed failures.
- Permission denial uses a portable injected filesystem-adapter fixture that returns the typed permission error for canonical path `restricted/denied.txt`; tests must not depend on host ACLs, user IDs, or container privileges.
- Repeated scans of the same tree produce the same ordered entries and hashes regardless of filesystem enumeration order.
- A bounded integration test proves the worker uses the discovery service without introducing another runtime or queue.

## Planned Verification

- Planned command once these packages exist: `bun test packages/ingestion` plus the nearest package-level `bun run typecheck`.
- Planned app/integration coverage once the app surfaces exist: `bun test apps/worker` for the API/worker/web path touched here.

## Edge Cases

- Partial progress, retries, or restarts should leave this step in a typed, inspectable state rather than a silent half-success.
- Deleted files, renames, permission errors, and partially processed trees must preserve lineage and remain safe to retry.
- Cancellation, duplicate actions, replay after restart, and stale source-version assumptions should produce deterministic terminal states.

## Regression Expectations

- This step should remain a clean successor to [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_01_define-directory-manifests-snapshots-and-refresh-semantics|STEP-03-01 Define Directory Manifests Snapshots and Refresh Semantics]] rather than reworking already-planned scope upstream.
- Do not introduce one-model-call-per-file behavior during directory-scale ingestion.
- Keep existing source-version and citation guarantees intact while adding refresh and lineage logic.
- Make sure large-tree recovery scenarios stay bounded in time, memory, and repeated work.

## Security / Observability / Evaluation Focus

- Protect against symlink escapes, traversal, ignore-rule bypasses, and oversized or noisy trees.
- Persist enough ingestion state to explain partial failure and to resume safely after restart.
- Expose user controls for retry, cancel, and inspection without leaking arbitrary host paths.
- Evaluation should verify provenance opening paths, contradiction reporting, and prompt-injection resistance for the evidence types touched here.

## Related Notes

- Step: [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_02_implement-sandboxed-recursive-discovery-and-hashing|STEP-03-02 Implement Sandboxed Recursive Discovery and Hashing]]
- Phase: [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Phase|Phase 03 durable directory ingestion and source refresh]]
