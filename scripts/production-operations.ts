import { createHash } from 'node:crypto'
import { cp, lstat, mkdir, open, readdir, readFile, rename, rm } from 'node:fs/promises'
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import postgres from 'postgres'

const repositoryRoot = resolve(import.meta.dir, '..')
const backupRoot = resolve(repositoryRoot, '.local/backups')

export class OperationsError extends Error {
  override readonly name = 'OperationsError'
}

export interface LocalDatabaseTarget {
  readonly database: string
  readonly username: string
}

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new OperationsError(`${name} is required`)
  return value
}

export function parseLocalDatabaseTarget(databaseUrl: string): LocalDatabaseTarget {
  let parsed: URL
  try {
    parsed = new URL(databaseUrl)
  } catch {
    throw new OperationsError('DATABASE_URL must be a valid PostgreSQL URL')
  }

  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
    throw new OperationsError('DATABASE_URL must use postgres:// or postgresql://')
  }
  if (!['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)) {
    throw new OperationsError('Recovery commands only operate on loopback PostgreSQL')
  }
  if (parsed.port !== '' && parsed.port !== '5432') {
    throw new OperationsError('Recovery commands only operate on the Compose PostgreSQL port 5432')
  }

  const database = decodeURIComponent(parsed.pathname.slice(1))
  const username = decodeURIComponent(parsed.username)
  if (!database || !username) {
    throw new OperationsError('DATABASE_URL must include a database and username')
  }
  if (!/^struct(?:_[a-z0-9_]+)?$/.test(database)) {
    throw new OperationsError('Recovery commands only operate on struct databases')
  }
  if (!/^[a-z_][a-z0-9_]*$/.test(username)) {
    throw new OperationsError('DATABASE_URL contains an unsafe PostgreSQL username')
  }
  return { database, username }
}

export function requireDestructiveApproval(target: LocalDatabaseTarget): void {
  if (process.env.STRUCT_ALLOW_DESTRUCTIVE_RESET !== target.database) {
    throw new OperationsError(
      `Refusing destructive reset. Set STRUCT_ALLOW_DESTRUCTIVE_RESET=${target.database}`,
    )
  }
}

export function resolveBackupPath(input: string): string {
  const candidate = resolve(repositoryRoot, input)
  const pathFromRoot = relative(backupRoot, candidate)
  if (pathFromRoot.startsWith('..') || pathFromRoot === '' || basename(candidate) === '') {
    throw new OperationsError('Backup path must be a file beneath .local/backups')
  }
  if (!candidate.endsWith('.dump')) {
    throw new OperationsError('Backup path must end in .dump')
  }
  return candidate
}

export function resolveArtifactBackupPath(input: string): string {
  const candidate = resolve(repositoryRoot, input)
  const pathFromRoot = relative(backupRoot, candidate)
  if (pathFromRoot.startsWith('..') || pathFromRoot === '' || isAbsolute(pathFromRoot)) {
    throw new OperationsError('Artifact backup path must be a directory beneath .local/backups')
  }
  if (!candidate.endsWith('.artifacts')) {
    throw new OperationsError('Artifact backup path must end in .artifacts')
  }
  return candidate
}

export async function assertSafeBackupPath(candidate: string): Promise<void> {
  const pathFromRepository = relative(repositoryRoot, candidate)
  let current = repositoryRoot
  for (const part of pathFromRepository.split(sep)) {
    current = resolve(current, part)
    const metadata = await lstat(current).catch((cause: unknown) => {
      if ((cause as NodeJS.ErrnoException).code === 'ENOENT') return undefined
      throw cause
    })
    if (!metadata) break
    if (metadata.isSymbolicLink()) {
      throw new OperationsError('Backup path must not contain symlinks')
    }
  }
}

function artifactRoot(): string {
  return resolve(repositoryRoot, process.env.ARTIFACT_STORAGE_ROOT ?? '.local/artifacts')
}

export async function verifyArtifactStore(root: string): Promise<number> {
  const metadata = await lstat(root).catch(() => undefined)
  if (!metadata?.isDirectory() || metadata.isSymbolicLink()) {
    throw new OperationsError('Artifact store must be a real directory')
  }

  let verifiedObjects = 0
  const visit = async (directory: string): Promise<void> => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name)
      const pathFromRoot = relative(root, path)
      if (pathFromRoot.startsWith('..') || isAbsolute(pathFromRoot) || entry.isSymbolicLink()) {
        throw new OperationsError('Artifact store contains an unsafe path')
      }
      if (entry.isDirectory()) {
        await visit(path)
        continue
      }
      if (!entry.isFile()) throw new OperationsError('Artifact store contains an unsupported entry')

      const match = /^objects\/sha256\/([0-9a-f]{2})\/([0-9a-f]{64})$/.exec(
        pathFromRoot.replaceAll('\\', '/'),
      )
      if (pathFromRoot.replaceAll('\\', '/').startsWith('objects/sha256/') && !match) {
        throw new OperationsError('Artifact object path is malformed')
      }
      if (match) {
        if (match[2]?.slice(0, 2) !== match[1]) {
          throw new OperationsError('Artifact object is stored beneath the wrong digest prefix')
        }
        const digest = createHash('sha256').update(await readFile(path)).digest('hex')
        if (digest !== match[2]) throw new OperationsError('Artifact content hash verification failed')
        verifiedObjects += 1
      }
    }
  }
  await visit(root)
  return verifiedObjects
}

function isNestedWithin(parent: string, candidate: string): boolean {
  const nested = relative(parent, candidate)
  return nested === '' || (!nested.startsWith('..') && !isAbsolute(nested))
}

async function backupArtifacts(outputPath: string): Promise<void> {
  const source = artifactRoot()
  if (isNestedWithin(source, outputPath) || isNestedWithin(outputPath, source)) {
    throw new OperationsError('Artifact backup and artifact store must not overlap')
  }
  await verifyArtifactStore(source)
  await assertSafeBackupPath(outputPath)
  await mkdir(dirname(outputPath), { recursive: true })
  await assertSafeBackupPath(outputPath)
  const temporaryPath = `${outputPath}.partial-${process.pid}`
  await rm(temporaryPath, { recursive: true, force: true })
  try {
    await cp(source, temporaryPath, { recursive: true, errorOnExist: true })
    await verifyArtifactStore(temporaryPath)
    await rm(outputPath, { recursive: true, force: true })
    await rename(temporaryPath, outputPath)
  } catch (error) {
    await rm(temporaryPath, { recursive: true, force: true })
    throw error
  }
}

async function restoreArtifacts(target: LocalDatabaseTarget, inputPath: string): Promise<void> {
  requireDestructiveApproval(target)
  await assertSafeBackupPath(inputPath)
  await verifyArtifactStore(inputPath)
  const destination = artifactRoot()
  if (isNestedWithin(destination, inputPath) || isNestedWithin(inputPath, destination)) {
    throw new OperationsError('Artifact backup and artifact store must not overlap')
  }
  await mkdir(dirname(destination), { recursive: true })
  const temporaryPath = `${destination}.restore-${process.pid}`
  const previousPath = `${destination}.previous-${process.pid}`
  await rm(temporaryPath, { recursive: true, force: true })
  await rm(previousPath, { recursive: true, force: true })
  await cp(inputPath, temporaryPath, { recursive: true, errorOnExist: true })
  await verifyArtifactStore(temporaryPath)
  const current = await lstat(destination).catch(() => undefined)
  if (current) await rename(destination, previousPath)
  try {
    await rename(temporaryPath, destination)
  } catch (error) {
    if (current) await rename(previousPath, destination).catch(() => undefined)
    await rm(temporaryPath, { recursive: true, force: true })
    throw error
  }
  await rm(previousPath, { recursive: true, force: true })
}

async function run(
  command: readonly string[],
  options: { readonly stdin?: Blob; readonly stdout?: number | 'pipe' } = {},
): Promise<Uint8Array> {
  const child = Bun.spawn([...command], {
    cwd: repositoryRoot,
    stdin: options.stdin,
    stdout: options.stdout ?? 'pipe',
    stderr: 'pipe',
  })
  const stderr = await new Response(child.stderr).text()
  const output = options.stdout === 'pipe' || options.stdout === undefined
    ? new Uint8Array(await new Response(child.stdout).arrayBuffer())
    : new Uint8Array()
  const exitCode = await child.exited
  if (exitCode !== 0) {
    const detail = stderr.trim() || `exit ${exitCode}`
    throw new OperationsError(`${command[0]} command failed: ${detail}`)
  }
  return output
}

function composeExec(target: LocalDatabaseTarget, ...args: readonly string[]): readonly string[] {
  return ['docker', 'compose', 'exec', '-T', 'postgres', ...args, '-U', target.username]
}

async function resetDatabase(target: LocalDatabaseTarget): Promise<void> {
  requireDestructiveApproval(target)
  const quotedDatabase = `"${target.database.replaceAll('"', '""')}"`
  await run([
    ...composeExec(target, 'psql'),
    '-d',
    'postgres',
    '-v',
    'ON_ERROR_STOP=1',
    '-c',
    `DROP DATABASE IF EXISTS ${quotedDatabase} WITH (FORCE)`,
  ])
  await run([
    ...composeExec(target, 'psql'),
    '-d',
    'postgres',
    '-v',
    'ON_ERROR_STOP=1',
    '-c',
    `CREATE DATABASE ${quotedDatabase}`,
  ])
}

async function verifyDatabaseCredentials(databaseUrl: string, target: LocalDatabaseTarget): Promise<void> {
  const administrationUrl = new URL(databaseUrl)
  administrationUrl.pathname = '/postgres'
  const sql = postgres(administrationUrl.toString(), {
    max: 1,
    connect_timeout: 5,
    idle_timeout: 1,
  })
  try {
    const rows = await sql`SELECT current_user AS username`
    if (rows[0]?.username !== target.username) {
      throw new OperationsError('PostgreSQL authenticated as an unexpected role')
    }
  } catch (cause) {
    if (cause instanceof OperationsError) throw cause
    throw new OperationsError('PostgreSQL credential preflight failed')
  } finally {
    await sql.end().catch(() => undefined)
  }
}

async function migrate(databaseUrl: string): Promise<void> {
  await run(['bun', 'run', 'migrations:up'], { stdout: 'pipe' })
  // The migration subprocess inherits DATABASE_URL; keep the argument explicit for callers/tests.
  if (databaseUrl !== process.env.DATABASE_URL) {
    throw new OperationsError('DATABASE_URL changed while migrations were running')
  }
}

async function backup(databaseUrl: string, target: LocalDatabaseTarget, outputPath: string): Promise<void> {
  await verifyDatabaseCredentials(databaseUrl, target)
  await assertSafeBackupPath(outputPath)
  await mkdir(dirname(outputPath), { recursive: true })
  await assertSafeBackupPath(outputPath)
  const temporaryPath = `${outputPath}.partial-${process.pid}`
  const output = await open(temporaryPath, 'wx', 0o600)
  try {
    await run([
      ...composeExec(target, 'pg_dump'),
      '--format=custom',
      '--no-owner',
      '--no-acl',
      '--dbname',
      target.database,
    ], { stdout: output.fd })
    await output.sync()
    await output.close()
    await rename(temporaryPath, outputPath)
  } catch (error) {
    await output.close().catch(() => undefined)
    await rm(temporaryPath, { force: true })
    throw error
  }
}

async function validateArchive(target: LocalDatabaseTarget, archivePath: string): Promise<void> {
  await assertSafeBackupPath(archivePath)
  await run([
    ...composeExec(target, 'pg_restore'),
    '--list',
  ], { stdin: Bun.file(archivePath) })
}

async function restore(databaseUrl: string, target: LocalDatabaseTarget, archivePath: string): Promise<void> {
  await validateArchive(target, archivePath)
  await verifyDatabaseCredentials(databaseUrl, target)
  await resetDatabase(target)
  await run([
    ...composeExec(target, 'pg_restore'),
    '--exit-on-error',
    '--single-transaction',
    '--no-owner',
    '--no-acl',
    '--dbname',
    target.database,
  ], { stdin: Bun.file(archivePath) })
}

async function verifyDependencies(databaseUrl: string, target: LocalDatabaseTarget): Promise<void> {
  await verifyDatabaseCredentials(databaseUrl, target)
  const sql = postgres(databaseUrl, { max: 1, connect_timeout: 5, idle_timeout: 1 })
  try {
    await sql`SELECT 1`
  } catch {
    throw new OperationsError('PostgreSQL database readiness failed')
  } finally {
    await sql.end().catch(() => undefined)
  }
  const token = requiredEnvironment('DATA_ENGINE_TOKEN')
  const response = await fetch('http://127.0.0.1:4300/healthz', {
    headers: { authorization: `Bearer ${token}` },
  })
  if (!response.ok) throw new OperationsError(`Data engine health check returned ${response.status}`)
}

export async function verifyApplicationReadiness(
  fetcher: typeof fetch = fetch,
  environment: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const probes = [
    ['web', `http://127.0.0.1:${environment.WEB_PORT ?? '3000'}/`],
    ['api', `http://127.0.0.1:${environment.API_PORT ?? '3001'}/readyz`],
    ['worker', `http://127.0.0.1:${environment.WORKER_METRICS_PORT ?? '3002'}/readyz`],
  ] as const
  for (const [name, url] of probes) {
    let response: Response
    try {
      response = await fetcher(url, { signal: AbortSignal.timeout(5_000) })
    } catch (cause) {
      throw new OperationsError(`${name} readiness request failed: ${String(cause)}`)
    }
    if (!response.ok) {
      throw new OperationsError(`${name} readiness returned ${response.status}`)
    }
  }
}

function option(args: readonly string[], name: string): string {
  const index = args.indexOf(name)
  const value = index === -1 ? undefined : args[index + 1]
  if (!value) throw new OperationsError(`${name} is required`)
  return value
}

export async function main(args = process.argv.slice(2)): Promise<void> {
  const databaseUrl = requiredEnvironment('DATABASE_URL')
  const target = parseLocalDatabaseTarget(databaseUrl)
  const command = args[0]

  switch (command) {
    case 'stack:up':
      await run(['bun', 'run', 'local:prepare'])
      await run(['docker', 'compose', 'config', '--quiet'])
      await run(['docker', 'compose', 'up', '-d', '--wait'])
      await verifyDependencies(databaseUrl, target)
      return
    case 'stack:restart':
      await run(['docker', 'compose', 'config', '--quiet'])
      await run(['docker', 'compose', 'restart', 'postgres', 'data-engine', 'data-engine-gateway'])
      await run(['docker', 'compose', 'up', '-d', '--wait'])
      await verifyDependencies(databaseUrl, target)
      return
    case 'database:reset':
      await verifyDatabaseCredentials(databaseUrl, target)
      await resetDatabase(target)
      await migrate(databaseUrl)
      return
    case 'database:backup':
      await backup(databaseUrl, target, resolveBackupPath(option(args, '--output')))
      return
    case 'database:restore':
      await restore(databaseUrl, target, resolveBackupPath(option(args, '--input')))
      return
    case 'database:verify':
      await verifyDependencies(databaseUrl, target)
      return
    case 'artifacts:backup':
      await backupArtifacts(resolveArtifactBackupPath(option(args, '--output')))
      return
    case 'artifacts:restore':
      await restoreArtifacts(target, resolveArtifactBackupPath(option(args, '--input')))
      return
    case 'artifacts:verify':
      await verifyArtifactStore(artifactRoot())
      return
    case 'application:verify':
      await verifyApplicationReadiness()
      return
    default:
      throw new OperationsError(
        'Usage: bun run ops <stack:up|stack:restart|database:reset|database:backup --output .local/backups/name.dump|database:restore --input .local/backups/name.dump|database:verify|artifacts:backup --output .local/backups/name.artifacts|artifacts:restore --input .local/backups/name.artifacts|artifacts:verify|application:verify>',
      )
  }
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(`Operation failed: ${message}\n`)
    process.exitCode = 1
  })
}
