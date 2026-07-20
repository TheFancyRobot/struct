# Validation Plan

## Acceptance Checks

- A clean machine/environment can prepare storage, start Compose services, create the schema, and reach healthy API/web/worker paths using documented commands.
- Destructive drop-recreate is explicit, guarded, and proven from empty state without compatibility or data-preservation logic.
- A PostgreSQL backup restores representative authenticated workspace, source, research, report, revision, citation, and provenance state with integrity checks.
- Application rollback plus PostgreSQL/data-engine restart procedures are executable and leave durable state coherent.

## Planned Verification

- Exercise clean create, migration up/down where already supported, drop-recreate, backup, restore, application rollback, and both service restarts in Compose.
- Verify migration manifest ordering/checksums and restored foreign-key/ownership/immutability invariants with PostgreSQL integration tests.
- Run repository-wide typecheck, lint, import boundaries, unit/integration tests, build, docs lint, secret scan, and vault doctor.

## Edge Cases

- Empty database, interrupted migration/backup/restore, wrong credentials, missing volume, stale container, corrupted/partial backup, and sidecar restart during an in-flight request.
- Destructive commands invoked against an unapproved environment must fail safely.

## Regression Expectations

- Bun remains the only host runtime and Docker Compose remains the PostgreSQL/data-engine owner.
- Current API/worker startup, migration runner, immutable artifacts, and evaluation fixtures remain green after clean recreation and restore.
- Review every script/config caller affected by command or environment changes before PR.

## Security / Observability / Evaluation Focus

- Backups and diagnostics contain no credentials; restored workspace isolation is tested, not assumed.
- Commands expose actionable exit status and logs without leaking secrets.
- No confirmed defect or unexercised recovery claim may advance.

## Related Notes

- [[02_Phases/Phase_09_v1_production_hardening_and_release/Steps/Step_02_harden-deployments-migrations-backups-and-rollback|STEP-09-02]]
- [[01_Architecture/Integration_Map|Integration Map]]
