/**
 * SqlClient — Effect service wrapping the postgres.Sql connection pool.
 *
 * apps/api owns the pool and provides it via Layer.
 * Repositories consume SqlClient through dependency injection.
 *
 * Note: This uses Context.Tag (not Effect.Service) because it's an infrastructure
 * service that wraps an external resource (postgres.Sql), not business logic.
 */

import { Context, Layer } from 'effect'

/**
 * The SQL client interface exposed to repositories.
 * Wraps postgres.Sql's unsafe query method.
 */
export interface SqlClientShape {
  /** Execute a parameterized query. Returns raw rows. */
  readonly unsafe: (query: string, params?: readonly unknown[]) => Promise<readonly Record<string, unknown>[]>
}

// eslint-disable-next-line no-restricted-syntax -- Infrastructure service (wraps postgres.Sql), not business logic
export class SqlClient extends Context.Tag('@struct/persistence/SqlClient')<
  SqlClient,
  SqlClientShape
>() {}

/**
 * Create a Layer from a postgres.Sql instance.
 */
export const SqlClientLive = (sql: import('postgres').Sql): Layer.Layer<SqlClient> =>
  Layer.succeed(SqlClient, {
    unsafe: (query, params) => sql.unsafe(query, params as any[]).then((rows) => rows as readonly Record<string, unknown>[]),
  })

/**
 * Create a test Layer with a mock SQL client.
 */
export const SqlClientTest = (mockUnsafe: (query: string, params?: readonly unknown[]) => Promise<readonly Record<string, unknown>[]>): Layer.Layer<SqlClient> =>
  Layer.succeed(SqlClient, { unsafe: mockUnsafe })
