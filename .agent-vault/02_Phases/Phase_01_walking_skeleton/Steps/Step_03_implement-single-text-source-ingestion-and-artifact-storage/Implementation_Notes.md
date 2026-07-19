# Implementation Notes

- Capture durable findings learned during execution. Prefer short bullets with file paths, commands, and observed behavior.

### 2026-07-18 refinement audit

- Audited current STEP-01-02 repository state before implementation: `source_versions` has required `artifact_ref` and `content_hash` with no status column; `job_queue` has status/attempt columns but no lock/error columns; `event_journal` is append-only with small JSONB payloads; repositories exist for Workspace/Project/Source/SourceVersion/ResearchThread/ResearchRun/Citation but not yet JobQueue/EventJournal.
- Refined the execution brief to avoid creating a fake pending SourceVersion. STEP-01-03 should enqueue by `sourceId`; the worker creates SourceVersion only after raw and normalized artifacts plus content hash exist.
- Refined storage/security requirements: canonical root validation, symlink/traversal rejection, atomic content-addressed writes, no raw source text or absolute host paths in payloads/logs/events, and an explicit byte cap for the walking slice.
- Refined worker ownership: atomic claim with `FOR UPDATE SKIP LOCKED`, stale in-progress recovery via `updated_at`/attempts, sanitized failure events, and terminal job status in the existing schema.

### 2026-07-18 lead-review remediation

- A store-startup symlink audit is insufficient: operation-time containment now walks and canonicalizes each existing component, including mutable digest-prefix and temp directories.
- Content-addressed publication verifies a same-filesystem temp file and atomically hard-links it into a non-overwriting destination; existing and raced destinations are hash-verified.
- PostgreSQL pools connect lazily, so the worker now executes `SELECT 1` before readiness and lets recovery/claim failures terminate the polling effect visibly.
- `SourceRegistrationRepo` owns one transaction for Source creation, ingestion-job enqueue, and `ingestion-requested`; row decoding stays inside that transaction so decode failure also rolls back.

### 2026-07-19 ingestion retryability remediation

- Worker retryability is an explicit typed decision, not an inference from remaining attempt budget or arbitrary error text. Known transient persistence/storage/index failures and the declared retryable wrapper may requeue; validation, authorization, path/ref, unsupported input, schema/hash/integrity/conflict, and unknown failures terminal-fail immediately.
- The sanitized `ingestion-failed` payload is exact and bounded: owned `jobId`/`attempt`, alphanumeric `errorTag`, fixed message, and boolean `retryable`. Persistence rejects retry inversion atomically.
- Unit and real-PostgreSQL controls prove first-attempt deterministic terminal failure, budgeted transient pending, exhausted transient terminal failure, and no duplicate terminal replay events.

## Related Notes

- Step: [[02_Phases/Phase_01_walking_skeleton/Steps/Step_03_implement-single-text-source-ingestion-and-artifact-storage|STEP-01-03 Implement Single Text Source Ingestion and Artifact Storage]]
- Phase: [[02_Phases/Phase_01_walking_skeleton/Phase|Phase 01 walking skeleton]]
