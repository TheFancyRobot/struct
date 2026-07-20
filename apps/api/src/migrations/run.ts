/**
 * Migration CLI entrypoint — creates the database pool and invokes the runner.
 *
 * Usage:
 *   bun run migrations:up   → applies all pending migrations
 *   bun run migrations:down → reverts the last applied migration
 *
 * This is the sole migration executor (architecture.md §6.5).
 * No other app or package may run migrations.
 *
 * Uses Effect resource safety (acquireRelease) to ensure the database
 * connection is always closed, even on failure.
 */

import { Effect, Redacted } from 'effect'
import postgres from 'postgres'
import { runMigrationsUp, runMigrationsDown, type SqlExecutorWithTransactions } from '@struct/persistence'
import { databaseUrlConfig } from '../config.js'

/**
 * Parse the --direction CLI argument.
 */
function parseDirection(): 'up' | 'down' {
  const args = process.argv.slice(2)
  const directionIdx = args.indexOf('--direction')
  if (directionIdx === -1 || !args[directionIdx + 1]) {
    console.error('Usage: bun src/migrations/run.ts --direction up|down')
    process.exit(1)
  }
  const direction = args[directionIdx + 1]
  if (direction !== 'up' && direction !== 'down') {
    console.error(`Invalid direction: ${direction}. Must be 'up' or 'down'.`)
    process.exit(1)
  }
  return direction
}

const direction = parseDirection()

const program = Effect.gen(function* () {
  const databaseUrl = yield* databaseUrlConfig

  // Use acquireRelease for resource safety — ensures sql.end() is always called
  const sql = yield* Effect.acquireRelease(
    Effect.sync(() => postgres(Redacted.value(databaseUrl))),
    (sql) => Effect.promise(() => sql.end()).pipe(Effect.ignore),
  )

  // Cast to SqlExecutorWithTransactions — postgres.Sql satisfies the interface
  const executor = sql as unknown as SqlExecutorWithTransactions

  if (direction === 'up') {
    yield* Effect.log('Running migrations UP...')
    yield* runMigrationsUp(executor)
    yield* Effect.log('All migrations applied successfully.')
  } else {
    yield* Effect.log('Running migrations DOWN...')
    yield* runMigrationsDown(executor)
    yield* Effect.log('Last migration reverted successfully.')
  }
})

// Run at the app boundary
Effect.runPromise(Effect.scoped(program)).catch((error) => {
  console.error('Migration failed:', error)
  process.exit(1)
})
