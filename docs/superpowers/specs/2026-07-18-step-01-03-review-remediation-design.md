# STEP-01-03 Review Remediation Design

## Objective

Resolve the four confirmed STEP-01-03 review defects without widening the walking-slice scope, then re-run the complete zero-defect validation gate.

## Storage Containment

`LocalArtifactStore` will validate every existing filesystem component between its canonical storage root and each operation target. Existing symlinks, non-directory parent components, and real paths outside the root will fail with `StoragePathError`.

Directory creation and final rename will occur only after parent validation. The regression suite will replace a content-addressed digest-prefix directory with a symlink to an external directory, invoke `writeObject`, and verify a typed failure with no external file creation.

The same containment helper will protect object reads, staged reads, finalized-object writes, and staged writes so safety does not depend only on startup validation.

## Worker Database Readiness and Poll Failures

The worker will execute a real database validation query before logging that it is ready. An invalid or unreachable `DATABASE_URL` will make startup fail with a nonzero exit.

Repository failures during stale recovery or job claim will no longer be converted into empty recovery results or “no job.” They will remain typed failures, be logged by the worker loop, and cause the polling effect to fail instead of silently idling in a false-ready state.

## Atomic Source Registration

Source creation, ingestion-job enqueue, and `ingestion-requested` event append will execute through one persistence command inside a PostgreSQL transaction. Any failure rolls back all three database writes.

Project/workspace authorization and artifact staging remain outside this database transaction. A failed database command can leave an unreferenced staged artifact, but it cannot leave hidden durable ingestion work or a Source without its requested event. Staged-object lifecycle cleanup is outside STEP-01-03 and does not affect command atomicity.

The API service will accept a single atomic command dependency rather than independently invoking Source, JobQueue, and EventJournal repositories. Unit tests will verify one command call, and a real PostgreSQL integration test will force event insertion failure and verify that Source and job rows are absent.

## Environment Contract

`.env.example` will document:

- `MAX_TEXT_SOURCE_BYTES=1048576`
- `WORKER_POLL_INTERVAL_MS=1000`
- `WORKER_JOB_STALE_MS=300000`

These values match the existing Effect Config defaults.

## Error Handling

Filesystem policy violations will use the existing typed storage errors. Persistence failures will retain their typed repository error at the infrastructure boundary and be mapped to the existing sanitized API registration error at the HTTP-facing service boundary.

Worker polling will not broadly suppress repository failures. Per-job ingestion failures will continue to produce sanitized `ingestion-failed` events and retry or terminal state transitions.

## Validation

Verification will include:

1. Focused storage, worker, API, and persistence regression tests.
2. Worker entrypoint test against an unreachable database.
3. Real PostgreSQL rollback integration coverage for the atomic registration command.
4. Root frozen install, typecheck, lint, import boundaries, native Bun tests, and builds.
5. Real PostgreSQL test suite and migration down/up smoke.
6. Agent Vault refresh and integrity validation.

STEP-01-04 remains blocked until these gates pass and STEP-01-03 receives review approval.
