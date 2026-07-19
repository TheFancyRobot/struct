import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { Effect } from 'effect'
import postgres from 'postgres'
import type postgresTypes from 'postgres'
import {
  runMigrationsDown,
  runMigrationsUp,
  type SqlExecutor,
  type SqlExecutorWithTransactions,
} from './runner'

const DATABASE_URL = process.env['DATABASE_URL']
const describeIf = DATABASE_URL ? describe : describe.skip
const schemaName = `upgrade_${crypto.randomUUID().replaceAll('-', '')}`

function migrationExecutor(sql: postgresTypes.Sql): SqlExecutorWithTransactions {
  return {
    unsafe: (query) => sql.unsafe(query) as Promise<unknown>,
    begin: <T>(run: (tx: SqlExecutor) => Promise<T>) =>
      sql.begin((transaction) =>
        run({
          unsafe: (query) => transaction.unsafe(query) as Promise<unknown>,
        }),
      ) as Promise<T>,
  }
}

describeIf('existing database migration upgrades (PostgreSQL)', () => {
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
  })

  afterAll(async () => {
    if (scoped) await scoped.end()
    if (admin) {
      await admin.unsafe(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`)
      await admin.end()
    }
  })

  it('queues pre-existing rows and future rows with durable tenant/artifact state', async () => {
    if (!scoped) return
    const executor = migrationExecutor(scoped)
    await Effect.runPromise(runMigrationsUp(executor))
    // Remove 0010 through 0004 first, then 0003 so this fixture represents
    // the state immediately before the SourceVersion text-index upgrade.
    await Effect.runPromise(runMigrationsDown(executor))
    await Effect.runPromise(runMigrationsDown(executor))
    await Effect.runPromise(runMigrationsDown(executor))
    await Effect.runPromise(runMigrationsDown(executor))
    await Effect.runPromise(runMigrationsDown(executor))
    await Effect.runPromise(runMigrationsDown(executor))
    await Effect.runPromise(runMigrationsDown(executor))
    await Effect.runPromise(runMigrationsDown(executor))

    await scoped.unsafe(`
      INSERT INTO workspaces (id, name)
      VALUES ('450e8400-e29b-41d4-a716-446655440000', 'Upgrade Workspace');
      INSERT INTO projects (id, workspace_id, name)
      VALUES (
        '450e8400-e29b-41d4-a716-446655440001',
        '450e8400-e29b-41d4-a716-446655440000',
        'Upgrade Project'
      );
      INSERT INTO sources (id, project_id, name, kind)
      VALUES (
        '450e8400-e29b-41d4-a716-446655440002',
        '450e8400-e29b-41d4-a716-446655440001',
        'Legacy Source',
        'document'
      );
      INSERT INTO source_versions (
        id, source_id, version, artifact_ref, content_hash
      )
      VALUES (
        '450e8400-e29b-41d4-a716-446655440003',
        '450e8400-e29b-41d4-a716-446655440002',
        1,
        'artifact://sha256/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
      );
    `)

    await Effect.runPromise(runMigrationsUp(executor))

    const existing = await scoped.unsafe(
      `SELECT workspace_id, project_id, artifact_ref, content_hash, status, attempts
       FROM source_text_reindex_jobs
       WHERE source_version_id = '450e8400-e29b-41d4-a716-446655440003'`,
    )
    expect(existing).toHaveLength(1)
    expect(existing[0]).toMatchObject({
      workspace_id: '450e8400-e29b-41d4-a716-446655440000',
      project_id: '450e8400-e29b-41d4-a716-446655440001',
      artifact_ref:
        'artifact://sha256/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      content_hash:
        'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      status: 'pending',
      attempts: 0,
    })
    expect(await scoped.unsafe(
      `SELECT source_version_id FROM source_text_index
       WHERE source_version_id = '450e8400-e29b-41d4-a716-446655440003'`,
    )).toHaveLength(0)

    await scoped.unsafe(`
      INSERT INTO source_versions (
        id, source_id, version, artifact_ref, content_hash
      )
      VALUES (
        '450e8400-e29b-41d4-a716-446655440004',
        '450e8400-e29b-41d4-a716-446655440002',
        2,
        'artifact://sha256/cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
        'sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd'
      )
    `)
    const created = await scoped.unsafe(
      `SELECT workspace_id, project_id, artifact_ref, content_hash, status, attempts
       FROM source_text_reindex_jobs
       WHERE source_version_id = '450e8400-e29b-41d4-a716-446655440004'`,
    )
    expect(created).toHaveLength(1)
    expect(created[0]).toMatchObject({
      workspace_id: '450e8400-e29b-41d4-a716-446655440000',
      project_id: '450e8400-e29b-41d4-a716-446655440001',
      artifact_ref:
        'artifact://sha256/cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
      content_hash:
        'sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
      status: 'pending',
      attempts: 0,
    })
  })
})
