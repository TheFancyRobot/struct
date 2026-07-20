# Deployment and Recovery

Struct v1 runs its host applications with Bun and its PostgreSQL/data-engine
dependencies with Docker Compose. These commands are the executable operator
contract; they validate configuration and return nonzero on failure.

## Start and readiness

Set the required values from [`.env.example`](../../.env.example), then run:

```sh
bun install --frozen-lockfile
bun run ops stack:up
STRUCT_ALLOW_DESTRUCTIVE_RESET=struct bun run ops database:reset
bun run build
```

`stack:up` prepares the bind-mounted directories as the host user, validates
the Compose model, waits for PostgreSQL, the private data engine, and its
authenticated loopback gateway, then probes both dependencies. For the first
database creation, explicitly acknowledge the target database:

```sh
STRUCT_ALLOW_DESTRUCTIVE_RESET=struct bun run ops database:reset
```

These deployment examples require `DATABASE_URL` to end in `/struct`; for any
other allowed `struct*` database, set the approval to that exact database name.
The command drops and recreates that database and applies the
current schema. It does not delete `./.local`, follow symlinks, preserve old
rows, or run compatibility migrations.

## Backup and restore

Backups are PostgreSQL custom-format archives confined to `.local/backups`.
Creation uses a mode-`0600` partial file and publishes it only after `pg_dump`
succeeds:

```sh
bun run ops database:backup --output .local/backups/before-deploy.dump
bun run ops artifacts:backup --output .local/backups/before-deploy.artifacts
```

Restore validates the archive before changing the database, then requires the
same exact destructive approval used by reset:

```sh
STRUCT_ALLOW_DESTRUCTIVE_RESET=struct \
  bun run ops database:restore --input .local/backups/before-deploy.dump
STRUCT_ALLOW_DESTRUCTIVE_RESET=struct \
  bun run ops artifacts:restore --input .local/backups/before-deploy.artifacts
bun run ops database:verify
bun run ops artifacts:verify
```

Keep the `.dump` and `.artifacts` snapshots paired. PostgreSQL stores immutable
artifact references, while the artifact snapshot contains the bytes. Backup and
restore reject symlinks and verify every content-addressed object against the
SHA-256 digest in its path.

## Application rollback

Application rollback does not roll the schema backward. Before deployment,
retain the known-good Bun build artifact and create the database backup above.
If the new application is unhealthy:

1. Stop the Bun web, API, and worker processes; allow the worker to checkpoint.
2. Redeploy the retained known-good application artifact without running
   `migrations:down`.
3. Start the worker, API, then web. Run `bun run ops database:verify` followed
   by `bun run ops application:verify`; the latter fails unless the web root,
   public API health endpoint, and worker health endpoint all return success on
   their configured loopback ports.
4. If the current schema itself is unusable, restore the paired database and
   artifact-store backups with the guarded procedure above.

This is intentionally a same-schema application rollback. Struct is greenfield:
new schema development uses drop/recreate, not cross-version compatibility
layers or data-preservation scripts.

## Restart and recovery proof

Restart all Compose dependencies and wait for authenticated readiness:

```sh
bun run ops stack:restart
```

The isolated proof uses a dedicated database name ending in `_recovery_test`.
It creates representative workspace, source, research, report revision,
citation, provenance, and real content-addressed artifact bytes; backs both
stores up; resets them to empty; restores them; verifies the referenced bytes
against their digest, checks ownership joins and append-only enforcement,
restarts PostgreSQL and the data engine, and checks the same fingerprint again:

```sh
DATABASE_URL=postgres://struct:struct@127.0.0.1:5432/struct_recovery_test \
STRUCT_ALLOW_DESTRUCTIVE_RESET=struct_recovery_test \
ARTIFACT_STORAGE_ROOT=.local/artifacts_recovery_test \
DATA_ENGINE_TOKEN="$DATA_ENGINE_TOKEN" \
  bun run ops:recovery-proof
```

An interrupted dump leaves only a `.partial-*` file. An invalid or partial
archive fails validation before reset. Wrong hosts, unrelated database names,
missing exact approval, failed health checks, and PostgreSQL tool errors all
fail closed with a nonzero exit.
