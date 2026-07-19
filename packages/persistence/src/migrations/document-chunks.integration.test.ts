import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { Effect } from 'effect'
import postgres from 'postgres'
import type postgresTypes from 'postgres'
import {
  runMigrationsDown,
  runMigrationsUp,
  type SqlExecutor,
  type SqlExecutorWithTransactions,
} from './runner.js'

const DATABASE_URL = process.env['DATABASE_URL']
const describeIf = DATABASE_URL ? describe : describe.skip
const schemaName = `document_chunks_${crypto.randomUUID().replaceAll('-', '')}`

function migrationExecutor(
  sql: postgresTypes.Sql,
): SqlExecutorWithTransactions {
  return {
    unsafe: (query) => sql.unsafe(query) as Promise<unknown>,
    begin: <T>(run: (transaction: SqlExecutor) => Promise<T>) =>
      sql.begin((transaction) =>
        run({
          unsafe: (query) => transaction.unsafe(query) as Promise<unknown>,
        }),
      ) as Promise<T>,
  }
}

describeIf('document chunk migration (PostgreSQL)', () => {
  let admin: postgresTypes.Sql
  let scoped: postgresTypes.Sql

  beforeAll(async () => {
    if (!DATABASE_URL) return
    admin = postgres(DATABASE_URL, { max: 1, idle_timeout: 5 })
    await admin.unsafe(`CREATE SCHEMA "${schemaName}"`)
    scoped = postgres(DATABASE_URL, {
      max: 1,
      idle_timeout: 5,
      connection: { search_path: `"${schemaName}",public` },
    })
    await Effect.runPromise(runMigrationsUp(migrationExecutor(scoped)))
  })

  afterAll(async () => {
    if (scoped) await scoped.end()
    if (admin) {
      await admin.unsafe(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`)
      await admin.end()
    }
  })

  it('enforces tenant lineage and supports full-text chunk lookup', async () => {
    await scoped.unsafe(`
      INSERT INTO workspaces (id, name)
      VALUES
        ('e70e8400-e29b-41d4-a716-446655440000', 'Chunk Workspace'),
        ('e70e8400-e29b-41d4-a716-446655440009', 'Other Workspace');
      INSERT INTO projects (id, workspace_id, name)
      VALUES (
        'e70e8400-e29b-41d4-a716-446655440001',
        'e70e8400-e29b-41d4-a716-446655440000',
        'Chunk Project'
      );
      INSERT INTO sources (id, project_id, name, kind)
      VALUES (
        'e70e8400-e29b-41d4-a716-446655440002',
        'e70e8400-e29b-41d4-a716-446655440001',
        'chunks.txt',
        'document'
      );
      INSERT INTO source_versions (
        id, source_id, version, artifact_ref, content_hash
      )
      VALUES
        (
          'e70e8400-e29b-41d4-a716-446655440003',
          'e70e8400-e29b-41d4-a716-446655440002',
          1,
          'artifact://chunks',
          'sha256:chunks'
        ),
        (
          'e70e8400-e29b-41d4-a716-446655440007',
          'e70e8400-e29b-41d4-a716-446655440002',
          2,
          'artifact://chunks-2',
          'sha256:chunks-2'
        );
      INSERT INTO documents (
        id, workspace_id, project_id, source_id, source_version_id,
        format, normalized_text, content_hash, parser_version
      )
      VALUES (
        'e70e8400-e29b-41d4-a716-446655440004',
        'e70e8400-e29b-41d4-a716-446655440000',
        'e70e8400-e29b-41d4-a716-446655440001',
        'e70e8400-e29b-41d4-a716-446655440002',
        'e70e8400-e29b-41d4-a716-446655440003',
        'text',
        'Rare trustworthy evidence',
        'sha256:document',
        'text-v1'
      );
      INSERT INTO document_chunks (
        id, document_id, workspace_id, project_id, source_id,
        source_version_id, chunking_version, ordinal, text, text_hash,
        char_start, char_end, byte_start, byte_end
      )
      VALUES (
        'e70e8400-e29b-41d4-a716-446655440005',
        'e70e8400-e29b-41d4-a716-446655440004',
        'e70e8400-e29b-41d4-a716-446655440000',
        'e70e8400-e29b-41d4-a716-446655440001',
        'e70e8400-e29b-41d4-a716-446655440002',
        'e70e8400-e29b-41d4-a716-446655440003',
        'fragments-v1',
        0,
        'Rare trustworthy evidence',
        'sha256:chunk',
        0,
        25,
        0,
        25
      );
    `)
    const matches = await scoped.unsafe(
      `SELECT id FROM document_chunks
       WHERE search_vector @@ websearch_to_tsquery('english', 'trustworthy')`,
    )
    expect(matches).toHaveLength(1)

    let rejected = false
    try {
      await scoped.unsafe(`
        INSERT INTO documents (
          id, workspace_id, project_id, source_id, source_version_id,
          format, normalized_text, content_hash, parser_version
        )
        VALUES (
          'e70e8400-e29b-41d4-a716-446655440006',
          'e70e8400-e29b-41d4-a716-446655440009',
          'e70e8400-e29b-41d4-a716-446655440001',
          'e70e8400-e29b-41d4-a716-446655440002',
          'e70e8400-e29b-41d4-a716-446655440007',
          'text',
          'Cross tenant',
          'sha256:cross-tenant',
          'text-v1'
        )
      `)
    } catch {
      rejected = true
    }
    expect(rejected).toBe(true)
  })

  it('rolls back derived rows without deleting immutable source versions', async () => {
    const executor = migrationExecutor(scoped)
    // Revert directory ingestion and retrieval before reverting the document
    // chunk migration this test owns.
    await Effect.runPromise(runMigrationsDown(executor))
    await Effect.runPromise(runMigrationsDown(executor))
    await Effect.runPromise(runMigrationsDown(executor))

    expect(await scoped.unsafe(
      `SELECT id FROM source_versions
       WHERE id = 'e70e8400-e29b-41d4-a716-446655440003'`,
    )).toHaveLength(1)
    const [tables] = await scoped.unsafe(
      `SELECT
         NOT EXISTS (
           SELECT 1 FROM information_schema.tables
           WHERE table_schema = $1 AND table_name = 'document_chunks'
         ) AS chunks_removed,
         NOT EXISTS (
           SELECT 1 FROM information_schema.tables
           WHERE table_schema = $1 AND table_name = 'documents'
         ) AS documents_removed`,
      [schemaName],
    )
    expect(tables).toMatchObject({
      chunks_removed: true,
      documents_removed: true,
    })

    await Effect.runPromise(runMigrationsUp(executor))
    await Effect.runPromise(runMigrationsUp(executor))
    await Effect.runPromise(runMigrationsUp(executor))
    const [restored] = await scoped.unsafe(
      `SELECT
         EXISTS (
           SELECT 1 FROM information_schema.tables
           WHERE table_schema = $1 AND table_name = 'document_chunks'
         ) AS chunks_restored,
         EXISTS (
           SELECT 1 FROM information_schema.tables
           WHERE table_schema = $1 AND table_name = 'documents'
         ) AS documents_restored`,
      [schemaName],
    )
    expect(restored).toMatchObject({
      chunks_restored: true,
      documents_restored: true,
    })
    expect(await scoped.unsafe(
      `SELECT id FROM source_versions
       WHERE id = 'e70e8400-e29b-41d4-a716-446655440003'`,
    )).toHaveLength(1)
  })
})
