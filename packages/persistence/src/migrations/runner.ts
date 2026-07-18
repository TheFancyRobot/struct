/**
 * Migration Runner — applies and reverts SQL migrations in order.
 *
 * The runner uses a minimal `SqlExecutor` interface to decouple from the
 * concrete `postgres.Sql` type. In production, `apps/api` passes the real
 * `postgres.Sql` instance (which has an `.unsafe()` method). Tests use a
 * fake executor.
 *
 * Migration tracking: a `_migrations` table records applied migration names.
 * The runner reads this table to determine which migrations are pending.
 *
 * Atomicity: each migration is wrapped in a transaction to ensure the SQL
 * and tracking insert are atomic. If either fails, the entire migration is rolled back.
 *
 * Timestamp conversion note (design debt):
 * The domain schemas use `Schema.BigIntFromNumber` for timestamps.
 * PostgreSQL TIMESTAMPTZ columns return JavaScript `Date` objects.
 * Repository decode converts via `Date.getTime() → BigInt`.
 * This pattern is documented in the repository interfaces.
 */

import { Effect, Schema } from 'effect'
import { readFile } from 'node:fs/promises'
import { migrations } from './manifest.js'

/**
 * Minimal SQL executor interface.
 * The `postgres.Sql` type satisfies this via its `.unsafe()` method.
 */
export interface SqlExecutor {
  unsafe(query: string): Promise<unknown>
}

/**
 * SQL executor with transaction support.
 * The `postgres.Sql` type satisfies this.
 */
export interface SqlExecutorWithTransactions extends SqlExecutor {
  /**
   * Execute a function within a transaction.
   * If the function throws, the transaction is rolled back.
   * The transaction-scoped executor does NOT support nested transactions.
   */
  begin<T>(fn: (tx: SqlExecutor) => Promise<T>): Promise<T>
}

/**
 * Typed error for migration failures.
 * Uses Schema.TaggedError for serializable, structured error handling.
 */
export class MigrationError extends Schema.TaggedError<MigrationError>()('MigrationError', {
  migrationName: Schema.String,
  direction: Schema.Union(Schema.Literal('up'), Schema.Literal('down')),
  cause: Schema.String,
}) {}

const CREATE_TRACKING_TABLE = `
  CREATE TABLE IF NOT EXISTS _migrations (
    name TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`

const SELECT_APPLIED = `SELECT name FROM _migrations ORDER BY name`

const INSERT_MIGRATION = (name: string) =>
  `INSERT INTO _migrations (name) VALUES ('${name}')`

const DELETE_MIGRATION = (name: string) =>
  `DELETE FROM _migrations WHERE name = '${name}'`

/**
 * Read a SQL file from disk and return its contents.
 */
async function readSqlFile(filePath: string): Promise<string> {
  // Handle file:// URLs from import.meta.url
  const path = filePath.startsWith('file://')
    ? new URL(filePath).pathname
    : filePath
  return readFile(path, 'utf-8')
}

/**
 * Get the list of already-applied migration names.
 */
async function getAppliedMigrations(sql: SqlExecutor): Promise<Set<string>> {
  const rows = (await sql.unsafe(SELECT_APPLIED)) as Array<{ name: string }>
  return new Set(rows.map((r) => r.name))
}

/**
 * Apply all pending migrations in order.
 * Each migration is wrapped in a transaction for atomicity.
 */
export const runMigrationsUp = (sql: SqlExecutorWithTransactions): Effect.Effect<void, MigrationError, never> =>
  Effect.tryPromise({
    try: async () => {
      // Ensure tracking table exists (outside transaction, idempotent)
      await sql.unsafe(CREATE_TRACKING_TABLE)

      const applied = await getAppliedMigrations(sql)

      for (const migration of migrations) {
        if (applied.has(migration.name)) continue

        // Wrap migration SQL + tracking insert in a transaction
        await sql.begin(async (tx) => {
          const sqlContent = await readSqlFile(migration.upPath)
          await tx.unsafe(sqlContent)
          await tx.unsafe(INSERT_MIGRATION(migration.name))
        })
      }
    },
    catch: (cause) => new MigrationError({ migrationName: 'all', direction: 'up', cause: String(cause) }),
  })

/**
 * Revert the last applied migration.
 * The migration SQL and tracking delete are wrapped in a transaction for atomicity.
 */
export const runMigrationsDown = (sql: SqlExecutorWithTransactions): Effect.Effect<void, MigrationError, never> =>
  Effect.tryPromise({
    try: async () => {
      // Ensure tracking table exists (outside transaction, idempotent)
      await sql.unsafe(CREATE_TRACKING_TABLE)

      const applied = await getAppliedMigrations(sql)
      if (applied.size === 0) return

      // Find the last applied migration (by name ordering, which matches migration order)
      const lastAppliedName = Array.from(applied).sort().pop()
      if (!lastAppliedName) return

      const migration = migrations.find((m) => m.name === lastAppliedName)
      if (!migration) return

      // Wrap migration SQL + tracking delete in a transaction
      await sql.begin(async (tx) => {
        const sqlContent = await readSqlFile(migration.downPath)
        await tx.unsafe(sqlContent)
        await tx.unsafe(DELETE_MIGRATION(migration.name))
      })
    },
    catch: (cause) => new MigrationError({ migrationName: 'all', direction: 'down', cause: String(cause) }),
  })
