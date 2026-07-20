# Implementation Notes

- Added a Bun operations CLI that confines recovery to loopback port 5432 and
  `struct*` databases, requires exact per-database destructive approval, and
  performs a network credential preflight before destructive or backup action.
- Greenfield reset drops and recreates only the approved database; it never
  deletes the bind-mounted `./.local/pgdata` tree. Backups use PostgreSQL custom
  format, mode-0600 partial files, atomic publication, and archive validation.
- The migration tracker persists SHA-256 checksums and rejects changed applied
  SQL. Compose validates configuration and waits for PostgreSQL, data-engine,
  and authenticated gateway health.
- `ops:recovery-proof` exercises representative workspace, source, research,
  report revision, citation, and provenance state through reset, dump, empty
  verification, restore, ownership fingerprint, append-only enforcement, and
  dependency restart. `ops application:verify` probes live web/API/worker
  readiness after deployment or rollback.
- Operator and architecture docs now follow the greenfield policy: no upgrade
  reindex runbook, cross-version rollback, compatibility layer, or
  data-preservation script.

## Related Notes

- Step: [[02_Phases/Phase_09_v1_production_hardening_and_release/Steps/Step_02_harden-deployments-migrations-backups-and-rollback|STEP-09-02 Harden Deployments Migrations Backups and Rollback]]
- Phase: [[02_Phases/Phase_09_v1_production_hardening_and_release/Phase|Phase 09 v1 production hardening and release]]
