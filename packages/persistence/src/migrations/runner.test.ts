import { describe, it, expect, beforeEach } from 'bun:test'
import { Effect } from 'effect'
import { runMigrationsUp, runMigrationsDown, type SqlExecutorWithTransactions } from './runner'
import { migrations } from './manifest'

/**
 * Fake SQL executor that records executed queries.
 * Simulates the _migrations tracking table in-memory.
 * Supports transactions via begin() which just executes the callback.
 */
function createFakeSqlExecutor(): SqlExecutorWithTransactions & { queries: string[] } {
  const queries: string[] = []
  const appliedMigrations = new Set<string>()

  const executor: SqlExecutorWithTransactions & { queries: string[] } = {
    queries,
    async unsafe(query: string): Promise<unknown> {
      queries.push(query)

      // Simulate _migrations table queries
      if (query.includes('CREATE TABLE IF NOT EXISTS _migrations')) {
        return []
      }
      if (query.includes('SELECT name FROM _migrations')) {
        return Array.from(appliedMigrations).map((name) => ({ name }))
      }
      if (query.startsWith('INSERT INTO _migrations')) {
        const match = query.match(/'([^']+)'/)
        if (match) appliedMigrations.add(match[1])
        return []
      }
      if (query.startsWith('DELETE FROM _migrations WHERE name')) {
        const match = query.match(/'([^']+)'/)
        if (match) appliedMigrations.delete(match[1])
        return []
      }

      // For any other SQL (actual migration content), just record it
      return []
    },
    async begin<T>(fn: (tx: SqlExecutorWithTransactions) => Promise<T>): Promise<T> {
      // In the fake, just execute the callback with the same executor
      // (no real transaction semantics, but records queries correctly)
      return fn(executor)
    },
  }

  return executor
}

describe('Migration Runner', () => {
  let fakeSql: SqlExecutorWithTransactions & { queries: string[] }

  beforeEach(() => {
    fakeSql = createFakeSqlExecutor()
  })

  describe('runMigrationsUp', () => {
    it('creates _migrations tracking table first', async () => {
      await Effect.runPromise(runMigrationsUp(fakeSql))

      // The first query should create the tracking table
      expect(fakeSql.queries[0]).toContain('CREATE TABLE IF NOT EXISTS _migrations')
    })

    it('applies all pending migrations in order', async () => {
      await Effect.runPromise(runMigrationsUp(fakeSql))

      // Should have applied each migration
      const migrationNames = migrations.map((m) => m.name)
      for (const name of migrationNames) {
        const insertQuery = fakeSql.queries.find(
          (q) => q.startsWith('INSERT INTO _migrations') && q.includes(name),
        )
        expect(insertQuery).toBeDefined()
      }
      expect(fakeSql.queries.join('\n')).toMatch(
        /INSERT INTO source_text_reindex_jobs[\s\S]*FROM source_versions/i,
      )
      expect(fakeSql.queries.join('\n')).toMatch(
        /CREATE TRIGGER source_versions_enqueue_text_reindex/i,
      )
      expect(fakeSql.queries.join('\n')).toMatch(
        /CREATE TRIGGER event_journal_allocate_cursor_in_commit_order/i,
      )
      expect(fakeSql.queries.join('\n')).toMatch(
        /pg_advisory_xact_lock[\s\S]*nextval/i,
      )
      expect(fakeSql.queries.join('\n')).toMatch(
        /CREATE TABLE documents[\s\S]*CREATE TABLE document_chunks/i,
      )
      expect(fakeSql.queries.join('\n')).toMatch(
        /CREATE INDEX idx_document_chunks_search_vector[\s\S]*USING GIN/i,
      )
      expect(fakeSql.queries.join('\n')).toMatch(
        /CREATE TABLE document_chunk_embeddings[\s\S]*vector_dims\(embedding\) = dimensions/i,
      )
      expect(fakeSql.queries.join('\n')).toMatch(
        /vector_norm\(embedding\) > 0/i,
      )
      expect(fakeSql.queries.join('\n')).toMatch(
        /FOREIGN KEY \([\s\S]*chunk_id[\s\S]*source_version_id[\s\S]*REFERENCES document_chunks/i,
      )
      expect(fakeSql.queries.join('\n')).toMatch(
        /CREATE TABLE directory_ingestion_jobs[\s\S]*CREATE TABLE directory_ingestion_checkpoints/i,
      )
      expect(fakeSql.queries.join('\n')).toMatch(
        /CREATE TABLE directory_roots[\s\S]*CREATE TABLE directory_refresh_commits/i,
      )
      expect(fakeSql.queries.join('\n')).toMatch(
        /CREATE TABLE dataset_assets[\s\S]*CREATE TABLE dataset_snapshot_sources/i,
      )
    })

    it('skips already-applied migrations', async () => {
      // Pre-apply first migration
      await Effect.runPromise(runMigrationsUp(fakeSql))

      // Reset queries but keep applied state
      fakeSql.queries.length = 0

      // Run again
      await Effect.runPromise(runMigrationsUp(fakeSql))

      // Should not re-apply any migrations (only check queries)
      const migrationSqlQueries = fakeSql.queries.filter(
        (q) =>
          !q.includes('CREATE TABLE IF NOT EXISTS _migrations') &&
          !q.includes('SELECT name FROM _migrations') &&
          !q.startsWith('INSERT INTO _migrations'),
      )
      expect(migrationSqlQueries).toHaveLength(0)
    })
  })

  describe('runMigrationsDown', () => {
    it('reverts the last applied migration', async () => {
      // Apply all first
      await Effect.runPromise(runMigrationsUp(fakeSql))
      fakeSql.queries.length = 0

      // Revert last
      await Effect.runPromise(runMigrationsDown(fakeSql))

      // Should have deleted the last migration record
      const latestMigration = migrations[migrations.length - 1]
      const deleteQuery = fakeSql.queries.find(
        (q) =>
          q.startsWith('DELETE FROM _migrations WHERE name') &&
          q.includes(latestMigration?.name ?? ''),
      )
      expect(deleteQuery).toBeDefined()
      expect(fakeSql.queries.join('\n')).toMatch(
        /DROP TABLE IF EXISTS dataset_materializations[\s\S]*DELETE FROM job_queue[\s\S]*SELECT job_id FROM dataset_materialization_jobs[\s\S]*DROP TABLE IF EXISTS dataset_materialization_jobs/i,
      )
    })

    it('does nothing when no migrations are applied', async () => {
      await Effect.runPromise(runMigrationsDown(fakeSql))

      // Should only have the tracking table creation and select query
      const migrationQueries = fakeSql.queries.filter(
        (q) => !q.includes('CREATE TABLE IF NOT EXISTS _migrations') && !q.includes('SELECT name FROM _migrations'),
      )
      expect(migrationQueries).toHaveLength(0)
    })
  })
})
