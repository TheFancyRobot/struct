import { afterEach, describe, expect, it } from 'bun:test'
import { createHash, randomUUID } from 'node:crypto'
import { mkdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  OperationsError,
  STACK_RESTART_COMMANDS,
  STACK_UP_COMMAND,
  assertSafeBackupPath,
  main,
  parseLocalDatabaseTarget,
  requireDestructiveApproval,
  resolveArtifactBackupPath,
  resolveBackupPath,
  verifyArtifactStore,
  verifyApplicationReadiness,
} from './production-operations'

const previousEnvironment = {
  ARTIFACT_STORAGE_ROOT: process.env.ARTIFACT_STORAGE_ROOT,
  API_PORT: process.env.API_PORT,
  DATABASE_URL: process.env.DATABASE_URL,
  STRUCT_ALLOW_DESTRUCTIVE_RESET: process.env.STRUCT_ALLOW_DESTRUCTIVE_RESET,
  WEB_PORT: process.env.WEB_PORT,
  WORKER_METRICS_PORT: process.env.WORKER_METRICS_PORT,
}

afterEach(() => {
  for (const [name, value] of Object.entries(previousEnvironment)) {
    if (value === undefined) delete process.env[name]
    else process.env[name] = value
  }
})

describe('production operation safety boundaries', () => {
  it('builds and recreates the Compose stack so changed sidecar source takes effect', () => {
    expect(STACK_UP_COMMAND).toEqual([
      'docker', 'compose', 'up', '-d', '--build', '--wait',
    ])
    expect(STACK_RESTART_COMMANDS).toEqual([
      ['bun', 'run', 'local:prepare'],
      ['docker', 'compose', 'config', '--quiet'],
      ['docker', 'compose', 'up', '-d', '--build', '--wait', '--force-recreate'],
    ])
    expect(STACK_RESTART_COMMANDS.flat()).not.toContain('restart')
  })

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

  it('confines artifact snapshots beneath the repository backup root', () => {
    expect(resolveArtifactBackupPath('.local/backups/recovery.artifacts')).toEndWith(
      '/.local/backups/recovery.artifacts',
    )
    expect(() => resolveArtifactBackupPath('.local/backups/../escape.artifacts')).toThrow(
      'beneath .local/backups',
    )
    expect(() => resolveArtifactBackupPath('.local/backups/recovery.tar')).toThrow(
      'must end in .artifacts',
    )
  })

  it('rejects symlinked backup path components', async () => {
    const link = join(import.meta.dir, '..', '.local', 'backups', `unsafe-${randomUUID()}`)
    try {
      await mkdir(join(import.meta.dir, '..', '.local', 'backups'), { recursive: true })
      await symlink('/tmp', link)
      await expect(assertSafeBackupPath(join(link, 'recovery.dump'))).rejects.toThrow(
        'must not contain symlinks',
      )
    } finally {
      await rm(link, { force: true })
    }
  })

  it('verifies content-addressed artifact bytes and rejects unsafe entries', async () => {
    const root = join(tmpdir(), `struct-artifact-verify-${randomUUID()}`)
    const bytes = new TextEncoder().encode('recovery bytes')
    const digest = createHash('sha256').update(bytes).digest('hex')
    const objectDirectory = join(root, 'objects', 'sha256', digest.slice(0, 2))
    try {
      await mkdir(objectDirectory, { recursive: true })
      await writeFile(join(objectDirectory, digest), bytes)
      expect(await verifyArtifactStore(root)).toBe(1)
      await writeFile(join(objectDirectory, digest), 'tampered')
      await expect(verifyArtifactStore(root)).rejects.toThrow('content hash verification failed')
      await rm(join(objectDirectory, digest))
      await symlink('/tmp', join(root, 'unsafe'))
      await expect(verifyArtifactStore(root)).rejects.toThrow('unsafe path')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
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
      'http://127.0.0.1:4101/readyz',
      'http://127.0.0.1:4102/readyz',
    ])
  })

  it('fails a rollback check when any application is not ready', async () => {
    const fetcher = (async (input: string | URL | Request) =>
      new Response('unavailable', { status: String(input).includes(':3001') ? 503 : 200 })) as typeof fetch
    await expect(verifyApplicationReadiness(fetcher, {})).rejects.toThrow(
      'api readiness returned 503',
    )
  })

  it('lets artifact backups reach option validation without DATABASE_URL', async () => {
    delete process.env.DATABASE_URL
    await expect(main(['artifacts:backup'])).rejects.toThrow('--output is required')
  })

  it('lets artifact verification reach artifact checks without DATABASE_URL', async () => {
    delete process.env.DATABASE_URL
    process.env.ARTIFACT_STORAGE_ROOT = join(tmpdir(), `missing-artifacts-${randomUUID()}`)
    await expect(main(['artifacts:verify'])).rejects.toThrow('Artifact store must be a real directory')
  })

  it('lets application verification reach readiness probes without DATABASE_URL', async () => {
    delete process.env.DATABASE_URL
    process.env.WEB_PORT = '0'
    process.env.API_PORT = '0'
    process.env.WORKER_METRICS_PORT = '0'
    await expect(main(['application:verify'])).rejects.toThrow('web readiness request failed')
  })

  it('still requires DATABASE_URL for database verification', async () => {
    delete process.env.DATABASE_URL
    await expect(main(['database:verify'])).rejects.toThrow('DATABASE_URL is required')
  })

  it('still validates DATABASE_URL for database-backed commands', async () => {
    process.env.DATABASE_URL = 'not-a-postgres-url'
    await expect(main(['database:verify'])).rejects.toThrow('DATABASE_URL must be a valid PostgreSQL URL')
    await expect(main(['artifacts:restore', '--input', '.local/backups/recovery.artifacts'])).rejects.toThrow(
      'DATABASE_URL must be a valid PostgreSQL URL',
    )
  })
})
