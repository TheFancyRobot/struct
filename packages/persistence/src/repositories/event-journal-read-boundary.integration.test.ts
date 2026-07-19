import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { Effect, Layer } from 'effect'
import postgres from 'postgres'
import type postgresTypes from 'postgres'
import { ResearchRunId } from '@struct/domain'
import * as Persistence from '../index.js'

const DATABASE_URL = process.env['DATABASE_URL']
const describeIf = DATABASE_URL ? describe : describe.skip
const workspaceId = 'c70e8400-e29b-41d4-a716-446655440000'
const nonexistentRunId = ResearchRunId.make('c70e8400-e29b-41d4-a716-446655440001')

describeIf('EventJournal read-only export boundary (PostgreSQL)', () => {
  let sql: postgresTypes.Sql

  beforeAll(async () => {
    if (!DATABASE_URL) return
    sql = postgres(DATABASE_URL, { max: 1, idle_timeout: 5 })
    await sql.unsafe(`DELETE FROM event_journal WHERE workspace_id = $1`, [workspaceId])
    await sql.unsafe(`DELETE FROM workspaces WHERE id = $1`, [workspaceId])
    await sql.unsafe(
      `INSERT INTO workspaces (id, name) VALUES ($1, 'Journal Read Boundary')`,
      [workspaceId],
    )
  })

  afterAll(async () => {
    if (!sql) return
    await sql.unsafe(`DELETE FROM event_journal WHERE workspace_id = $1`, [workspaceId])
    await sql.unsafe(`DELETE FROM workspaces WHERE id = $1`, [workspaceId])
    await sql.end()
  })

  it('cannot persist a forged research completion through the exported journal API', async () => {
    const packageExports = Persistence as unknown as Record<string, unknown>
    const readerExports = Persistence.EventJournalReader as unknown as Record<string, unknown>

    expect(packageExports['EventJournalRepo']).toBeUndefined()
    expect(packageExports['EventJournalRepository']).toBeUndefined()
    expect(readerExports['append']).toBeUndefined()

    const layer = Layer.provide(
      Persistence.EventJournalReader.Default,
      Persistence.SqlClientLive(sql),
    )
    const events = await Effect.runPromise(
      Effect.gen(function* () {
        const reader = yield* Persistence.EventJournalReader
        return yield* reader.findByEntity('research', nonexistentRunId)
      }).pipe(Effect.provide(layer)),
    )
    expect(events).toEqual([])

    const forgedRows = await sql.unsafe(
      `SELECT id
       FROM event_journal
       WHERE workspace_id = $1
         AND entity_type = 'research'
         AND entity_id = $2
         AND event_type = 'research-completed'`,
      [workspaceId, nonexistentRunId],
    )
    expect(forgedRows).toHaveLength(0)
  })
})
