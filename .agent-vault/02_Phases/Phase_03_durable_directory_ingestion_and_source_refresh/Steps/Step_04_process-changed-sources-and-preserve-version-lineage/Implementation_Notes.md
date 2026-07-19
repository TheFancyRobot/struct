# Implementation Notes

- Capture durable findings learned during execution. Prefer short bullets with file paths, commands, and observed behavior.
- `packages/ingestion/src/diff-manifest.ts` is the pure path-based classifier and intentionally treats equal-hash moves as removal plus addition.
- `packages/source-storage/src/versioned-artifacts.ts` verifies discovered digest and length, then relies on the existing immutable content-addressed object store for replay reuse.
- `packages/persistence/src/repositories/source-versions.ts` owns the single fenced transaction. It serializes the registered root, rejects stale snapshot heads and foreign scope, then records manifest inventory, immutable artifact/source/document/index lineage, refresh checkpoint, and the event row.
- `apps/worker/src/jobs/refresh-directory.ts` exposes the one worker-callable path; event publication remains downstream of the committed journal row.
- Migration 0008 adds directory roots, snapshots, entries, artifact metadata, refresh lineage, and refresh checkpoints without adding a runtime, queue, or database.
- Root/PR review tightened topology-based head selection, unsupported-removal history, included-only staging, and safe sibling-cascade deletion semantics.

## Related Notes

- Step: [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Steps/Step_04_process-changed-sources-and-preserve-version-lineage|STEP-03-04 Process Changed Sources and Preserve Version Lineage]]
- Phase: [[02_Phases/Phase_03_durable_directory_ingestion_and_source_refresh/Phase|Phase 03 durable directory ingestion and source refresh]]
