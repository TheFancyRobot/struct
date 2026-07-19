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
const schemaName = `cursor_order_${crypto.randomUUID().replaceAll('-', '')}`
const workspaceId = crypto.randomUUID()

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

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

async function waitForBlockedAdvisoryLock(
  observer: postgresTypes.Sql,
  applicationName: string,
): Promise<void> {
  const deadline = Date.now() + 5_000
  while (Date.now() < deadline) {
    const rows = await observer.unsafe(
      `SELECT EXISTS (
         SELECT 1
         FROM pg_locks lock
         JOIN pg_stat_activity activity ON activity.pid = lock.pid
         WHERE activity.application_name = $1
           AND lock.locktype = 'advisory'
           AND lock.granted = FALSE
       ) AS blocked`,
      [applicationName],
    )
    if (rows[0]?.['blocked'] === true) return
    await Bun.sleep(20)
  }
  throw new Error(`Timed out waiting for ${applicationName} to block on the cursor allocator`)
}

function makeClient(applicationName: string): postgresTypes.Sql {
  return postgres(DATABASE_URL!, {
    max: 1,
    idle_timeout: 5,
    connection: {
      search_path: `"${schemaName}",public`,
      application_name: applicationName,
    },
  })
}

async function insertEvent(
  sql: postgresTypes.TransactionSql,
  id: string,
  entityId: string,
  suppliedCursor?: bigint,
): Promise<bigint> {
  const rows = suppliedCursor === undefined
    ? await sql.unsafe(
      `INSERT INTO event_journal (
         id, workspace_id, entity_type, entity_id, event_type, payload
       )
       VALUES ($1, $2, 'cursor-test', $3, 'cursor-test-appended', '{}'::jsonb)
       RETURNING cursor`,
      [id, workspaceId, entityId],
    )
    : await sql.unsafe(
      `INSERT INTO event_journal (
         id, workspace_id, entity_type, entity_id, event_type, payload, cursor
       )
       VALUES ($1, $2, 'cursor-test', $3, 'cursor-test-appended', '{}'::jsonb, $4)
       RETURNING cursor`,
      [id, workspaceId, entityId, suppliedCursor.toString()],
    )
  return BigInt(String(rows[0]?.['cursor']))
}

describeIf('event_journal commit-ordered cursor allocation (PostgreSQL)', () => {
  let admin: postgresTypes.Sql
  let migrationSql: postgresTypes.Sql
  let connectionA: postgresTypes.Sql
  let connectionB: postgresTypes.Sql
  let observer: postgresTypes.Sql

  beforeAll(async () => {
    if (!DATABASE_URL) return
    admin = postgres(DATABASE_URL, { max: 1, idle_timeout: 5 })
    await admin.unsafe(`CREATE SCHEMA "${schemaName}"`)
    migrationSql = makeClient('cursor-order-migrations')
    connectionA = makeClient('cursor-order-a')
    connectionB = makeClient('cursor-order-b')
    observer = makeClient('cursor-order-observer')
    await Effect.runPromise(runMigrationsUp(migrationExecutor(migrationSql)))
    await observer.unsafe(
      `INSERT INTO workspaces (id, name) VALUES ($1, 'Cursor ordering regression')`,
      [workspaceId],
    )
  })

  afterAll(async () => {
    if (connectionA) await connectionA.end()
    if (connectionB) await connectionB.end()
    if (observer) await observer.end()
    if (migrationSql) await migrationSql.end()
    if (admin) {
      await admin.unsafe(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`)
      await admin.end()
    }
  })

  it('prevents a higher cursor from becoming observable before a lower cursor transaction resolves', async () => {
    const eventA = crypto.randomUUID()
    const eventB = crypto.randomUUID()
    const entityA = crypto.randomUUID()
    const entityB = crypto.randomUUID()
    const releaseA = deferred<void>()
    const cursorAReady = deferred<bigint>()

    const transactionA = connectionA.begin(async (tx) => {
      const cursor = await insertEvent(tx, eventA, entityA)
      cursorAReady.resolve(cursor)
      await releaseA.promise
      return cursor
    }).catch((error) => {
      cursorAReady.reject(error)
      throw error
    })
    const cursorA = await cursorAReady.promise

    const transactionB = connectionB.begin(async (tx) =>
      insertEvent(tx, eventB, entityB))

    await waitForBlockedAdvisoryLock(observer, 'cursor-order-b')
    const whileAIsOpen = await observer.unsafe(
      `SELECT id, cursor
       FROM event_journal
       WHERE id = ANY($1::uuid[])
       ORDER BY cursor`,
      [[eventA, eventB]],
    )
    expect(whileAIsOpen).toHaveLength(0)

    releaseA.resolve()
    expect(await transactionA).toBe(cursorA)
    const cursorB = await transactionB

    expect(cursorB).toBeGreaterThan(cursorA)
    const replayAfterA = await observer.unsafe(
      `SELECT id, cursor
       FROM event_journal
       WHERE workspace_id = $1
         AND cursor > $2
         AND id = ANY($3::uuid[])
       ORDER BY cursor`,
      [workspaceId, cursorA.toString(), [eventA, eventB]],
    )
    expect(replayAfterA.map((row) => row['id'])).toEqual([eventB])
    expect(BigInt(String(replayAfterA[0]?.['cursor']))).toBe(cursorB)
  }, 20_000)

  it('deterministically reproduces the legacy late-lower-cursor replay loss', async () => {
    const executor = migrationExecutor(migrationSql)
    // Remove 0005 first, then 0004 to restore the legacy cursor allocator.
    await Effect.runPromise(runMigrationsDown(executor))
    await Effect.runPromise(runMigrationsDown(executor))

    const eventA = crypto.randomUUID()
    const eventB = crypto.randomUUID()
    const releaseA = deferred<void>()
    const cursorAReady = deferred<bigint>()
    let transactionA: Promise<bigint> | undefined

    try {
      transactionA = connectionA.begin(async (tx) => {
        const cursor = await insertEvent(tx, eventA, crypto.randomUUID())
        cursorAReady.resolve(cursor)
        await releaseA.promise
        return cursor
      }).catch((error) => {
        cursorAReady.reject(error)
        throw error
      })
      const cursorA = await cursorAReady.promise

      // With the legacy BIGSERIAL default restored by the down migration,
      // B allocates and commits its higher cursor while A remains open.
      const cursorB = await connectionB.begin((tx) =>
        insertEvent(tx, eventB, crypto.randomUUID()))
      expect(cursorB).toBeGreaterThan(cursorA)

      const checkpointRows = await observer.unsafe(
        `SELECT id, cursor
         FROM event_journal
         WHERE id = ANY($1::uuid[])
         ORDER BY cursor`,
        [[eventA, eventB]],
      )
      expect(checkpointRows.map((row) => row['id'])).toEqual([eventB])
      const reconnectCheckpoint = cursorB

      releaseA.resolve()
      expect(await transactionA).toBe(cursorA)

      const replay = await observer.unsafe(
        `SELECT id
         FROM event_journal
         WHERE id = ANY($1::uuid[])
           AND cursor > $2
         ORDER BY cursor`,
        [[eventA, eventB], reconnectCheckpoint.toString()],
      )
      expect(replay).toHaveLength(0)
      const permanentlySkipped = await observer.unsafe(
        `SELECT id, cursor
         FROM event_journal
         WHERE id = $1`,
        [eventA],
      )
      expect(BigInt(String(permanentlySkipped[0]?.['cursor']))).toBeLessThan(
        reconnectCheckpoint,
      )
    } finally {
      releaseA.resolve()
      await transactionA?.catch(() => undefined)
      await Effect.runPromise(runMigrationsUp(executor))
    }
  }, 20_000)

  it('keeps rollback gaps and releases the allocator only after rollback', async () => {
    const rolledBackEvent = crypto.randomUUID()
    const committedEvent = crypto.randomUUID()
    const releaseRollback = deferred<void>()
    const rolledBackCursorReady = deferred<bigint>()
    const rollbackMarker = new Error('intentional cursor allocation rollback')

    const rollingBackTransaction = connectionA.begin(async (tx) => {
      const cursor = await insertEvent(tx, rolledBackEvent, crypto.randomUUID())
      rolledBackCursorReady.resolve(cursor)
      await releaseRollback.promise
      throw rollbackMarker
    }).catch((error) => {
      rolledBackCursorReady.reject(error)
      throw error
    })
    const rolledBackCursor = await rolledBackCursorReady.promise

    const committedTransaction = connectionB.begin(async (tx) =>
      insertEvent(tx, committedEvent, crypto.randomUUID()))
    await waitForBlockedAdvisoryLock(observer, 'cursor-order-b')

    releaseRollback.resolve()
    await expect(rollingBackTransaction).rejects.toThrow(rollbackMarker.message)
    const committedCursor = await committedTransaction

    expect(committedCursor).toBeGreaterThan(rolledBackCursor)
    const rows = await observer.unsafe(
      `SELECT id, cursor
       FROM event_journal
       WHERE id = ANY($1::uuid[])
       ORDER BY cursor`,
      [[rolledBackEvent, committedEvent]],
    )
    expect(rows.map((row) => row['id'])).toEqual([committedEvent])
    expect(BigInt(String(rows[0]?.['cursor']))).toBe(committedCursor)
  }, 20_000)

  it('overrides caller-supplied cursors and keeps concurrent inserts unique and increasing', async () => {
    const firstId = crypto.randomUUID()
    const secondId = crypto.randomUUID()
    const [firstCursor, secondCursor] = await Promise.all([
      connectionA.begin((tx) =>
        insertEvent(tx, firstId, crypto.randomUUID(), 1n)),
      connectionB.begin((tx) =>
        insertEvent(tx, secondId, crypto.randomUUID(), 1n)),
    ])

    expect(firstCursor).not.toBe(1n)
    expect(secondCursor).not.toBe(1n)
    expect(firstCursor).not.toBe(secondCursor)
    const rows = await observer.unsafe(
      `SELECT cursor
       FROM event_journal
       WHERE id = ANY($1::uuid[])
       ORDER BY cursor`,
      [[firstId, secondId]],
    )
    const cursors = rows.map((row) => BigInt(String(row['cursor'])))
    expect(cursors).toEqual([...cursors].sort((left, right) => left < right ? -1 : 1))
  }, 20_000)

  it('round-trips the migration and restores commit-order allocation', async () => {
    const executor = migrationExecutor(migrationSql)
    // Remove 0005 first, then 0004; runMigrationsUp restores both in order.
    await Effect.runPromise(runMigrationsDown(executor))
    await Effect.runPromise(runMigrationsDown(executor))

    const afterDown = await observer.unsafe(
      `SELECT
         EXISTS (
           SELECT 1
           FROM pg_trigger
           WHERE tgrelid = 'event_journal'::regclass
             AND tgname = 'event_journal_allocate_cursor_in_commit_order'
             AND NOT tgisinternal
         ) AS has_trigger,
         column_default
       FROM information_schema.columns
       WHERE table_schema = $1
         AND table_name = 'event_journal'
         AND column_name = 'cursor'`,
      [schemaName],
    )
    expect(afterDown[0]?.['has_trigger']).toBe(false)
    expect(String(afterDown[0]?.['column_default'])).toContain('nextval')

    await Effect.runPromise(runMigrationsUp(executor))
    const afterUp = await observer.unsafe(
      `SELECT
         EXISTS (
           SELECT 1
           FROM pg_trigger
           WHERE tgrelid = 'event_journal'::regclass
             AND tgname = 'event_journal_allocate_cursor_in_commit_order'
             AND NOT tgisinternal
         ) AS has_trigger,
         column_default
       FROM information_schema.columns
       WHERE table_schema = $1
         AND table_name = 'event_journal'
         AND column_name = 'cursor'`,
      [schemaName],
    )
    expect(afterUp[0]?.['has_trigger']).toBe(true)
    expect(afterUp[0]?.['column_default']).toBeNull()

    const first = await connectionA.begin((tx) =>
      insertEvent(tx, crypto.randomUUID(), crypto.randomUUID()))
    const second = await connectionB.begin((tx) =>
      insertEvent(tx, crypto.randomUUID(), crypto.randomUUID()))
    expect(second).toBeGreaterThan(first)
  }, 20_000)
})
