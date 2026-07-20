# Execution Brief

## Exact Outcome

- Make the existing Bun applications and Docker Compose PostgreSQL/data-engine topology reproducibly deployable.
- Prove clean create, destructive drop-recreate, backup/restore, application rollback, and dependency restart.

## Prerequisites

- STEP-09-01 is reviewed and merged with authentication, workspace scoping, and secret configuration documented.
- Start from the existing Compose file, migration manifest/runner, Bun scripts, and sidecar Dockerfile.

## Planned Starting Files

- `docker-compose.yml`, `services/data-engine-sidecar/Dockerfile`, and `.env.example`
- `packages/persistence/src/migrations/manifest.ts` and `runner.ts`
- `apps/api/src/migrations/run.ts`, root `package.json`, and `scripts/prepare-local-storage.ts`
- Existing operations docs plus minimal deployment/backup documents where needed.

## Required Reading

- [[02_Phases/Phase_09_v1_production_hardening_and_release/Phase|Phase 09]]
- [[01_Architecture/Integration_Map|Integration Map]]
- [[04_Decisions/DEC-0009_sandbox-filesystem-roots-and-allowlist-read-only-sql|DEC-0009]]
- STEP-09-01 outcome and security/configuration documentation.

## Concrete Deliverables

- Deterministic deployment/configuration checks for current topology, including health and startup ordering.
- Explicit greenfield reset/drop-recreate command and empty-state proof; no data-preservation scripts.
- Tested PostgreSQL backup/restore against representative v1 ownership, report, and provenance state.
- Tested application rollback and PostgreSQL/data-engine restart procedures with concise operator guidance.

## Smallest Bounded Checklist

- Prove clean environment → schema → representative state → healthy app.
- Prove backup → destructive reset → restore → integrity checks.
- Prove application rollback preserves durable state and sidecar restart preserves host safety.
- Run applicable integration/build/docs/security gates and review scripts for unsafe defaults.

## Constraints and Non-Goals

- Bun remains the only host runtime; Compose continues to own PostgreSQL and the authenticated no-egress data-engine.
- The database is greenfield with no production data: prefer drop-recreate, never compatibility/data-preservation machinery.
- No Kubernetes, cloud-specific control plane, new service, or zero-downtime cross-version machinery.
- Use Effect/SolidJS skills when touched; self-review affected code before PR and advance only with zero known defects.

## Related Notes

- [[02_Phases/Phase_09_v1_production_hardening_and_release/Steps/Step_02_harden-deployments-migrations-backups-and-rollback|STEP-09-02]]
- [[01_Architecture/Integration_Map|Integration Map]]
