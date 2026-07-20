import { afterEach, describe, expect, it } from 'bun:test'
import {
  OperationsError,
  parseLocalDatabaseTarget,
  requireDestructiveApproval,
  resolveBackupPath,
  verifyApplicationReadiness,
} from './production-operations'

const previousApproval = process.env.STRUCT_ALLOW_DESTRUCTIVE_RESET

afterEach(() => {
  if (previousApproval === undefined) delete process.env.STRUCT_ALLOW_DESTRUCTIVE_RESET
  else process.env.STRUCT_ALLOW_DESTRUCTIVE_RESET = previousApproval
})

describe('production operation safety boundaries', () => {
  it('accepts only loopback struct PostgreSQL targets', () => {
    expect(parseLocalDatabaseTarget('postgres://struct:secret@127.0.0.1:5432/struct')).toEqual({
      database: 'struct',
      username: 'struct',
    })
    expect(parseLocalDatabaseTarget('postgresql://struct:secret@localhost/struct_recovery_test')).toEqual({
      database: 'struct_recovery_test',
      username: 'struct',
    })

    expect(() => parseLocalDatabaseTarget('postgres://struct:secret@db.example.com/struct')).toThrow(
      'only operate on loopback',
    )
    expect(() => parseLocalDatabaseTarget('postgres://struct:secret@localhost:5544/struct')).toThrow(
      'port 5432',
    )
    expect(() => parseLocalDatabaseTarget('postgres://struct:secret@localhost/customer_data')).toThrow(
      'only operate on struct databases',
    )
    expect(() => parseLocalDatabaseTarget('https://localhost/struct')).toThrow('must use postgres')
  })

  it('requires approval to exactly match the target database', () => {
    const target = { database: 'struct_recovery_test', username: 'struct' }
    delete process.env.STRUCT_ALLOW_DESTRUCTIVE_RESET
    expect(() => requireDestructiveApproval(target)).toThrow(OperationsError)
    process.env.STRUCT_ALLOW_DESTRUCTIVE_RESET = 'struct'
    expect(() => requireDestructiveApproval(target)).toThrow('Refusing destructive reset')
    process.env.STRUCT_ALLOW_DESTRUCTIVE_RESET = target.database
    expect(() => requireDestructiveApproval(target)).not.toThrow()
  })

  it('confines custom-format archives beneath the repository backup root', () => {
    expect(resolveBackupPath('.local/backups/recovery.dump')).toEndWith('/.local/backups/recovery.dump')
    expect(() => resolveBackupPath('.local/backups/../escape.dump')).toThrow('beneath .local/backups')
    expect(() => resolveBackupPath('.local/backups/recovery.sql')).toThrow('must end in .dump')
  })

  it('checks web, API, and worker readiness at their configured loopback ports', async () => {
    const requested: string[] = []
    const fetcher = (async (input: string | URL | Request) => {
      requested.push(String(input))
      return new Response('ok')
    }) as typeof fetch

    await verifyApplicationReadiness(fetcher, {
      WEB_PORT: '4100',
      API_PORT: '4101',
      WORKER_METRICS_PORT: '4102',
    })
    expect(requested).toEqual([
      'http://127.0.0.1:4100/',
      'http://127.0.0.1:4101/healthz',
      'http://127.0.0.1:4102/healthz',
    ])
  })

  it('fails a rollback check when any application is not ready', async () => {
    const fetcher = (async (input: string | URL | Request) =>
      new Response('unavailable', { status: String(input).includes(':3001') ? 503 : 200 })) as typeof fetch
    await expect(verifyApplicationReadiness(fetcher, {})).rejects.toThrow(
      'api readiness returned 503',
    )
  })
})
