# Validation Plan

## Acceptance Checks

- Confirm this deliverable is present, testable where applicable, and bounded to the step: The concrete contract for Directory Manifests Snapshots and Refresh Semantics in the first planned domain, persistence, or documentation files so downstream implementation does not need to rediscover the boundary.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: update typed domain modules for `Directory Manifest`, `SourceVersion` in `packages/domain/src/directory-manifest.ts`, `packages/domain/src/source-version.ts`.
- Confirm this deliverable is present, testable where applicable, and bounded to the step: `packages/ingestion/src/refresh-plan.ts` to make discovery, classification, refresh, or job state deterministic before any model-dependent behavior is introduced.
- The step leaves the next dependent step with a stable typed boundary, not a placeholder or undocumented assumption.

## Planned Verification

- Planned command once these packages exist: `bun test packages/domain packages/ingestion` plus the nearest package-level `bun run typecheck`.
- Review the paired doc/ADR/runbook output to confirm it matches the code-facing contract and names operator/developer prerequisites explicitly.

## Edge Cases

- Partial progress, retries, or restarts should leave this step in a typed, inspectable state rather than a silent half-success.
- Version drift, missing required fields, or ambiguous identity rules should be called out in the contract instead of deferred to implementation guesswork.
- Deleted files, renames, permission errors, and partially processed trees must preserve lineage and remain safe to retry.

## Regression Expectations

- This step should remain a clean successor to [[02_Phases/Phase_01_walking_skeleton/Steps/Step_06_automate-vertical-slice-tests-documentation-and-observability|STEP-01-06 Automate Vertical Slice Tests Documentation and Observability]] rather than reworking already-planned scope upstream.
- Do not introduce one-model-call-per-file behavior during directory-scale ingestion.
- Keep existing source-version and citation guarantees intact while adding refresh and lineage logic.
- Make sure large-tree recovery scenarios stay bounded in time, memory, and repeated work.

## Security / Observability / Evaluation Focus

- Protect against symlink escapes, traversal, ignore-rule bypasses, and oversized or noisy trees.
- Persist enough ingestion state to explain partial failure and to resume safely after restart.
- Expose user controls for retry, cancel, and inspection without leaking arbitrary host paths.

## Related Notes

- Step: [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_01_define-directory-manifests-snapshots-and-refresh-semantics|STEP-03-01 Define Directory Manifests Snapshots and Refresh Semantics]]
- Phase: [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Phase|Phase 03 durable directory ingestion and source refresh]]
